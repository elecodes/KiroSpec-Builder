import type { z } from "zod";
import {
  RequirementsDocumentSchema,
  type RequirementsDocument,
  EARS_TEMPLATES,
} from "../domain/schemas/requirement.schema.js";
import { PipelineError } from "../domain/schemas/error.schema.js";
import type { LLMProvider, GenerationOptions } from "../domain/ports/llm-provider.port.js";

/**
 * EarsParserUseCase — Converts raw feature text into EARS-formatted requirements.
 *
 * Prompts the LLM with EARS pattern templates and examples, then validates
 * the structured output against RequirementsDocumentSchema.
 */
export class EarsParserUseCase {
  constructor(private readonly llmProvider: LLMProvider) {}

  /**
   * Execute the EARS parsing pipeline.
   *
   * @param normalizedInput - Pre-processed, normalized text content.
   * @param options - Optional generation parameters for the LLM call.
   * @returns A validated RequirementsDocument.
   * @throws PipelineError if the LLM call fails or output is invalid.
   */
  async execute(
    normalizedInput: string,
    options?: GenerationOptions,
  ): Promise<RequirementsDocument> {
    const prompt = this.buildPrompt(normalizedInput);

    try {
      const result = await this.llmProvider.generateStructured<RequirementsDocument>(
        prompt,
        RequirementsDocumentSchema as z.ZodSchema<RequirementsDocument>,
        {
          temperature: 0.3,
          ...options,
          systemPrompt: options?.systemPrompt ?? this.getSystemPrompt(),
        },
      );

      return result;
    } catch (error) {
      if (error instanceof PipelineError) {
        throw error;
      }
      throw new PipelineError(
        `EARS parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "EARS_PARSING_FAILED",
        "llm",
        "requirements",
      );
    }
  }

  /**
   * Build the full prompt for the LLM including EARS templates and examples.
   */
  private buildPrompt(input: string): string {
    return `You are a requirements engineering expert specializing in the EARS (Easy Approach to Requirements Syntax) methodology.

Analyze the following unstructured feature description and produce a structured requirements document.

## EARS Pattern Templates

Use EXACTLY these patterns for requirement statements:

1. **Ubiquitous** (always active): "${EARS_TEMPLATES["ubiquitous"]}"
2. **Event-Driven** (triggered by event): "${EARS_TEMPLATES["event-driven"]}"
3. **State-Driven** (active while condition holds): "${EARS_TEMPLATES["state-driven"]}"
4. **Optional** (feature-gated): "${EARS_TEMPLATES["optional"]}"
5. **Unwanted Behavior** (error handling): "${EARS_TEMPLATES["unwanted-behavior"]}"

## Rules

- Every requirement MUST use one of the above EARS patterns exactly.
- Every requirement MUST include the keyword "SHALL" to denote obligation.
- Each requirement ID MUST follow the pattern "FR-X.Y" (e.g., FR-1.1, FR-2.3).
- Each requirement MUST have at least one testable acceptance criterion.
- Acceptance criteria should use Given/When/Then or Given/Then format where possible.
- Group related requirements under a common FR-X prefix.
- Classify each requirement into exactly one EARS pattern category.
- Priority defaults to "must" unless the feature is clearly optional or nice-to-have.

## Output Format

Return a JSON object with this exact structure:
{
  "title": "Requirements: <Feature Name>",
  "overview": "<Brief description of the feature>",
  "requirements": [
    {
      "id": "FR-1.1",
      "title": "<Short descriptive title>",
      "earsPattern": "ubiquitous|event-driven|state-driven|optional|unwanted-behavior",
      "statement": "<Full EARS-formatted requirement statement>",
      "acceptanceCriteria": [
        {
          "id": "AC-1.1.1",
          "description": "Given <context>, when/then <expected outcome>.",
          "testable": true
        }
      ],
      "priority": "must|should|could|wont"
    }
  ]
}

## Input Feature Description

${input}`;
  }

  /**
   * System prompt establishing the LLM's role and constraints.
   */
  private getSystemPrompt(): string {
    return `You are a senior requirements engineer. You ONLY output valid JSON matching the specified schema. You never include explanations, markdown formatting, or code fences in your response — just the raw JSON object. Every requirement you write uses strict EARS syntax with the SHALL keyword.`;
  }
}
