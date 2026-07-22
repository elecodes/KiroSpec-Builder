import { describe, it, expect } from "vitest";
import { loadConfig, AppConfigSchema } from "../../../src/infrastructure/config/app.config.js";

describe("AppConfigSchema", () => {
  it("should accept minimal valid config", () => {
    const result = AppConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.llmProvider).toBe("openai");
      expect(result.data.ollamaBaseUrl).toBe("http://localhost:11434");
      expect(result.data.ollamaModel).toBe("llama3");
      expect(result.data.outputDir).toBe(".kiro/specs");
      expect(result.data.port).toBe(3000);
      expect(result.data.logLevel).toBe("info");
    }
  });

  it("should accept full config", () => {
    const result = AppConfigSchema.safeParse({
      llmProvider: "ollama",
      openaiApiKey: "sk-test",
      openaiModel: "gpt-3.5-turbo",
      ollamaBaseUrl: "http://remote:11434",
      ollamaModel: "mistral",
      outputDir: "./out",
      port: 8080,
      logLevel: "debug",
      mcpTransport: "http",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid provider", () => {
    const result = AppConfigSchema.safeParse({ llmProvider: "grok" });
    expect(result.success).toBe(false);
  });

  it("should coerce port from string", () => {
    const result = AppConfigSchema.safeParse({ port: "8080" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(8080);
    }
  });
});

describe("loadConfig()", () => {
  it("should load from env vars", () => {
    const env = {
      KIROSPEC_LLM_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "llama3",
      OUTPUT_DIR: "./specs",
      PORT: "4000",
      LOG_LEVEL: "debug",
    };

    const config = loadConfig(env);
    expect(config.llmProvider).toBe("ollama");
    expect(config.port).toBe(4000);
    expect(config.logLevel).toBe("debug");
    expect(config.outputDir).toBe("./specs");
  });

  it("should use defaults for missing env vars", () => {
    const config = loadConfig({ KIROSPEC_LLM_PROVIDER: "ollama" });
    expect(config.ollamaBaseUrl).toBe("http://localhost:11434");
    expect(config.ollamaModel).toBe("llama3");
    expect(config.port).toBe(3000);
  });

  it("should throw when openai provider selected without API key", () => {
    expect(() => loadConfig({ KIROSPEC_LLM_PROVIDER: "openai" })).toThrow(
      /OPENAI_API_KEY.*required/,
    );
  });

  it("should accept openai with API key", () => {
    const config = loadConfig({
      KIROSPEC_LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test123",
    });
    expect(config.llmProvider).toBe("openai");
    expect(config.openaiApiKey).toBe("sk-test123");
  });

  it("should throw on invalid config", () => {
    expect(() => loadConfig({ PORT: "not-a-number" })).toThrow(/Configuration error/);
  });
});
