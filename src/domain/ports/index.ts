/**
 * Domain Ports - Central export point for all port interfaces.
 * These define the contracts that adapters and infrastructure must implement.
 */

export type {
  LLMProvider,
  GenerationOptions,
  GenerationMetadata,
} from "./llm-provider.port.js";

export type {
  SpecExporter,
  ExportResult,
} from "./spec-exporter.port.js";

export type { InputParser } from "./input-parser.port.js";

export type {
  PipelineLogger,
  PipelineStage,
  StageLogEntry,
} from "./pipeline-logger.port.js";
