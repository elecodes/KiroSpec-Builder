import { z } from "zod";

/**
 * Error severity levels for pipeline operations.
 */
export const ErrorSeverityEnum = z.enum(["fatal", "error", "warning"]);

export type ErrorSeverity = z.infer<typeof ErrorSeverityEnum>;

/**
 * Error category classification for structured error responses.
 */
export const ErrorCategoryEnum = z.enum([
  "validation",
  "llm",
  "network",
  "filesystem",
  "configuration",
  "pipeline",
]);

export type ErrorCategory = z.infer<typeof ErrorCategoryEnum>;

/**
 * Schema for individual field-level validation errors.
 */
export const ValidationErrorDetailSchema = z.object({
  path: z.string(),
  expected: z.string(),
  received: z.string(),
  message: z.string(),
});

export type ValidationErrorDetail = z.infer<typeof ValidationErrorDetailSchema>;

/**
 * Schema for structured error responses returned by the system.
 * All pipeline errors conform to this shape for consistent handling.
 */
export const ErrorResponseSchema = z.object({
  code: z.string(),
  category: ErrorCategoryEnum,
  message: z.string(),
  severity: ErrorSeverityEnum.default("error"),
  details: z.array(ValidationErrorDetailSchema).optional(),
  timestamp: z.string().datetime(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Custom error class for validation failures within the pipeline.
 */
export class ValidationError extends Error {
  public readonly code = "VALIDATION_ERROR";
  public readonly category: ErrorCategory = "validation";
  public readonly details: ValidationErrorDetail[];

  constructor(message: string, details: ValidationErrorDetail[]) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      severity: "error",
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Custom error class for pipeline-level failures (LLM, export, etc.).
 */
export class PipelineError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly stage: string;

  constructor(message: string, code: string, category: ErrorCategory, stage: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
    this.category = category;
    this.stage = stage;
  }

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      severity: "fatal",
      timestamp: new Date().toISOString(),
    };
  }
}
