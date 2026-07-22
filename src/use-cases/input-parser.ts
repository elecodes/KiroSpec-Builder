import { RawInputSchema, type RawInput } from "../domain/schemas/raw-input.schema.js";
import { ValidationError, type ValidationErrorDetail } from "../domain/schemas/error.schema.js";
import type { InputParser } from "../domain/ports/input-parser.port.js";

/**
 * ZodInputParser — Use Case implementation of the InputParser port.
 *
 * Validates raw input payloads against RawInputSchema using Zod,
 * and normalizes content for downstream LLM processing.
 */
export class ZodInputParser implements InputParser {
  /**
   * Parse and validate raw input against the RawInputSchema.
   *
   * @param raw - The unvalidated input payload (unknown type).
   * @returns A fully validated RawInput object.
   * @throws ValidationError if the input fails schema validation.
   */
  parse(raw: unknown): RawInput {
    const result = RawInputSchema.safeParse(raw);

    if (!result.success) {
      const details: ValidationErrorDetail[] = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        expected: this.getExpectedType(issue),
        received: this.getReceivedValue(issue, raw),
        message: issue.message,
      }));

      throw new ValidationError(
        `Input validation failed: ${result.error.issues.length} error(s)`,
        details,
      );
    }

    return result.data;
  }

  /**
   * Normalize validated input content for LLM consumption.
   *
   * Operations:
   * - Trim leading/trailing whitespace
   * - Normalize line endings (\r\n → \n)
   * - Remove null bytes and control characters (except \n, \t)
   * - Collapse multiple consecutive spaces into one
   * - Collapse 3+ consecutive newlines into 2
   *
   * @param input - A validated RawInput object.
   * @returns The normalized content string ready for LLM processing.
   */
  normalize(input: RawInput): string {
    let content = input.content;

    // Normalize line endings: \r\n → \n, stray \r → \n
    content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Remove null bytes and non-printable control characters (keep \n, \t)
    content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // Collapse multiple consecutive spaces (not newlines) into single space
    content = content.replace(/[^\S\n]+/g, " ");

    // Collapse 3+ consecutive newlines into exactly 2 (preserve paragraph breaks)
    content = content.replace(/\n{3,}/g, "\n\n");

    // Trim leading/trailing whitespace
    content = content.trim();

    return content;
  }

  /**
   * Extract the expected type description from a Zod issue.
   */
  private getExpectedType(issue: { code: string; message: string }): string {
    switch (issue.code) {
      case "invalid_type":
        return (issue as { expected?: string }).expected ?? "unknown";
      case "too_small":
        return "string (min length)";
      case "too_big":
        return "string (within max length)";
      case "invalid_enum_value":
        return "valid enum value";
      case "invalid_string":
        return "valid string format";
      default:
        return "valid value";
    }
  }

  /**
   * Extract the received value description from a Zod issue.
   */
  private getReceivedValue(issue: { path: (string | number)[] }, raw: unknown): string {
    if (raw === null || raw === undefined) {
      return String(raw);
    }

    try {
      let value: unknown = raw;
      for (const segment of issue.path) {
        if (value !== null && typeof value === "object") {
          value = (value as Record<string, unknown>)[String(segment)];
        } else {
          return "undefined";
        }
      }
      if (value === undefined) return "undefined";
      if (value === null) return "null";
      if (typeof value === "string") return value.length > 50 ? `"${value.slice(0, 50)}..."` : `"${value}"`;
      return String(value);
    } catch {
      return "unknown";
    }
  }
}
