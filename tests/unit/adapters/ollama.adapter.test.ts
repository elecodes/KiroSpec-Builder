import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { OllamaAdapter } from "../../../src/adapters/llm/ollama.adapter.js";
import { PipelineError } from "../../../src/domain/schemas/error.schema.js";

const TestSchema = z.object({
  title: z.string(),
  count: z.number(),
});

describe("OllamaAdapter", () => {
  let adapter: OllamaAdapter;
  const mockFetch = vi.fn();

  beforeEach(() => {
    adapter = new OllamaAdapter({
      baseUrl: "http://localhost:11434",
      model: "llama3",
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have name 'ollama'", () => {
    expect(adapter.name).toBe("ollama");
  });

  it("should use default config values", () => {
    const defaultAdapter = new OllamaAdapter();
    expect(defaultAdapter.name).toBe("ollama");
  });

  describe("generateStructured()", () => {
    it("should return validated data on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: "llama3",
          response: '{"title":"hello","count":5}',
          done: true,
        }),
      });

      const result = await adapter.generateStructured("Test", TestSchema);
      expect(result).toEqual({ title: "hello", count: 5 });
    });

    it("should send correct request to /api/generate", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: "llama3",
          response: '{"title":"x","count":1}',
          done: true,
        }),
      });

      await adapter.generateStructured("My prompt", TestSchema, {
        temperature: 0.5,
        maxTokens: 2048,
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:11434/api/generate");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body);
      expect(body.model).toBe("llama3");
      expect(body.format).toBe("json");
      expect(body.stream).toBe(false);
      expect(body.options.temperature).toBe(0.5);
      expect(body.options.num_predict).toBe(2048);
    });


    it("should prepend system prompt to prompt content", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: "llama3",
          response: '{"title":"x","count":1}',
          done: true,
        }),
      });

      await adapter.generateStructured("User prompt", TestSchema, {
        systemPrompt: "System instruction",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.prompt).toContain("System instruction");
      expect(body.prompt).toContain("User prompt");
    });

    it("should throw PipelineError on HTTP error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "model not found",
      });

      await expect(
        adapter.generateStructured("prompt", TestSchema),
      ).rejects.toThrow(PipelineError);

      try {
        await adapter.generateStructured("prompt", TestSchema);
      } catch (e) {
        expect((e as PipelineError).code).toBe("LLM_API_ERROR");
      }
    });

    it("should throw PipelineError on empty response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ model: "llama3", response: "", done: true }),
      });

      await expect(
        adapter.generateStructured("prompt", TestSchema),
      ).rejects.toThrow(PipelineError);

      try {
        await adapter.generateStructured("prompt", TestSchema);
      } catch (e) {
        expect((e as PipelineError).code).toBe("LLM_EMPTY_RESPONSE");
      }
    });

    it("should throw PipelineError on invalid JSON", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ model: "llama3", response: "not json!", done: true }),
      });

      await expect(
        adapter.generateStructured("prompt", TestSchema),
      ).rejects.toThrow(PipelineError);

      try {
        await adapter.generateStructured("prompt", TestSchema);
      } catch (e) {
        expect((e as PipelineError).code).toBe("LLM_INVALID_JSON");
      }
    });

    it("should throw PipelineError on schema validation failure", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ model: "llama3", response: '{"title":123}', done: true }),
      });

      await expect(
        adapter.generateStructured("prompt", TestSchema),
      ).rejects.toThrow(PipelineError);

      try {
        await adapter.generateStructured("prompt", TestSchema);
      } catch (e) {
        expect((e as PipelineError).code).toBe("LLM_SCHEMA_VALIDATION_FAILED");
      }
    });

    it("should use model from options over config", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ model: "mistral", response: '{"title":"x","count":1}', done: true }),
      });

      await adapter.generateStructured("prompt", TestSchema, { model: "mistral" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("mistral");
    });
  });

  describe("isAvailable()", () => {
    it("should return true when /api/tags responds ok", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      expect(await adapter.isAvailable()).toBe(true);
    });

    it("should return false when server is unreachable", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
      expect(await adapter.isAvailable()).toBe(false);
    });

    it("should return false on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      expect(await adapter.isAvailable()).toBe(false);
    });
  });
});
