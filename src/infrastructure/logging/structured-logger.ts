import type {
  PipelineLogger,
  PipelineStage,
  StageLogEntry,
} from "../../domain/ports/pipeline-logger.port.js";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * StructuredLogger — Infrastructure implementation of PipelineLogger.
 *
 * Emits structured JSON logs to stdout, compatible with Pino format.
 * Each log entry includes a timestamp, level, and message with optional context.
 *
 * When the real Pino library is available (after npm install), this can be
 * swapped for a Pino-backed implementation. This implementation provides
 * the same structured JSON interface without the dependency.
 */
export class StructuredLogger implements PipelineLogger {
  private readonly level: number;

  constructor(level: LogLevel = "info") {
    this.level = LOG_LEVEL_VALUES[level];
  }

  /**
   * Log a pipeline stage execution result.
   */
  logStage(stage: PipelineStage, data: StageLogEntry): void {
    const level = data.success ? "info" : "error";
    this.emit(level, `Pipeline stage: ${stage}`, {
      stage,
      ...data,
    });
  }

  /**
   * Log an informational message.
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, context);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, context);
  }

  /**
   * Log an error message.
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.emit("error", message, {
      ...context,
      ...(error && {
        err: {
          type: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    });
  }

  /**
   * Emit a structured JSON log entry to stdout.
   */
  private emit(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_VALUES[level] < this.level) {
      return;
    }

    const entry = {
      level: LOG_LEVEL_VALUES[level],
      time: Date.now(),
      msg,
      ...context,
    };

    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}
