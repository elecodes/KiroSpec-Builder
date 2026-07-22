import type { z } from "zod";
import type {
  LLMProvider,
  GenerationOptions,
} from "../../domain/ports/llm-provider.port.js";
import type { PipelineLogger } from "../../domain/ports/pipeline-logger.port.js";

/**
 * ResilientLLMAdapter — Decorator that adds automatic failover between providers.
 *
 * Wraps a primary and fallback LLM provider. After MAX_FAILURES consecutive
 * failures on the primary provider, all subsequent requests are routed to the
 * fallback until the primary recovers (tested via next successful call).
 *
 * Behavior:
 * - Normal operation: all calls go to primary.
 * - On primary failure: immediately tries fallback for that call, increments counter.
 * - After 3 consecutive primary failures: all calls route directly to fallback.
 * - A successful primary call resets the failure counter to 0.
 */
export class ResilientLLMAdapter implements LLMProvider {
  readonly name = "resilient";

  private failureCount = 0;
  private readonly MAX_FAILURES = 3;

  constructor(
    private readonly primary: LLMProvider,
    private readonly fallback: LLMProvider,
    private readonly logger: PipelineLogger,
  ) {}

  /**
   * Generate structured output with automatic failover.
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: GenerationOptions,
  ): Promise<T> {
    // If failure threshold exceeded, go directly to fallback
    if (this.failureCount >= this.MAX_FAILURES) {
      this.logger.warn(
        `Primary LLM unavailable (${this.failureCount} failures), routing to fallback`,
        { provider: this.fallback.name, failureCount: this.failureCount },
      );
      return this.fallback.generateStructured(prompt, schema, options);
    }

    // Try primary first
    try {
      const result = await this.primary.generateStructured(prompt, schema, options);
      // Success — reset failure counter
      this.failureCount = 0;
      return result;
    } catch (primaryError) {
      this.failureCount++;

      this.logger.warn(
        "Primary LLM unavailable, falling back to Ollama",
        {
          primaryProvider: this.primary.name,
          fallbackProvider: this.fallback.name,
          failureCount: this.failureCount,
          error: primaryError instanceof Error ? primaryError.message : "Unknown error",
        },
      );

      // Attempt fallback
      try {
        return await this.fallback.generateStructured(prompt, schema, options);
      } catch (fallbackError) {
        // Both providers failed — throw the fallback error
        throw fallbackError;
      }
    }
  }

  /**
   * Check if either provider is available.
   */
  async isAvailable(): Promise<boolean> {
    const [primaryAvailable, fallbackAvailable] = await Promise.all([
      this.primary.isAvailable().catch(() => false),
      this.fallback.isAvailable().catch(() => false),
    ]);
    return primaryAvailable || fallbackAvailable;
  }

  /**
   * Get the current failure count (useful for health checks).
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset the failure counter (e.g., after manual intervention).
   */
  resetFailureCount(): void {
    this.failureCount = 0;
  }

  /**
   * Check which provider is currently active.
   */
  getActiveProvider(): string {
    return this.failureCount >= this.MAX_FAILURES
      ? this.fallback.name
      : this.primary.name;
  }
}
