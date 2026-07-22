import { randomUUID } from "node:crypto";
import type { Container } from "../di/container.js";

/**
 * MCP Server for KiroSpec Builder.
 *
 * Implements the Model Context Protocol to expose the spec-generation
 * pipeline as a tool that can be called by MCP clients (e.g., Kiro).
 *
 * Supports two transports:
 * - stdio: reads JSON-RPC messages from stdin, writes to stdout
 * - http: HTTP/SSE transport (future implementation)
 *
 * Tool Definition:
 * - Name: "generate-spec"
 * - Description: Generate Kiro specification files from unstructured input
 * - Input Schema: { content: string, format?: string }
 */

/** MCP JSON-RPC message types */
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

/**
 * Get the tool definition for the generate-spec tool.
 */
export function getToolDefinition(): MCPToolDefinition {
  return {
    name: "generate-spec",
    description:
      "Generate Kiro specification files (.kiro/specs/) from unstructured feature descriptions. " +
      "Produces requirements.md (EARS syntax), design.md (entities, diagrams), and tasks.md (atomic tasks).",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The unstructured feature description, product idea, or PRD text.",
          minLength: 1,
          maxLength: 100000,
        },
        format: {
          type: "string",
          enum: ["text", "markdown", "json", "voice-transcription"],
          default: "text",
          description: "Input format type.",
        },
        outputDir: {
          type: "string",
          default: ".kiro/specs",
          description: "Output directory for generated spec files.",
        },
      },
      required: ["content"],
    },
  };
}

/**
 * Handle a tools/list request.
 */
function handleToolsList(): unknown {
  return { tools: [getToolDefinition()] };
}

/**
 * Handle a tools/call request.
 */
async function handleToolsCall(
  container: Container,
  params: { name: string; arguments?: Record<string, unknown> },
): Promise<unknown> {
  if (params.name !== "generate-spec") {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${params.name}. Available tools: generate-spec`,
        },
      ],
      isError: true,
    };
  }

  const args = params.arguments ?? {};
  const content = args.content as string | undefined;

  if (!content || typeof content !== "string") {
    return {
      content: [
        { type: "text", text: "Error: 'content' argument is required and must be a string." },
      ],
      isError: true,
    };
  }

  const outputDir = (args.outputDir as string) ?? container.config.outputDir;
  const format = (args.format as string) ?? "text";

  const rawInput = {
    id: randomUUID(),
    content,
    format: format as "text" | "markdown" | "json" | "voice-transcription",
    metadata: {
      timestamp: new Date().toISOString(),
      source: "mcp",
      language: "en",
    },
  };

  const result = await container.specGenerator.execute(rawInput, outputDir);

  if (result.success) {
    const summaryParts: string[] = [
      `✅ Spec generation complete (${result.totalDurationMs}ms)`,
      "",
      `**Requirements:** ${result.requirements?.requirements.length ?? 0} requirement(s)`,
      `**Entities:** ${result.design?.entities.length ?? 0} domain entity(ies)`,
      `**Tasks:** ${result.tasks?.tasks.length ?? 0} implementation task(s)`,
    ];

    if (result.exports) {
      summaryParts.push("", "**Files written:**");
      for (const exp of result.exports) {
        summaryParts.push(`- ${exp.filePath} (${exp.sizeBytes} bytes)`);
      }
    }

    return {
      content: [{ type: "text", text: summaryParts.join("\n") }],
      isError: false,
    };
  } else {
    const errorParts = [
      `❌ Spec generation failed (${result.totalDurationMs}ms)`,
      "",
      "**Errors:**",
      ...result.errors.map((e) => `- [${e.stage}] ${e.code}: ${e.message}`),
    ];

    return {
      content: [{ type: "text", text: errorParts.join("\n") }],
      isError: true,
    };
  }
}

/**
 * Process a single MCP JSON-RPC request.
 */
async function processRequest(container: Container, request: MCPRequest): Promise<MCPResponse> {
  try {
    switch (request.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "kirospec-builder",
              version: "0.1.0",
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: handleToolsList(),
        };

      case "tools/call":
        const callResult = await handleToolsCall(
          container,
          request.params as { name: string; arguments?: Record<string, unknown> },
        );
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: callResult,
        };

      case "notifications/initialized":
        // Acknowledge — no response needed for notifications
        return { jsonrpc: "2.0", id: request.id, result: {} };

      default:
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        };
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    };
  }
}

/**
 * Start the MCP server in stdio transport mode.
 *
 * Reads JSON-RPC messages from stdin (newline-delimited),
 * processes them, and writes responses to stdout.
 */
export function startStdioServer(container: Container): void {
  container.logger.info("MCP server starting (stdio transport)");

  let buffer = "";

  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;

    // Process complete lines (newline-delimited JSON)
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const request = JSON.parse(trimmed) as MCPRequest;
        const response = await processRequest(container, request);

        // Don't send response for notifications (no id)
        if (request.id !== undefined) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      } catch {
        const errorResponse: MCPResponse = {
          jsonrpc: "2.0",
          id: 0,
          error: { code: -32700, message: "Parse error" },
        };
        process.stdout.write(JSON.stringify(errorResponse) + "\n");
      }
    }
  });

  process.stdin.on("end", () => {
    container.logger.info("MCP server stdin closed");
  });
}

/**
 * Export for testing and programmatic usage.
 */
export { processRequest, handleToolsCall, handleToolsList };
