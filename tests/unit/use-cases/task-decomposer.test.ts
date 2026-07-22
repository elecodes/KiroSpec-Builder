import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskDecomposerUseCase } from "../../../src/use-cases/task-decomposer.use-case.js";
import { PipelineError } from "../../../src/domain/schemas/error.schema.js";
import type { LLMProvider } from "../../../src/domain/ports/llm-provider.port.js";
import type { RequirementsDocument } from "../../../src/domain/schemas/requirement.schema.js";
import type { DesignDocument } from "../../../src/domain/schemas/design.schema.js";
import type { TasksDocument } from "../../../src/domain/schemas/task.schema.js";

describe("TaskDecomposerUseCase", () => {
  let mockLLMProvider: LLMProvider;
  let taskDecomposer: TaskDecomposerUseCase;

  const mockRequirements: RequirementsDocument = {
    title: "Requirements: Export Feature",
    overview: "Data export capabilities.",
    requirements: [
      {
        id: "FR-1.1",
        title: "CSV Export",
        earsPattern: "event-driven",
        statement: "WHEN the user clicks Export, the system SHALL generate a CSV.",
        acceptanceCriteria: [
          { id: "AC-1.1.1", description: "CSV is generated.", testable: true },
        ],
        priority: "must",
      },
    ],
  };

  const mockDesign: DesignDocument = {
    title: "Design: Export Feature",
    overview: "Clean Architecture design.",
    architectureLayers: ["Domain", "UseCases", "Adapters", "Infrastructure"],
    entities: [
      {
        name: "ExportRequest",
        description: "Export request entity.",
        attributes: [{ name: "id", type: "string", required: true }],
        relationships: [],
      },
    ],
    interfaces: ["ExportService"],
    diagrams: {
      sequence: "sequenceDiagram\n  A->>B: export()",
      classDiagram: "classDiagram\n  class ExportRequest",
    },
  };

  const validTasksDocument: TasksDocument = {
    title: "Tasks: Export Feature",
    overview: "Implementation tasks for the export feature.",
    tasks: [
      {
        id: 1,
        title: "Define ExportRequest schema",
        description: "Create Zod schema for export requests.",
        layer: "domain",
        dependencies: [],
        acceptanceCriteria: ["Schema validates correctly"],
        estimatedComplexity: "low",
      },
      {
        id: 2,
        title: "Implement ExportService use case",
        description: "Business logic for CSV generation.",
        layer: "use-case",
        dependencies: [1],
        acceptanceCriteria: ["CSV is generated from valid input"],
        estimatedComplexity: "medium",
      },
      {
        id: 3,
        title: "Implement FileWriter adapter",
        description: "Write CSV to filesystem.",
        layer: "adapter",
        dependencies: [1, 2],
        acceptanceCriteria: ["File is written to disk"],
        estimatedComplexity: "low",
      },
    ],
  };

  beforeEach(() => {
    mockLLMProvider = {
      name: "mock",
      generateStructured: vi.fn().mockResolvedValue(validTasksDocument),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    taskDecomposer = new TaskDecomposerUseCase(mockLLMProvider);
  });

  it("should return a validated TasksDocument on success", async () => {
    const result = await taskDecomposer.execute(mockRequirements, mockDesign);

    expect(result.title).toBe("Tasks: Export Feature");
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0].layer).toBe("domain");
    expect(result.tasks[1].dependencies).toEqual([1]);
  });

  it("should include requirements and design in the prompt", async () => {
    await taskDecomposer.execute(mockRequirements, mockDesign);

    const prompt = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][0];
    expect(prompt).toContain("FR-1.1");
    expect(prompt).toContain("CSV Export");
    expect(prompt).toContain("ExportRequest");
    expect(prompt).toContain("ExportService");
  });

  it("should pass temperature 0.2 by default", async () => {
    await taskDecomposer.execute(mockRequirements, mockDesign);

    const options = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][2];
    expect(options?.temperature).toBe(0.2);
  });

  it("should auto-fix invalid dependency ordering (forward references)", async () => {
    const invalidOrderDoc: TasksDocument = {
      ...validTasksDocument,
      tasks: [
        {
          id: 1,
          title: "Task A",
          description: "First task",
          layer: "domain",
          dependencies: [2], // Invalid: references a later task
          acceptanceCriteria: ["Done"],
          estimatedComplexity: "low",
        },
        {
          id: 2,
          title: "Task B",
          description: "Second task",
          layer: "use-case",
          dependencies: [],
          acceptanceCriteria: ["Done"],
          estimatedComplexity: "low",
        },
      ],
    };
    vi.mocked(mockLLMProvider.generateStructured).mockResolvedValue(invalidOrderDoc);

    const result = await taskDecomposer.execute(mockRequirements, mockDesign);

    // Forward reference should be removed
    expect(result.tasks[0].dependencies).toEqual([]);
    expect(result.tasks[1].dependencies).toEqual([]);
  });

  it("should preserve valid dependency ordering", async () => {
    const result = await taskDecomposer.execute(mockRequirements, mockDesign);

    expect(result.tasks[0].dependencies).toEqual([]);
    expect(result.tasks[1].dependencies).toEqual([1]);
    expect(result.tasks[2].dependencies).toEqual([1, 2]);
  });

  it("should throw PipelineError when LLM call fails", async () => {
    vi.mocked(mockLLMProvider.generateStructured).mockRejectedValue(
      new Error("Connection refused"),
    );

    await expect(
      taskDecomposer.execute(mockRequirements, mockDesign),
    ).rejects.toThrow(PipelineError);

    try {
      await taskDecomposer.execute(mockRequirements, mockDesign);
    } catch (error) {
      const pe = error as PipelineError;
      expect(pe.code).toBe("TASK_DECOMPOSITION_FAILED");
      expect(pe.category).toBe("llm");
      expect(pe.stage).toBe("tasks");
    }
  });

  it("should re-throw PipelineError without wrapping", async () => {
    const originalError = new PipelineError(
      "Schema error",
      "VALIDATION_ERROR",
      "validation",
      "tasks",
    );
    vi.mocked(mockLLMProvider.generateStructured).mockRejectedValue(originalError);

    await expect(
      taskDecomposer.execute(mockRequirements, mockDesign),
    ).rejects.toBe(originalError);
  });

  it("should mention layer ordering in the prompt", async () => {
    await taskDecomposer.execute(mockRequirements, mockDesign);

    const prompt = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][0];
    expect(prompt).toContain("domain");
    expect(prompt).toContain("use-case");
    expect(prompt).toContain("adapter");
    expect(prompt).toContain("infrastructure");
    expect(prompt).toContain("Bottom-Up");
  });
});
