import type { z } from "zod";
import {
  TasksDocumentSchema,
  type TasksDocument,
  type Task,
  validateTaskDependencyOrder,
} from "../domain/schemas/task.schema.js";
import type { RequirementsDocument } from "../domain/schemas/requirement.schema.js";
import type { DesignDocument } from "../domain/schemas/design.schema.js";
import { PipelineError } from "../domain/schemas/error.schema.js";
import type { LLMProvider, GenerationOptions } from "../domain/ports/llm-provider.port.js";

/**
 * TaskDecomposerUseCase — Decomposes requirements and design into atomic tasks.
 *
 * Produces sequenced, testable implementation tasks with dependency validation.
 * Each task targets exactly one architectural layer and can be independently verified.
 */
export class TaskDecomposerUseCase {
  private static readonly MAX_REORDER_ATTEMPTS = 3;

  constructor(private readonly llmProvider: LLMProvider) {}

  /**
   * Execute the task decomposition pipeline.
   *
   * @param requirements - The validated requirements document.
   * @param design - The validated design document.
   * @param options - Optional generation parameters for the LLM call.
   * @returns A validated TasksDocument with properly ordered tasks.
   * @throws PipelineError if generation fails or dependency ordering is invalid.
   */
  async execute(
    requirements: RequirementsDocument,
    design: DesignDocument,
    options?: GenerationOptions,
  ): Promise<TasksDocument> {
    const prompt = this.buildPrompt(requirements, design);

    try {
      const result = await this.llmProvider.generateStructured<TasksDocument>(
        prompt,
        TasksDocumentSchema as z.ZodSchema<TasksDocument>,
        {
          temperature: 0.2,
          ...options,
          systemPrompt: options?.systemPrompt ?? this.getSystemPrompt(),
        },
      );

      // Validate dependency ordering
      const validatedResult = this.validateAndFixOrdering(result);
      return validatedResult;
    } catch (error) {
      if (error instanceof PipelineError) {
        throw error;
      }
      throw new PipelineError(
        `Task decomposition failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "TASK_DECOMPOSITION_FAILED",
        "llm",
        "tasks",
      );
    }
  }

  /**
   * Validate that task dependencies respect topological ordering.
   * If invalid, attempt to fix by removing forward-references.
   */
  private validateAndFixOrdering(document: TasksDocument): TasksDocument {
    if (validateTaskDependencyOrder(document.tasks)) {
      return document;
    }

    // Attempt to fix: remove any dependency that references a later or equal task
    const fixedTasks: Task[] = document.tasks.map((task) => ({
      ...task,
      dependencies: task.dependencies.filter((dep) => dep < task.id),
    }));

    if (validateTaskDependencyOrder(fixedTasks)) {
      return { ...document, tasks: fixedTasks };
    }

    // If still invalid after fix, throw
    throw new PipelineError(
      "Generated tasks have invalid dependency ordering that could not be automatically fixed",
      "INVALID_TASK_ORDERING",
      "pipeline",
      "tasks",
    );
  }

  /**
   * Build the prompt for task decomposition.
   */
  private buildPrompt(requirements: RequirementsDocument, design: DesignDocument): string {
    const requirementsList = requirements.requirements
      .map((r) => `- ${r.id}: ${r.title} (${r.earsPattern})`)
      .join("\n");

    const entitiesList = design.entities
      .map((e) => `- ${e.name}: ${e.description} (${e.attributes.length} attributes)`)
      .join("\n");

    const interfacesList = design.interfaces.join(", ");

    return `You are a technical lead decomposing a software project into implementation tasks.

## Context

### Requirements (${requirements.requirements.length} total)
${requirementsList}

### Design Entities (${design.entities.length} total)
${entitiesList}

### Key Interfaces
${interfacesList}

### Architecture Layers
${design.architectureLayers.join(", ")}

## Your Task

Decompose this project into atomic, sequential implementation tasks following these rules:

### Task Rules

1. **Atomic**: Each task should be completable in a single focused session (1-4 hours).
2. **Single Layer**: Each task targets exactly ONE architectural layer: "domain", "use-case", "adapter", or "infrastructure".
3. **Testable**: Each task must have at least one acceptance criterion that can be verified with an automated test.
4. **Sequential**: Tasks are numbered starting from 1. Dependencies must reference ONLY earlier-numbered tasks (lower IDs).
5. **Bottom-Up**: Start with domain layer (schemas, entities), then use cases, then adapters, then infrastructure.
6. **No Circular Dependencies**: Task N can only depend on tasks 1 through N-1.

### Ordering Strategy

- Phase 1: Domain schemas and interfaces (layer: "domain")
- Phase 2: Use case implementations (layer: "use-case")
- Phase 3: Adapter implementations (layer: "adapter")
- Phase 4: Infrastructure/entrypoints (layer: "infrastructure")
- Phase 5: Integration tasks (layer: "infrastructure")

## Output Format

Return a JSON object with this exact structure:
{
  "title": "Tasks: <Project Name>",
  "overview": "<Brief overview of the implementation plan>",
  "tasks": [
    {
      "id": 1,
      "title": "Short task title",
      "description": "Detailed description of what to implement",
      "layer": "domain|use-case|adapter|infrastructure",
      "dependencies": [],
      "acceptanceCriteria": ["Criterion 1 that can be tested", "Criterion 2"],
      "estimatedComplexity": "low|medium|high"
    }
  ]
}

## Rules

- Generate between 8 and 30 tasks depending on project complexity.
- Ensure EVERY requirement is covered by at least one task.
- Acceptance criteria should be specific and testable (not vague).
- Dependencies array contains task IDs (numbers) that must be completed first.
- A task with dependencies: [1, 3] means tasks 1 AND 3 must be done before this task.`;
  }

  /**
   * System prompt for the task decomposition LLM call.
   */
  private getSystemPrompt(): string {
    return `You are a senior technical lead who breaks down software projects into precise, atomic implementation tasks. You ONLY output valid JSON matching the specified schema. You never include explanations, markdown, or code fences — just the raw JSON object. Your task decompositions follow Clean Architecture principles and ensure correct dependency ordering.`;
  }
}
