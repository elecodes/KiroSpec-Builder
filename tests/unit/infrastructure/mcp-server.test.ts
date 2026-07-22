import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processRequest,
  getToolDefinition,
  handleToolsList,
} from "../../../src/infrastructure/mcp/server.js";
import type { Container } from "../../../src/infrastructure/di/container.js";

describe("MCP Server", () => {
  let mockContainer: Container;

  beforeEach(() => {
    mockContainer = {
      config: { outputDir: ".kiro/specs" },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), logStage: vi.fn() },
      llmProvider: { name: "mock", generateStructured: vi.fn(), isAvailable: vi.fn() },
      inputParser: { parse: vi.fn(), normalize: vi.fn() },
      exporter: { exportRequirements: vi.fn(), exportDesign: vi.fn(), exportTasks: vi.fn() },
      specGenerator: {
        execute: vi.fn().mockResolvedValue({
          success: true,
          requirements: { title: "Reqs", overview: "O", requirements: [] },
          design: { title: "D", overview: "O", architectureLayers: [], entities: [{ name: "E", description: "d", attributes: [{ name: "id", type: "string", required: true }], relationships: [] }], interfaces: [], diagrams: { sequence: "s", classDiagram: "c" } },
          tasks: { title: "T", overview: "O", tasks: [{ id: 1, title: "t", description: "d", layer: "domain", dependencies: [], acceptanceCriteria: ["x"] }] },
          exports: [{ filePath: ".kiro/specs/requirements.md", sizeBytes: 100 }],
          totalDurationMs: 2500,
          errors: [],
        }),
      },
    } as unknown as Container;
  });

  describe("getToolDefinition()", () => {
    it("should return generate-spec tool definition", () => {
      const def = getToolDefinition();
      expect(def.name).toBe("generate-spec");
      expect(def.inputSchema).toBeDefined();
    });

    it("should require content in input schema", () => {
      const def = getToolDefinition();
      const schema = def.inputSchema as { required: string[] };
      expect(schema.required).toContain("content");
    });
  });

  describe("handleToolsList()", () => {
    it("should return list with generate-spec tool", () => {
      const result = handleToolsList() as { tools: Array<{ name: string }> };
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe("generate-spec");
    });
  });

  describe("processRequest()", () => {
    it("should handle initialize", async () => {
      const response = await processRequest(mockContainer, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      });

      expect(response.result).toBeDefined();
      const result = response.result as { serverInfo: { name: string } };
      expect(result.serverInfo.name).toBe("kirospec-builder");
    });

    it("should handle tools/list", async () => {
      const response = await processRequest(mockContainer, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      });

      const result = response.result as { tools: Array<{ name: string }> };
      expect(result.tools[0].name).toBe("generate-spec");
    });

    it("should handle tools/call with valid input", async () => {
      const response = await processRequest(mockContainer, {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "generate-spec", arguments: { content: "Build a feature" } },
      });

      const result = response.result as { content: Array<{ text: string }>; isError: boolean };
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("Spec generation complete");
    });

    it("should return error for unknown tool", async () => {
      const response = await processRequest(mockContainer, {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "unknown-tool", arguments: {} },
      });

      const result = response.result as { isError: boolean };
      expect(result.isError).toBe(true);
    });

    it("should return error for missing content", async () => {
      const response = await processRequest(mockContainer, {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "generate-spec", arguments: {} },
      });

      const result = response.result as { isError: boolean };
      expect(result.isError).toBe(true);
    });

    it("should return method not found for unknown methods", async () => {
      const response = await processRequest(mockContainer, {
        jsonrpc: "2.0",
        id: 6,
        method: "unknown/method",
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
    });
  });
});
