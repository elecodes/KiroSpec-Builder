import { z } from "zod";

/**
 * Supported LLM provider identifiers.
 */
export const LLMProviderEnum = z.enum(["openai", "ollama", "genkit", "langchain"]);

/**
 * Application configuration schema — validated from environment variables.
 */
export const AppConfigSchema = z.object({
  /** Primary LLM provider to use. */
  llmProvider: LLMProviderEnum.default("openai"),

  /** OpenAI API key (required if provider is openai). */
  openaiApiKey: z.string().optional(),

  /** OpenAI model (default: gpt-4o). */
  openaiModel: z.string().default("gpt-4o"),

  /** OpenAI base URL override. */
  openaiBaseUrl: z.string().url().optional(),

  /** Ollama base URL (default: http://localhost:11434). */
  ollamaBaseUrl: z.string().url().default("http://localhost:11434"),

  /** Ollama model (default: llama3). */
  ollamaModel: z.string().default("llama3"),

  /** Output directory for generated specs. */
  outputDir: z.string().default(".kiro/specs"),

  /** Server port for Express API. */
  port: z.coerce.number().int().positive().default(3000),

  /** Log level. */
  logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  /** MCP transport mode. */
  mcpTransport: z.enum(["stdio", "http"]).default("stdio"),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Load and validate application configuration from environment variables.
 *
 * Environment variable mapping:
 * - KIROSPEC_LLM_PROVIDER → llmProvider
 * - OPENAI_API_KEY → openaiApiKey
 * - OPENAI_MODEL → openaiModel
 * - OPENAI_BASE_URL → openaiBaseUrl
 * - OLLAMA_BASE_URL → ollamaBaseUrl
 * - OLLAMA_MODEL → ollamaModel
 * - OUTPUT_DIR → outputDir
 * - PORT → port
 * - LOG_LEVEL → logLevel
 * - MCP_TRANSPORT → mcpTransport
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const raw = {
    llmProvider: env.KIROSPEC_LLM_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL,
    openaiBaseUrl: env.OPENAI_BASE_URL,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    ollamaModel: env.OLLAMA_MODEL,
    outputDir: env.OUTPUT_DIR,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    mcpTransport: env.MCP_TRANSPORT,
  };

  // Remove undefined values so Zod defaults work
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([_, v]) => v !== undefined),
  );

  const result = AppConfigSchema.safeParse(cleaned);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuration error:\n${issues}`);
  }

  // Validate that OpenAI key is present if provider is openai
  if (result.data.llmProvider === "openai" && !result.data.openaiApiKey) {
    throw new Error(
      "Configuration error: OPENAI_API_KEY is required when KIROSPEC_LLM_PROVIDER=openai",
    );
  }

  return result.data;
}
