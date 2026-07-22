import type { z } from "zod";
import type {
  LLMProvider,
  GenerationOptions,
} from "../../domain/ports/llm-provider.port.js";
import { PipelineError } from "../../domain/schemas/error.schema.js";

/**
 * Configuration for the OpenAI adapter.
 */
export interface OpenAIConfig {
  /** OpenAI API key. */
  apiKey: string;
  /** Model to use (default: "gpt-4o"). */
  model?: string;
  /** Base URL for the API (default: "https://api.openai.com/v1"). */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 60000). */
  timeoutMs?: number;
}

/**
 * OpenAI chat completion message shape.
 */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * OpenAI API response shape (subset).
 */
interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      content: string | null;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAIAdapter — LLM provider adapter for the OpenAI API.
 *
 * Uses JSON mode (response_format: { type: "json_object" }) to ensure
 * structured output that can be validated against Zod schemas.
 */
export class OpenAIAdapter implements LLMProvider {
  readonly name = "openai";
  private readonly config: Required<OpenAIConfig>;

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? "gpt-4o",
      baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
      timeoutMs: config.timeoutMs ?? 60_000,
    };
  }

  /**
   * Generate a structured response using OpenAI's JSON mode.
   * Parses and validates the response against the provided Zod schema.
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: GenerationOptions,
  ): Promise<T> {
    const model = options?.model ?? this.config.model;
    const messages: ChatMessage[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const requestBody = {
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
      response_format: { type: "json_object" },
    };

    let responseData: ChatCompletionResponse;

    try {
      const response = await this.makeRequest(
        `${this.config.baseUrl}/chat/completions`,
        requestBody,
      );
      responseData = response;
    } catch (error) {
      throw new PipelineError(
        `OpenAI API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "LLM_API_ERROR",
        "llm",
        "requirements",
      );
    }

    const content = responseData.choices?.[0]?.message?.content;

    if (!content) {
      throw new PipelineError(
        "OpenAI returned empty response content",
        "LLM_EMPTY_RESPONSE",
        "llm",
        "requirements",
      );
    }

    // Parse JSON response
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new PipelineError(
        `OpenAI response is not valid JSON: ${content.slice(0, 200)}`,
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
        `OpenAI response failed schema validation: ${issues}`,
        "LLM_SCHEMA_VALIDATION_FAILED",
        "validation",
        "requirements",
      );
    }

    return result.data;
  }

  /**
   * Check if the OpenAI API is reachable by listing models.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.makeRequest(`${this.config.baseUrl}/models`, null, "GET");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Make an HTTP request to the OpenAI API.
   */
  private async makeRequest(
    url: string,
    body: unknown,
    method: "POST" | "GET" = "POST",
  ): Promise<ChatCompletionResponse> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (method === "POST" && body !== null) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}. ${errorBody.slice(0, 200)}`,
        );
      }

      return (await response.json()) as ChatCompletionResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}
