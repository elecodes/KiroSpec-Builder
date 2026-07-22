import { z } from "zod";

/**
 * Schema for input metadata attached to raw user submissions.
 */
export const InputMetadataSchema = z.object({
  source: z.string().optional(),
  timestamp: z.string().datetime(),
  language: z.string().default("en"),
});

export type InputMetadata = z.infer<typeof InputMetadataSchema>;

/**
 * Supported input format types for the KiroSpec Builder pipeline.
 */
export const InputFormatEnum = z.enum(["text", "markdown", "json", "voice-transcription"]);

export type InputFormat = z.infer<typeof InputFormatEnum>;

/**
 * Schema for unstructured raw input before processing.
 * Validates the incoming payload structure and enforces content size limits.
 */
export const RawInputSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1, "Content is required").max(100_000, "Content exceeds maximum length"),
  format: InputFormatEnum,
  metadata: InputMetadataSchema,
});

export type RawInput = z.infer<typeof RawInputSchema>;
