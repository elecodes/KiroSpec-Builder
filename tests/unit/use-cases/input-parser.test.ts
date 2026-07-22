import { describe, it, expect } from "vitest";
import { ZodInputParser } from "../../../src/use-cases/input-parser.js";
import { ValidationError } from "../../../src/domain/schemas/error.schema.js";

describe("ZodInputParser", () => {
  const parser = new ZodInputParser();

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

  describe("parse()", () => {
    it("should return validated RawInput for valid payload", () => {
      const result = parser.parse(validInput);
      expect(result.id).toBe(validInput.id);
      expect(result.content).toBe(validInput.content);
      expect(result.format).toBe("text");
      expect(result.metadata.language).toBe("en");
    });

    it("should throw ValidationError for empty payload", () => {
      expect(() => parser.parse({})).toThrow(ValidationError);
      try {
        parser.parse({});
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const ve = error as ValidationError;
        expect(ve.details.length).toBeGreaterThanOrEqual(1);
        expect(ve.details.some((d) => d.path === "content" || d.path === "id")).toBe(true);
      }
    });

    it("should throw ValidationError for empty content", () => {
      expect(() => parser.parse({ ...validInput, content: "" })).toThrow(ValidationError);
      try {
        parser.parse({ ...validInput, content: "" });
      } catch (error) {
        const ve = error as ValidationError;
        expect(ve.details.some((d) => d.path === "content")).toBe(true);
      }
    });

    it("should throw ValidationError for oversized content", () => {
      expect(() =>
        parser.parse({ ...validInput, content: "x".repeat(100_001) }),
      ).toThrow(ValidationError);
      try {
        parser.parse({ ...validInput, content: "x".repeat(100_001) });
      } catch (error) {
        const ve = error as ValidationError;
        expect(ve.details.some((d) => d.path === "content")).toBe(true);
      }
    });

    it("should throw ValidationError for invalid format enum", () => {
      expect(() => parser.parse({ ...validInput, format: "xml" })).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError for invalid UUID", () => {
      expect(() =>
        parser.parse({ ...validInput, id: "not-a-uuid" }),
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError for null input", () => {
      expect(() => parser.parse(null)).toThrow(ValidationError);
    });

    it("should throw ValidationError for undefined input", () => {
      expect(() => parser.parse(undefined)).toThrow(ValidationError);
    });

    it("should accept all valid format values", () => {
      const formats = ["text", "markdown", "json", "voice-transcription"] as const;
      for (const format of formats) {
        const result = parser.parse({ ...validInput, format });
        expect(result.format).toBe(format);
      }
    });

    it("should preserve metadata source when provided", () => {
      const result = parser.parse(validInput);
      expect(result.metadata.source).toBe("voice-note");
    });

    it("should default language to 'en' when not provided", () => {
      const result = parser.parse({
        ...validInput,
        metadata: { timestamp: "2024-06-15T10:30:00.000Z" },
      });
      expect(result.metadata.language).toBe("en");
    });
  });

  describe("normalize()", () => {
    it("should trim leading and trailing whitespace", () => {
      const input = { ...validInput, content: "  hello world  " };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      expect(result).toBe("hello world");
    });

    it("should normalize \\r\\n to \\n", () => {
      const input = { ...validInput, content: "line1\r\nline2\r\nline3" };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      expect(result).toBe("line1\nline2\nline3");
    });

    it("should normalize stray \\r to \\n", () => {
      const input = { ...validInput, content: "line1\rline2" };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      expect(result).toBe("line1\nline2");
    });

    it("should collapse multiple spaces into one", () => {
      const input = { ...validInput, content: "hello    world     test" };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      expect(result).toBe("hello world test");
    });

    it("should collapse 3+ newlines into 2", () => {
      const input = { ...validInput, content: "para1\n\n\n\npara2" };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      expect(result).toBe("para1\n\npara2");
    });

    it("should preserve double newlines (paragraph breaks)", () => {
      const input = { ...validInput, content: "para1\n\npara2" };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      expect(result).toBe("para1\n\npara2");
    });

    it("should remove null bytes", () => {
      const input = { ...validInput, content: "hello\x00world" };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      expect(result).toBe("helloworld");
    });

    it("should remove control characters but keep tabs", () => {
      const input = { ...validInput, content: "hello\tworld\x01test" };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      // \t should be collapsed as whitespace, \x01 removed
      expect(result).toContain("hello");
      expect(result).toContain("world");
      expect(result).not.toContain("\x01");
    });

    it("should handle already-clean input unchanged", () => {
      const input = { ...validInput, content: "This is clean text." };
      const parsed = parser.parse(input);
      const result = parser.normalize(parsed);
      expect(result).toBe("This is clean text.");
    });
  });
});
