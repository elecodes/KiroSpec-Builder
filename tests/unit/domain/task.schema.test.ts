import { describe, it, expect } from "vitest";
import {
  TaskSchema,
  TasksDocumentSchema,
  ArchLayerEnum,
  ComplexityEnum,
  validateTaskDependencyOrder,
} from "../../../src/domain/schemas/task.schema.js";


describe("ArchLayerEnum", () => {
  it("should accept all valid layers", () => {
    const layers = ["domain", "use-case", "adapter", "infrastructure"];
    for (const layer of layers) {
      expect(ArchLayerEnum.safeParse(layer).success).toBe(true);
    }
  });

  it("should reject invalid layer", () => {
    expect(ArchLayerEnum.safeParse("presentation").success).toBe(false);
  });
});

describe("ComplexityEnum", () => {
  it("should accept all valid complexities", () => {
    const complexities = ["low", "medium", "high"];
    for (const c of complexities) {
      expect(ComplexityEnum.safeParse(c).success).toBe(true);
    }
  });
});


describe("TaskSchema", () => {
  const validTask = {
    id: 1,
    title: "Project Scaffolding",
    description: "Initialize Node.js/TypeScript project.",
    layer: "infrastructure" as const,
    dependencies: [],
    acceptanceCriteria: ["npm test runs without errors"],
    estimatedComplexity: "low" as const,
  };

  it("should accept a valid task", () => {
    const result = TaskSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it("should default estimatedComplexity to 'medium'", () => {
    const { estimatedComplexity, ...without } = validTask;
    const result = TaskSchema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedComplexity).toBe("medium");
    }
  });

  it("should reject non-positive id", () => {
    expect(TaskSchema.safeParse({ ...validTask, id: 0 }).success).toBe(false);
    expect(TaskSchema.safeParse({ ...validTask, id: -1 }).success).toBe(false);
  });

  it("should reject empty acceptanceCriteria", () => {
    const result = TaskSchema.safeParse({
      ...validTask,
      acceptanceCriteria: [],
    });
    expect(result.success).toBe(false);
  });

  it("should validate layer enum strictly", () => {
    const result = TaskSchema.safeParse({
      ...validTask,
      layer: "domain",
    });
    expect(result.success).toBe(true);
  });
});


describe("TasksDocumentSchema", () => {
  const validDocument = {
    title: "Implementation Tasks",
    overview: "Tasks for building KiroSpec Builder.",
    tasks: [
      {
        id: 1,
        title: "Setup",
        description: "Project init",
        layer: "infrastructure" as const,
        dependencies: [],
        acceptanceCriteria: ["Project compiles"],
      },
      {
        id: 2,
        title: "Schemas",
        description: "Domain schemas",
        layer: "domain" as const,
        dependencies: [1],
        acceptanceCriteria: ["Schemas validate correctly"],
      },
    ],
  };

  it("should accept a valid document", () => {
    const result = TasksDocumentSchema.safeParse(validDocument);
    expect(result.success).toBe(true);
  });

  it("should reject empty tasks array", () => {
    const result = TasksDocumentSchema.safeParse({
      ...validDocument,
      tasks: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("validateTaskDependencyOrder", () => {
  it("should return true for valid topological ordering", () => {
    const tasks = [
      { id: 1, title: "A", description: "A", layer: "domain" as const, dependencies: [], acceptanceCriteria: ["x"] },
      { id: 2, title: "B", description: "B", layer: "domain" as const, dependencies: [1], acceptanceCriteria: ["x"] },
      { id: 3, title: "C", description: "C", layer: "domain" as const, dependencies: [1, 2], acceptanceCriteria: ["x"] },
    ];
    expect(validateTaskDependencyOrder(tasks)).toBe(true);
  });

  it("should return false when a task depends on a later-numbered task", () => {
    const tasks = [
      { id: 1, title: "A", description: "A", layer: "domain" as const, dependencies: [2], acceptanceCriteria: ["x"] },
      { id: 2, title: "B", description: "B", layer: "domain" as const, dependencies: [], acceptanceCriteria: ["x"] },
    ];
    expect(validateTaskDependencyOrder(tasks)).toBe(false);
  });

  it("should return false when a task depends on itself", () => {
    const tasks = [
      { id: 1, title: "A", description: "A", layer: "domain" as const, dependencies: [1], acceptanceCriteria: ["x"] },
    ];
    expect(validateTaskDependencyOrder(tasks)).toBe(false);
  });

  it("should return true for empty dependencies", () => {
    const tasks = [
      { id: 1, title: "A", description: "A", layer: "domain" as const, dependencies: [], acceptanceCriteria: ["x"] },
    ];
    expect(validateTaskDependencyOrder(tasks)).toBe(true);
  });
});
