import { describe, it, expect } from "vitest";
import {
  ErrorResponseSchema,
  ValidationError,
  PipelineError,
} from "../../../src/domain/schemas/error.schema.js";

describe("ErrorResponseSchema", () => {
  const validErrorResponse = {
    code: "VALIDATION_ERROR",
    category: "validation" as const,
    message: "Input validation failed",
    severity: "error" as const,
    details: [
      {
        path: "content",
        expected: "string (min 1)",
        received: "undefined",
        message: "Required",
      },
    ],
    timestamp: "2024-06-15T10:30:00.000Z",
  };

  it("should accept a valid error response", () => {
    const result = ErrorResponseSchema.safeParse(validErrorResponse);
    expect(result.success).toBe(true);
  });

  it("should accept error response without details", () => {
    const { details, ...withoutDetails } = validErrorResponse;
    const result = ErrorResponseSchema.safeParse(withoutDetails);
    expect(result.success).toBe(true);
  });

  it("should reject invalid category", () => {
    const result = ErrorResponseSchema.safeParse({
      ...validErrorResponse,
      category: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid severity", () => {
    const result = ErrorResponseSchema.safeParse({
      ...validErrorResponse,
      severity: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("should default severity to 'error'", () => {
    const { severity, ...withoutSeverity } = validErrorResponse;
    const result = ErrorResponseSchema.safeParse(withoutSeverity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severity).toBe("error");
    }
  });

  it("should reject invalid timestamp format", () => {
    const result = ErrorResponseSchema.safeParse({
      ...validErrorResponse,
      timestamp: "yesterday",
    });
    expect(result.success).toBe(false);
  });
});

describe("ValidationError", () => {
  it("should create a ValidationError with details", () => {
    const details = [
      {
        path: "content",
        expected: "string",
        received: "undefined",
        message: "Required",
      },
    ];
    const error = new ValidationError("Validation failed", details);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ValidationError");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.category).toBe("validation");
    expect(error.details).toEqual(details);
  });

  it("should produce a valid ErrorResponse via toErrorResponse()", () => {
    const error = new ValidationError("Test error", [
      {
        path: "id",
        expected: "uuid",
        received: "abc",
        message: "Invalid UUID",
      },
    ]);

    const response = error.toErrorResponse();
    const result = ErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("VALIDATION_ERROR");
      expect(result.data.category).toBe("validation");
      expect(result.data.details).toHaveLength(1);
    }
  });
});

describe("PipelineError", () => {
  it("should create a PipelineError with stage information", () => {
    const error = new PipelineError(
      "LLM call failed",
      "LLM_UNAVAILABLE",
      "llm",
      "requirements",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("PipelineError");
    expect(error.code).toBe("LLM_UNAVAILABLE");
    expect(error.category).toBe("llm");
    expect(error.stage).toBe("requirements");
  });

  it("should produce a valid ErrorResponse via toErrorResponse()", () => {
    const error = new PipelineError(
      "File write failed",
      "EXPORT_FAILED",
      "filesystem",
      "export",
    );

    const response = error.toErrorResponse();
    const result = ErrorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("EXPORT_FAILED");
      expect(result.data.category).toBe("filesystem");
      expect(result.data.severity).toBe("fatal");
    }
  });
});
