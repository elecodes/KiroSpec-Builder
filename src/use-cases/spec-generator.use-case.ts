import type { InputParser } from "../domain/ports/input-parser.port.js";
import type { SpecExporter, ExportResult } from "../domain/ports/spec-exporter.port.js";
import type { PipelineLogger, PipelineStage } from "../domain/ports/pipeline-logger.port.js";
import type { RequirementsDocument } from "../domain/schemas/requirement.schema.js";
import type { DesignDocument } from "../domain/schemas/design.schema.js";
import type { TasksDocument } from "../domain/schemas/task.schema.js";
import { PipelineError } from "../domain/schemas/error.schema.js";
import { EarsParserUseCase } from "./ears-parser.use-case.js";
import { DesignBuilderUseCase } from "./design-builder.use-case.js";
import { TaskDecomposerUseCase } from "./task-decomposer.use-case.js";

/**
 * Result of a complete spec generation pipeline run.
 */
export interface SpecOutput {
  /** Whether the full pipeline completed successfully. */
  success: boolean;
  /** Generated requirements document (if stage succeeded). */
  requirements?: RequirementsDocument;
  /** Generated design document (if stage succeeded). */
  design?: DesignDocument;
  /** Generated tasks document (if stage succeeded). */
  tasks?: TasksDocument;
  /** File export results (if export stage succeeded). */
  exports?: ExportResult[];
  /** Total pipeline duration in milliseconds. */
  totalDurationMs: number;
  /** Errors encountered during the pipeline (partial failures). */
  errors: PipelineStageError[];
}

/**
 * Error information for a specific pipeline stage failure.
 */
export interface PipelineStageError {
  stage: PipelineStage;
  code: string;
  message: string;
}

/**
 * SpecGeneratorUseCase — Orchestrates the full spec generation pipeline.
 *
 * Pipeline stages:
 * 1. Ingestion: Parse and validate raw input
 * 2. Requirements: Generate EARS-formatted requirements
 * 3. Design: Generate technical design document
 * 4. Tasks: Decompose into implementation tasks
 * 5. Export: Write output files to disk
 *
 * Each stage is timed and logged. Partial results are preserved on failure.
 */
export class SpecGeneratorUseCase {
  constructor(
    private readonly inputParser: InputParser,
    private readonly earsParser: EarsParserUseCase,
    private readonly designBuilder: DesignBuilderUseCase,
    private readonly taskDecomposer: TaskDecomposerUseCase,
    private readonly exporter: SpecExporter,
    private readonly logger: PipelineLogger,
  ) {}

  /**
   * Execute the full spec generation pipeline.
   *
   * @param rawInput - The unvalidated input payload.
   * @param outputDir - Target directory for output files (e.g., ".kiro/specs").
   * @returns SpecOutput with results and metadata.
   */
  async execute(rawInput: unknown, outputDir: string): Promise<SpecOutput> {
    const pipelineStart = Date.now();
    const errors: PipelineStageError[] = [];
    let requirements: RequirementsDocument | undefined;
    let design: DesignDocument | undefined;
    let tasks: TasksDocument | undefined;
    let exports: ExportResult[] | undefined;

    // Stage 1: Ingestion — Parse & Validate Input
    const normalizedInput = await this.executeStage("ingestion", () => {
      const parsed = this.inputParser.parse(rawInput);
      const normalized = this.inputParser.normalize(parsed);
      return normalized;
    }, errors);

    if (normalizedInput === undefined) {
      return this.buildOutput(false, pipelineStart, errors, { requirements, design, tasks, exports });
    }

    // Stage 2: Requirements — Generate EARS Requirements
    requirements = await this.executeStage("requirements", () => {
      return this.earsParser.execute(normalizedInput);
    }, errors);

    if (requirements === undefined) {
      return this.buildOutput(false, pipelineStart, errors, { requirements, design, tasks, exports });
    }

    // Stage 3: Design — Generate Technical Design
    design = await this.executeStage("design", () => {
      return this.designBuilder.execute(requirements!);
    }, errors);

    if (design === undefined) {
      return this.buildOutput(false, pipelineStart, errors, { requirements, design, tasks, exports });
    }

    // Stage 4: Tasks — Decompose into Implementation Tasks
    tasks = await this.executeStage("tasks", () => {
      return this.taskDecomposer.execute(requirements!, design!);
    }, errors);

    if (tasks === undefined) {
      return this.buildOutput(false, pipelineStart, errors, { requirements, design, tasks, exports });
    }

    // Stage 5: Export — Write Files to Disk
    exports = await this.executeStage("export", async () => {
      const results: ExportResult[] = [];
      results.push(await this.exporter.exportRequirements(requirements!, outputDir));
      results.push(await this.exporter.exportDesign(design!, outputDir));
      results.push(await this.exporter.exportTasks(tasks!, outputDir));
      return results;
    }, errors);

    const success = exports !== undefined;
    return this.buildOutput(success, pipelineStart, errors, { requirements, design, tasks, exports });
  }

  /**
   * Execute a single pipeline stage with timing, logging, and error capture.
   *
   * @returns The stage result, or undefined if the stage failed.
   */
  private async executeStage<T>(
    stage: PipelineStage,
    fn: () => T | Promise<T>,
    errors: PipelineStageError[],
  ): Promise<T | undefined> {
    const stageStart = Date.now();

    try {
      const result = await fn();
      const durationMs = Date.now() - stageStart;

      this.logger.logStage(stage, {
        durationMs,
        success: true,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - stageStart;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorCode = error instanceof PipelineError ? error.code : "STAGE_FAILED";

      this.logger.logStage(stage, {
        durationMs,
        success: false,
        error: errorMessage,
      });

      errors.push({
        stage,
        code: errorCode,
        message: errorMessage,
      });

      this.logger.error(`Pipeline stage "${stage}" failed`, error instanceof Error ? error : undefined, { stage });

      return undefined;
    }
  }

  /**
   * Build the final SpecOutput result.
   */
  private buildOutput(
    success: boolean,
    pipelineStart: number,
    errors: PipelineStageError[],
    results: {
      requirements?: RequirementsDocument;
      design?: DesignDocument;
      tasks?: TasksDocument;
      exports?: ExportResult[];
    },
  ): SpecOutput {
    const totalDurationMs = Date.now() - pipelineStart;

    this.logger.info("Pipeline completed", {
      success,
      totalDurationMs,
      errorCount: errors.length,
    });

    return {
      success,
      requirements: results.requirements,
      design: results.design,
      tasks: results.tasks,
      exports: results.exports,
      totalDurationMs,
      errors,
    };
  }
}
