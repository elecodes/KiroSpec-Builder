import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Container } from "../di/container.js";
import { ValidationError } from "../../domain/schemas/error.schema.js";

/**
 * Minimal Express-like HTTP server for the KiroSpec Builder API.
 *
 * Endpoints:
 * - POST /api/generate — Trigger the spec generation pipeline
 * - GET  /api/health   — Health check with provider status
 *
 * Uses native Node.js http module to avoid Express dependency in Phase 4.
 * Can be replaced with Express in a future iteration.
 */

export interface ServerOptions {
  port?: number;
}

export function createServer(container: Container, options?: ServerOptions) {
  const port = options?.port ?? container.config.port;

  const server = createHttpServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        await handleHealth(container, res);
      } else if (req.method === "POST" && url.pathname === "/api/generate") {
        await handleGenerate(container, req, res);
      } else {
        sendJson(res, 404, { error: "Not found" });
      }
    } catch (error) {
      container.logger.error("Unhandled server error", error instanceof Error ? error : undefined);
      sendJson(res, 500, {
        code: "INTERNAL_ERROR",
        category: "pipeline",
        message: "Internal server error",
        severity: "fatal",
        timestamp: new Date().toISOString(),
      });
    }
  });

  return {
    server,
    port,
    start: () =>
      new Promise<void>((resolve) => {
        server.listen(port, () => {
          container.logger.info(`Server listening on port ${port}`);
          resolve();
        });
      }),
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

/**
 * GET /api/health — Health check endpoint.
 */
async function handleHealth(container: Container, res: ServerResponse): Promise<void> {
  const providerAvailable = await container.llmProvider.isAvailable();

  sendJson(res, 200, {
    status: "ok",
    version: "0.1.0",
    provider: {
      name: container.llmProvider.name,
      available: providerAvailable,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/generate — Trigger spec generation pipeline.
 */
async function handleGenerate(
  container: Container,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readBody(req);

  if (!body) {
    sendJson(res, 400, {
      code: "INVALID_REQUEST",
      category: "validation",
      message: "Request body is required",
      severity: "error",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  let parsed: { content?: string; format?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    sendJson(res, 400, {
      code: "INVALID_JSON",
      category: "validation",
      message: "Request body must be valid JSON",
      severity: "error",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!parsed.content || typeof parsed.content !== "string") {
    sendJson(res, 400, {
      code: "MISSING_CONTENT",
      category: "validation",
      message: "Field 'content' (string) is required",
      severity: "error",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const rawInput = {
    id: randomUUID(),
    content: parsed.content,
    format: (parsed.format as "text" | "markdown" | "json" | "voice-transcription") ?? "text",
    metadata: {
      timestamp: new Date().toISOString(),
      source: "api",
      language: "en",
    },
  };

  const result = await container.specGenerator.execute(rawInput, container.config.outputDir);

  if (result.success) {
    sendJson(res, 200, {
      success: true,
      requirements: result.requirements,
      design: result.design,
      tasks: result.tasks,
      exports: result.exports,
      totalDurationMs: result.totalDurationMs,
    });
  } else {
    sendJson(res, 422, {
      success: false,
      errors: result.errors,
      requirements: result.requirements,
      design: result.design,
      tasks: result.tasks,
      totalDurationMs: result.totalDurationMs,
    });
  }
}

/**
 * Read request body as string.
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/**
 * Send a JSON response.
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}
