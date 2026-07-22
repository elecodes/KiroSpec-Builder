import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { OpenAIAdapter } from "../../../src/adapters/llm/openai.adapter.js";
import { PipelineError } from "../../../src/domain/schemas/error.schema.js";

const TestSchema = z.object({
  name: z.string(),
  value: z.number(),
});

describe("OpenAIAdapter", () => {
  let adapter: OpenAIAdapter;
  const mockFetch = vi.fn();

  beforeEach(() => {
    adapter = new OpenAIAdapter({
      apiKey: "test-key-123",
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have name 'openai'", () => {
    expect(adapter.name).toBe("openai");
  });

  describe("generateStructured()", () => {
    it("should return validated data on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "chatcmpl-123",
          choices: [{ message: { content: '{"name":"test","value":42}' }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const result = await adapter.generateStructured("Test prompt", TestSchema);
      expect(result).toEqual({ name: "test", value: 42 });
    });

    it("should send correct request format", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "chatcmpl-123",
          choices: [{ message: { content: '{"name":"x","value":1}' }, finish_reason: "stop" }],
        }),
      });

      await adapter.generateStructured("My prompt", TestSchema, {
        temperature: 0.7,
        systemPrompt: "Be helpful",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body);
      expect(body.model).toBe("gpt-4o");
      expect(body.temperature).toBe(0.7);
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[0].content).toBe("Be helpful");
      expect(body.messages[1].role).toBe("user");
      expect(body.messages[1].content).toBe("My prompt");
    });

    it("should include Authorization header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "x",
          choices: [{ message: { content: '{"name":"a","value":1}' }, finish_reason: "stop" }],
        }),
      });

      await adapter.generateStructured("prompt", TestSchema);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe("Bearer test-key-123");
    });

    it("should throw PipelineError on HTTP error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Rate limit exceeded",
      });

      await expect(
        adapter.generateStructured("prompt", TestSchema),
      ).rejects.toThrow(PipelineError);

      try {
        await adapter.generateStructured("prompt", TestSchema);
      } catch (e) {
        const pe = e as PipelineError;
        expect(pe.code).toBe("LLM_API_ERROR");
        expect(pe.message).toContain("429");
      }
    });

    it("should throw PipelineError on empty response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "x",
          choices: [{ message: { content: null }, finish_reason: "stop" }],
        }),
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


    it("should throw PipelineError on invalid JSON response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "x",
          choices: [{ message: { content: "not json {{{" }, finish_reason: "stop" }],
        }),
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
        json: async () => ({
          id: "x",
          choices: [{ message: { content: '{"name":123,"value":"wrong"}' }, finish_reason: "stop" }],
        }),
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

    it("should throw PipelineError on network error", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        adapter.generateStructured("prompt", TestSchema),
      ).rejects.toThrow(PipelineError);
    });

    it("should use custom model from options", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "x",
          choices: [{ message: { content: '{"name":"a","value":1}' }, finish_reason: "stop" }],
        }),
      });

      await adapter.generateStructured("prompt", TestSchema, { model: "gpt-3.5-turbo" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("gpt-3.5-turbo");
    });
  });

  describe("isAvailable()", () => {
    it("should return true when API responds ok", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
      expect(await adapter.isAvailable()).toBe(true);
    });

    it("should return false when API returns error", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });
      expect(await adapter.isAvailable()).toBe(false);
    });

    it("should return false on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      expect(await adapter.isAvailable()).toBe(false);
    });
  });
});
