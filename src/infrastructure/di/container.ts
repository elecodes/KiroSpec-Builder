import type { AppConfig } from "../config/app.config.js";
import type { LLMProvider } from "../../domain/ports/llm-provider.port.js";
import type { SpecExporter } from "../../domain/ports/spec-exporter.port.js";
import type { InputParser } from "../../domain/ports/input-parser.port.js";
import type { PipelineLogger } from "../../domain/ports/pipeline-logger.port.js";

import { OpenAIAdapter } from "../../adapters/llm/openai.adapter.js";
import { OllamaAdapter } from "../../adapters/llm/ollama.adapter.js";
import { ResilientLLMAdapter } from "../../adapters/llm/resilient-llm.adapter.js";
import { FileSystemExporter } from "../../adapters/exporters/filesystem.exporter.js";

import { ZodInputParser } from "../../use-cases/input-parser.js";
import { EarsParserUseCase } from "../../use-cases/ears-parser.use-case.js";
import { DesignBuilderUseCase } from "../../use-cases/design-builder.use-case.js";
import { TaskDecomposerUseCase } from "../../use-cases/task-decomposer.use-case.js";
import { SpecGeneratorUseCase } from "../../use-cases/spec-generator.use-case.js";

import { StructuredLogger } from "../logging/structured-logger.js";

/**
 * Application dependency container.
 * Holds all wired instances for the application lifecycle.
 */
export interface Container {
  config: AppConfig;
  logger: PipelineLogger;
  llmProvider: LLMProvider;
  inputParser: InputParser;
  exporter: SpecExporter;
  specGenerator: SpecGeneratorUseCase;
}

/**
 * Create and wire the application dependency container.
 *
 * Follows the Composition Root pattern — all dependencies are resolved
 * here at the application boundary, not inside use cases or adapters.
 */
export function createContainer(config: AppConfig): Container {
  // Infrastructure
  const logger = new StructuredLogger(config.logLevel);

  // Adapters — LLM Providers
  const ollama = new OllamaAdapter({
    baseUrl: config.ollamaBaseUrl,
    model: config.ollamaModel,
  });

  const primary = resolvePrimaryProvider(config);
  const llmProvider = new ResilientLLMAdapter(primary, ollama, logger);

  // Adapters — Exporters
  const exporter = new FileSystemExporter();

  // Use Cases
  const inputParser = new ZodInputParser();
  const earsParser = new EarsParserUseCase(llmProvider);
  const designBuilder = new DesignBuilderUseCase(llmProvider);
  const taskDecomposer = new TaskDecomposerUseCase(llmProvider);

  const specGenerator = new SpecGeneratorUseCase(
    inputParser,
    earsParser,
    designBuilder,
    taskDecomposer,
    exporter,
    logger,
  );

  return {
    config,
    logger,
    llmProvider,
    inputParser,
    exporter,
    specGenerator,
  };
}

/**
 * Resolve the primary LLM provider based on configuration.
 */
function resolvePrimaryProvider(config: AppConfig): LLMProvider {
  switch (config.llmProvider) {
    case "openai":
      return new OpenAIAdapter({
        apiKey: config.openaiApiKey!,
        model: config.openaiModel,
        baseUrl: config.openaiBaseUrl,
      });
    case "ollama":
      return new OllamaAdapter({
        baseUrl: config.ollamaBaseUrl,
        model: config.ollamaModel,
      });
    default:
      // For genkit/langchain — fall back to OpenAI if key available, else Ollama
      if (config.openaiApiKey) {
        return new OpenAIAdapter({
          apiKey: config.openaiApiKey,
          model: config.openaiModel,
        });
      }
      return new OllamaAdapter({
        baseUrl: config.ollamaBaseUrl,
        model: config.ollamaModel,
      });
  }
}
