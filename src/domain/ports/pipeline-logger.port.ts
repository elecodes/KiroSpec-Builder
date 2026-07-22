/**
 * Pipeline stage identifiers for structured logging.
 */
export type PipelineStage = "ingestion" | "requirements" | "design" | "tasks" | "export";

/**
 * Data structure for a single pipeline stage log entry.
 */
export interface StageLogEntry {
  /** Duration of this stage in milliseconds. */
  durationMs: number;
  /** Number of LLM tokens consumed (prompt + completion), if applicable. */
  tokensUsed?: number;
  /** Whether the stage completed successfully. */
  success: boolean;
  /** Error message if the stage failed. */
  error?: string;
  /** Additional contextual metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Port interface for pipeline observability and structured logging.
 *
 * Emits structured JSON logs for each pipeline stage, enabling
 * monitoring, debugging, and performance analysis.
 *
 * This interface belongs to the Domain layer — implementations live in the Infrastructure layer.
 */
export interface PipelineLogger {
  /**
   * Log a pipeline stage execution result.
   *
   * @param stage - The pipeline stage identifier.
   * @param data - Structured data about the stage execution.
   */
  logStage(stage: PipelineStage, data: StageLogEntry): void;

  /**
   * Log a general informational message within the pipeline context.
   *
   * @param message - The log message.
   * @param context - Optional structured context data.
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Log a warning message.
   *
   * @param message - The warning message.
   * @param context - Optional structured context data.
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Log an error message.
   *
   * @param message - The error message.
   * @param error - Optional error object.
   * @param context - Optional structured context data.
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}
