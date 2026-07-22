import type { z } from "zod";
import type {
  LLMProvider,
  GenerationOptions,
} from "../../domain/ports/llm-provider.port.js";
import { PipelineError } from "../../domain/schemas/error.schema.js";

/**
 * Configuration for the Ollama adapter.
 */
export interface OllamaConfig {
  /** Base URL for the Ollama API (default: "http://localhost:11434"). */
  baseUrl?: string;
  /** Model to use (default: "llama3"). */
  model?: string;
  /** Request timeout in milliseconds (default: 120000). */
  timeoutMs?: number;
}

/**
 * Ollama /api/generate response shape.
 */
interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

/**
 * OllamaAdapter — LLM provider adapter for local Ollama inference.
 *
 * Calls the Ollama HTTP API at /api/generate with format: "json"
 * to ensure structured output that can be validated against Zod schemas.
 */
export class OllamaAdapter implements LLMProvider {
  readonly name = "ollama";
  private readonly config: Required<OllamaConfig>;

  constructor(config?: OllamaConfig) {
    this.config = {
      baseUrl: config?.baseUrl ?? "http://localhost:11434",
      model: config?.model ?? "llama3",
      timeoutMs: config?.timeoutMs ?? 120_000,
    };
  }

  /**
   * Generate a structured response using Ollama's JSON format mode.
   * Parses and validates the response against the provided Zod schema.
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: GenerationOptions,
  ): Promise<T> {
    const model = options?.model ?? this.config.model;

    const systemPrompt = options?.systemPrompt ?? "";
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    const requestBody = {
      model,
      prompt: fullPrompt,
      format: "json",
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.3,
        num_predict: options?.maxTokens ?? 4096,
      },
    };

    let responseData: OllamaGenerateResponse;

    try {
      responseData = await this.makeRequest(
        `${this.config.baseUrl}/api/generate`,
        requestBody,
      );
    } catch (error) {
      throw new PipelineError(
        `Ollama API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "LLM_API_ERROR",
        "llm",
        "requirements",
      );
    }

    if (!responseData.response) {
      throw new PipelineError(
        "Ollama returned empty response",
        "LLM_EMPTY_RESPONSE",
        "llm",
        "requirements",
      );
    }

    // Parse JSON response
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseData.response);
    } catch {
      throw new PipelineError(
        `Ollama response is not valid JSON: ${responseData.response.slice(0, 200)}`,
        "LLM_INVALID_JSON",
        "llm",
        "requirements",
      );
    }

    // Validate against Zod schema
    const result = schema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new PipelineError(
        `Ollama response failed schema validation: ${issues}`,
        "LLM_SCHEMA_VALIDATION_FAILED",
        "validation",
        "requirements",
      );
    }

    return result.data;
  }

  /**
   * Check if the Ollama server is running by querying /api/tags.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${this.config.baseUrl}/api/tags`, {
          method: "GET",
          signal: controller.signal,
        });
        return response.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return false;
    }
  }

  /**
   * Make an HTTP request to the Ollama API.
   */
  private async makeRequest(
    url: string,
    body: unknown,
  ): Promise<OllamaGenerateResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}. ${errorBody.slice(0, 200)}`,
        );
      }

      return (await response.json()) as OllamaGenerateResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
