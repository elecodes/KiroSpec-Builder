import type { z } from "zod";
import {
  DesignDocumentSchema,
  type DesignDocument,
} from "../domain/schemas/design.schema.js";
import type { RequirementsDocument } from "../domain/schemas/requirement.schema.js";
import { PipelineError } from "../domain/schemas/error.schema.js";
import type { LLMProvider, GenerationOptions } from "../domain/ports/llm-provider.port.js";

/**
 * DesignBuilderUseCase — Generates a technical design document from requirements.
 *
 * Analyzes requirements to extract domain entities, their relationships,
 * TypeScript interfaces, and architecture diagrams (Mermaid syntax).
 */
export class DesignBuilderUseCase {
  constructor(private readonly llmProvider: LLMProvider) {}

  /**
   * Execute the design generation pipeline.
   *
   * @param requirements - The validated requirements document.
   * @param options - Optional generation parameters for the LLM call.
   * @returns A validated DesignDocument with entities, interfaces, and diagrams.
   * @throws PipelineError if the LLM call fails or output is invalid.
   */
  async execute(
    requirements: RequirementsDocument,
    options?: GenerationOptions,
  ): Promise<DesignDocument> {
    const prompt = this.buildPrompt(requirements);

    try {
      const result = await this.llmProvider.generateStructured<DesignDocument>(
        prompt,
        DesignDocumentSchema as z.ZodSchema<DesignDocument>,
        {
          temperature: 0.4,
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
        `Design generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "DESIGN_GENERATION_FAILED",
        "llm",
        "design",
      );
    }
  }

  /**
   * Build the prompt for design document generation.
   */
  private buildPrompt(requirements: RequirementsDocument): string {
    const requirementsSummary = requirements.requirements
      .map((r) => `- ${r.id}: ${r.title} (${r.earsPattern}) — "${r.statement}"`)
      .join("\n");

    return `You are a software architect designing a system based on the following requirements.

## Requirements

Title: ${requirements.title}
Overview: ${requirements.overview}

### Functional Requirements
${requirementsSummary}

## Your Task

Analyze these requirements and produce a technical design document that includes:

1. **Architecture Layers**: List the Clean Architecture layers used (e.g., Domain, Use Cases, Adapters, Infrastructure).

2. **Domain Entities**: Extract all domain entities mentioned or implied by the requirements. For each entity:
   - Name (PascalCase)
   - Description
   - Attributes (name, TypeScript type, required flag, optional description)
   - Relationships to other entities (target, type: one-to-one|one-to-many|many-to-many)

3. **Interfaces**: List the key TypeScript interfaces/ports that define boundaries between layers.

4. **Diagrams**:
   - A Mermaid **sequence diagram** showing the primary workflow/data flow
   - A Mermaid **class diagram** showing entity relationships

## Output Format

Return a JSON object with this exact structure:
{
  "title": "Design: <System Name>",
  "overview": "<Technical overview of the design approach>",
  "architectureLayers": ["Domain", "UseCases", "Adapters", "Infrastructure"],
  "entities": [
    {
      "name": "EntityName",
      "description": "What this entity represents",
      "attributes": [
        { "name": "id", "type": "string", "required": true, "description": "Unique identifier" }
      ],
      "relationships": [
        { "target": "OtherEntity", "type": "one-to-many", "description": "Contains many items" }
      ]
    }
  ],
  "interfaces": ["InterfaceName1", "InterfaceName2"],
  "diagrams": {
    "sequence": "sequenceDiagram\\n    participant A\\n    participant B\\n    A->>B: action",
    "classDiagram": "classDiagram\\n    class EntityName {\\n      +String id\\n    }"
  }
}

## Rules

- Entities should be derived directly from the requirements (not invented).
- Each entity must have at least one attribute.
- Relationships should reflect real domain associations.
- Mermaid diagrams must use valid Mermaid syntax.
- The sequence diagram should show the main happy-path workflow.
- The class diagram should show all entities and their relationships.
- Interfaces should represent Clean Architecture boundary contracts.`;
  }

  /**
   * System prompt for the design generation LLM call.
   */
  private getSystemPrompt(): string {
    return `You are a senior software architect specializing in Clean Architecture, Domain-Driven Design, and TypeScript. You ONLY output valid JSON matching the specified schema. You never include explanations, markdown formatting, or code fences — just the raw JSON object. Your designs enforce strict separation of concerns with dependency inversion.`;
  }
}
