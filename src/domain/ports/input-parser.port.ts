import type { RawInput } from "../schemas/raw-input.schema.js";

/**
 * Port interface for raw input parsing and normalization.
 *
 * Responsible for validating incoming payloads against the RawInputSchema
 * and normalizing content for downstream LLM processing.
 *
 * This interface belongs to the Domain layer — implementations live in the Use Case layer.
 */
export interface InputParser {
  /**
   * Parse and validate raw input against the RawInputSchema.
   *
   * @param raw - The unvalidated input payload (unknown type).
   * @returns A fully validated RawInput object.
   * @throws ValidationError if the input fails schema validation.
   */
  parse(raw: unknown): RawInput;

  /**
   * Normalize validated input content for LLM consumption.
   * Operations include:
   * - Trimming leading/trailing whitespace
   * - Collapsing multiple consecutive spaces into one
   * - Normalizing line endings (\r\n → \n)
   * - Removing null bytes and control characters
   *
   * @param input - A validated RawInput object.
   * @returns The normalized content string ready for LLM processing.
   */
  normalize(input: RawInput): string;
}
