import { describe, it, expect } from "vitest";
import { RawInputSchema } from "../../../src/domain/schemas/raw-input.schema.js";

describe("RawInputSchema", () => {
  const validInput = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    content: "Build a feature that lets users export their data as CSV",
    format: "text" as const,
    metadata: {
      source: "voice-note",
      timestamp: "2024-06-15T10:30:00.000Z",
      language: "en",
    },
  };

  it("should accept valid input", () => {
    const result = RawInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(validInput.id);
      expect(result.data.content).toBe(validInput.content);
      expect(result.data.format).toBe("text");
    }
  });

  it("should accept valid markdown format", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      format: "markdown",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid voice-transcription format", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      format: "voice-transcription",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid json format", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      format: "json",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty content", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      content: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("content");
    }
  });

  it("should reject content exceeding 100,000 characters", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      content: "x".repeat(100_001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.path).toContain("content");
      expect(issue.code).toBe("too_big");
    }
  });

  it("should reject invalid UUID for id", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      id: "not-a-valid-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("id");
    }
  });

  it("should reject invalid format enum value", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      format: "xml",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("format");
    }
  });

  it("should reject missing required fields", () => {
    const result = RawInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("should reject invalid timestamp in metadata", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      metadata: {
        ...validInput.metadata,
        timestamp: "not-a-datetime",
      },
    });
    expect(result.success).toBe(false);
  });

  it("should default language to 'en' when not provided", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      metadata: {
        timestamp: "2024-06-15T10:30:00.000Z",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.language).toBe("en");
    }
  });

  it("should allow optional source in metadata", () => {
    const result = RawInputSchema.safeParse({
      ...validInput,
      metadata: {
        timestamp: "2024-06-15T10:30:00.000Z",
        language: "es",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.source).toBeUndefined();
      expect(result.data.metadata.language).toBe("es");
    }
  });
});
