import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { ResilientLLMAdapter } from "../../../src/adapters/llm/resilient-llm.adapter.js";
import type { LLMProvider } from "../../../src/domain/ports/llm-provider.port.js";
import type { PipelineLogger } from "../../../src/domain/ports/pipeline-logger.port.js";

const TestSchema = z.object({ data: z.string() });

describe("ResilientLLMAdapter", () => {
  let primary: LLMProvider;
  let fallback: LLMProvider;
  let logger: PipelineLogger;
  let resilient: ResilientLLMAdapter;

  beforeEach(() => {
    primary = {
      name: "openai",
      generateStructured: vi.fn().mockResolvedValue({ data: "primary" }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    fallback = {
      name: "ollama",
      generateStructured: vi.fn().mockResolvedValue({ data: "fallback" }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    logger = {
      logStage: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    resilient = new ResilientLLMAdapter(primary, fallback, logger);
  });

  it("should have name 'resilient'", () => {
    expect(resilient.name).toBe("resilient");
  });

  describe("generateStructured() - normal operation", () => {
    it("should use primary on success", async () => {
      const result = await resilient.generateStructured("prompt", TestSchema);
      expect(result).toEqual({ data: "primary" });
      expect(primary.generateStructured).toHaveBeenCalledTimes(1);
      expect(fallback.generateStructured).not.toHaveBeenCalled();
    });

    it("should reset failure counter on primary success", async () => {
      // Fail twice
      vi.mocked(primary.generateStructured)
        .mockRejectedValueOnce(new Error("fail"))
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue({ data: "recovered" });

      await resilient.generateStructured("p", TestSchema);
      await resilient.generateStructured("p", TestSchema);
      const result = await resilient.generateStructured("p", TestSchema);

      expect(result).toEqual({ data: "recovered" });
      expect(resilient.getFailureCount()).toBe(0);
    });
  });


  describe("generateStructured() - failover", () => {
    it("should fall back on primary failure", async () => {
      vi.mocked(primary.generateStructured).mockRejectedValue(new Error("timeout"));

      const result = await resilient.generateStructured("prompt", TestSchema);

      expect(result).toEqual({ data: "fallback" });
      expect(fallback.generateStructured).toHaveBeenCalledTimes(1);
    });

    it("should increment failure counter on each primary failure", async () => {
      vi.mocked(primary.generateStructured).mockRejectedValue(new Error("fail"));

      await resilient.generateStructured("p", TestSchema);
      expect(resilient.getFailureCount()).toBe(1);

      await resilient.generateStructured("p", TestSchema);
      expect(resilient.getFailureCount()).toBe(2);
    });

    it("should log warning on fallback activation", async () => {
      vi.mocked(primary.generateStructured).mockRejectedValue(new Error("fail"));

      await resilient.generateStructured("p", TestSchema);

      expect(logger.warn).toHaveBeenCalledWith(
        "Primary LLM unavailable, falling back to Ollama",
        expect.objectContaining({
          primaryProvider: "openai",
          fallbackProvider: "ollama",
          failureCount: 1,
        }),
      );
    });

    it("should route directly to fallback after 3 consecutive failures", async () => {
      vi.mocked(primary.generateStructured).mockRejectedValue(new Error("fail"));

      // Trigger 3 failures
      await resilient.generateStructured("p", TestSchema);
      await resilient.generateStructured("p", TestSchema);
      await resilient.generateStructured("p", TestSchema);

      expect(resilient.getFailureCount()).toBe(3);

      // 4th call should bypass primary entirely
      vi.mocked(primary.generateStructured).mockClear();
      vi.mocked(fallback.generateStructured).mockClear();

      await resilient.generateStructured("p", TestSchema);

      expect(primary.generateStructured).not.toHaveBeenCalled();
      expect(fallback.generateStructured).toHaveBeenCalledTimes(1);
    });

    it("should throw if both primary and fallback fail", async () => {
      vi.mocked(primary.generateStructured).mockRejectedValue(new Error("primary fail"));
      vi.mocked(fallback.generateStructured).mockRejectedValue(new Error("fallback fail"));

      await expect(
        resilient.generateStructured("p", TestSchema),
      ).rejects.toThrow("fallback fail");
    });
  });

  describe("isAvailable()", () => {
    it("should return true if primary is available", async () => {
      vi.mocked(primary.isAvailable).mockResolvedValue(true);
      vi.mocked(fallback.isAvailable).mockResolvedValue(false);
      expect(await resilient.isAvailable()).toBe(true);
    });

    it("should return true if only fallback is available", async () => {
      vi.mocked(primary.isAvailable).mockResolvedValue(false);
      vi.mocked(fallback.isAvailable).mockResolvedValue(true);
      expect(await resilient.isAvailable()).toBe(true);
    });

    it("should return false if neither is available", async () => {
      vi.mocked(primary.isAvailable).mockResolvedValue(false);
      vi.mocked(fallback.isAvailable).mockResolvedValue(false);
      expect(await resilient.isAvailable()).toBe(false);
    });

    it("should handle provider errors gracefully", async () => {
      vi.mocked(primary.isAvailable).mockRejectedValue(new Error("crash"));
      vi.mocked(fallback.isAvailable).mockResolvedValue(true);
      expect(await resilient.isAvailable()).toBe(true);
    });
  });

  describe("utility methods", () => {
    it("should report active provider correctly", () => {
      expect(resilient.getActiveProvider()).toBe("openai");
    });

    it("should report fallback as active after threshold", async () => {
      vi.mocked(primary.generateStructured).mockRejectedValue(new Error("fail"));

      await resilient.generateStructured("p", TestSchema);
      await resilient.generateStructured("p", TestSchema);
      await resilient.generateStructured("p", TestSchema);

      expect(resilient.getActiveProvider()).toBe("ollama");
    });

    it("should allow manual reset of failure counter", async () => {
      vi.mocked(primary.generateStructured).mockRejectedValue(new Error("fail"));

      await resilient.generateStructured("p", TestSchema);
      await resilient.generateStructured("p", TestSchema);
      await resilient.generateStructured("p", TestSchema);

      expect(resilient.getFailureCount()).toBe(3);
      resilient.resetFailureCount();
      expect(resilient.getFailureCount()).toBe(0);
      expect(resilient.getActiveProvider()).toBe("openai");
    });
  });
});
