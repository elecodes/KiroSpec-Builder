import { z } from "zod";

/**
 * Options for controlling LLM generation behavior.
 */
export interface GenerationOptions {
  /** Sampling temperature (0.0 = deterministic, 1.0 = creative). */
  temperature?: number;
  /** Maximum tokens to generate in the response. */
  maxTokens?: number;
  /** Model override (e.g., "gpt-4o", "llama3"). */
  model?: string;
  /** System prompt prepended to the user prompt. */
  systemPrompt?: string;
}

/**
 * Result metadata returned alongside the generated output.
 */
export interface GenerationMetadata {
  /** Total tokens consumed (prompt + completion). */
  tokensUsed: number;
  /** Model actually used for the generation. */
  modelUsed: string;
  /** Duration of the LLM call in milliseconds. */
  durationMs: number;
}

/**
 * Port interface for LLM providers.
 *
 * All LLM adapters (OpenAI, Genkit, LangChain, Ollama) must implement this interface.
 * The `generateStructured` method enforces runtime type validation on LLM output
 * by parsing the response against a provided Zod schema.
 *
 * This interface belongs to the Domain layer — implementations live in the Adapter layer.
 */
export interface LLMProvider {
  /** Unique name identifying this provider (e.g., "openai", "ollama"). */
  readonly name: string;

  /**
   * Generate a structured response from the LLM and validate it against a Zod schema.
   *
   * @param prompt - The user prompt describing what to generate.
   * @param schema - A Zod schema that the LLM output must conform to.
   * @param options - Optional generation parameters.
   * @returns The validated, typed response.
   * @throws ValidationError if the LLM output fails schema validation.
   * @throws PipelineError if the LLM call itself fails.
   */
  generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: GenerationOptions,
  ): Promise<T>;

  /**
   * Check if this provider is currently reachable and operational.
   * Used for health checks and failover decisions.
   */
  isAvailable(): Promise<boolean>;
}
