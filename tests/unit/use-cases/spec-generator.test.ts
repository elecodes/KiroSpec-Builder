import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpecGeneratorUseCase } from "../../../src/use-cases/spec-generator.use-case.js";
import { EarsParserUseCase } from "../../../src/use-cases/ears-parser.use-case.js";
import { DesignBuilderUseCase } from "../../../src/use-cases/design-builder.use-case.js";
import { TaskDecomposerUseCase } from "../../../src/use-cases/task-decomposer.use-case.js";
import { ValidationError } from "../../../src/domain/schemas/error.schema.js";
import type { InputParser } from "../../../src/domain/ports/input-parser.port.js";
import type { SpecExporter } from "../../../src/domain/ports/spec-exporter.port.js";
import type { PipelineLogger } from "../../../src/domain/ports/pipeline-logger.port.js";


describe("SpecGeneratorUseCase", () => {
  let mockInputParser: InputParser;
  let mockEarsParser: EarsParserUseCase;
  let mockDesignBuilder: DesignBuilderUseCase;
  let mockTaskDecomposer: TaskDecomposerUseCase;
  let mockExporter: SpecExporter;
  let mockLogger: PipelineLogger;
  let specGenerator: SpecGeneratorUseCase;

  const validRawInput = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    content: "Build an export feature",
    format: "text" as const,
    metadata: { timestamp: "2024-06-15T10:30:00.000Z", language: "en" },
  };


  const mockRequirementsDoc = {
    title: "Requirements",
    overview: "Overview",
    requirements: [{
      id: "FR-1.1", title: "Export", earsPattern: "ubiquitous" as const,
      statement: "The system SHALL export data.",
      acceptanceCriteria: [{ id: "AC-1", description: "Data exported.", testable: true }],
      priority: "must" as const,
    }],
  };

  const mockDesignDoc = {
    title: "Design", overview: "Design overview",
    architectureLayers: ["Domain", "UseCases"],
    entities: [{
      name: "Export", description: "Export entity",
      attributes: [{ name: "id", type: "string", required: true }],
      relationships: [],
    }],
    interfaces: ["ExportService"],
    diagrams: { sequence: "sequenceDiagram\n  A->>B: x", classDiagram: "classDiagram\n  class A" },
  };


  const mockTasksDoc = {
    title: "Tasks", overview: "Tasks overview",
    tasks: [{
      id: 1, title: "Task 1", description: "Do thing",
      layer: "domain" as const, dependencies: [],
      acceptanceCriteria: ["Done"], estimatedComplexity: "low" as const,
    }],
  };

  beforeEach(() => {
    mockInputParser = {
      parse: vi.fn().mockReturnValue(validRawInput),
      normalize: vi.fn().mockReturnValue("Build an export feature"),
    };
    mockEarsParser = { execute: vi.fn().mockResolvedValue(mockRequirementsDoc) } as any;
    mockDesignBuilder = { execute: vi.fn().mockResolvedValue(mockDesignDoc) } as any;
    mockTaskDecomposer = { execute: vi.fn().mockResolvedValue(mockTasksDoc) } as any;
    mockExporter = {
      exportRequirements: vi.fn().mockResolvedValue({ filePath: "/out/requirements.md", sizeBytes: 100 }),
      exportDesign: vi.fn().mockResolvedValue({ filePath: "/out/design.md", sizeBytes: 200 }),
      exportTasks: vi.fn().mockResolvedValue({ filePath: "/out/tasks.md", sizeBytes: 150 }),
    };
    mockLogger = {
      logStage: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };


    specGenerator = new SpecGeneratorUseCase(
      mockInputParser,
      mockEarsParser,
      mockDesignBuilder,
      mockTaskDecomposer,
      mockExporter,
      mockLogger,
    );
  });

  it("should execute full pipeline successfully", async () => {
    const result = await specGenerator.execute(validRawInput, "/out");

    expect(result.success).toBe(true);
    expect(result.requirements).toEqual(mockRequirementsDoc);
    expect(result.design).toEqual(mockDesignDoc);
    expect(result.tasks).toEqual(mockTasksDoc);
    expect(result.exports).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("should call all pipeline stages in order", async () => {
    await specGenerator.execute(validRawInput, "/out");

    expect(mockInputParser.parse).toHaveBeenCalledWith(validRawInput);
    expect(mockInputParser.normalize).toHaveBeenCalledWith(validRawInput);
    expect(mockEarsParser.execute).toHaveBeenCalledWith("Build an export feature");
    expect(mockDesignBuilder.execute).toHaveBeenCalledWith(mockRequirementsDoc);
    expect(mockTaskDecomposer.execute).toHaveBeenCalledWith(mockRequirementsDoc, mockDesignDoc);
    expect(mockExporter.exportRequirements).toHaveBeenCalled();
    expect(mockExporter.exportDesign).toHaveBeenCalled();
    expect(mockExporter.exportTasks).toHaveBeenCalled();
  });


  it("should log each stage", async () => {
    await specGenerator.execute(validRawInput, "/out");

    expect(mockLogger.logStage).toHaveBeenCalledWith("ingestion", expect.objectContaining({ success: true }));
    expect(mockLogger.logStage).toHaveBeenCalledWith("requirements", expect.objectContaining({ success: true }));
    expect(mockLogger.logStage).toHaveBeenCalledWith("design", expect.objectContaining({ success: true }));
    expect(mockLogger.logStage).toHaveBeenCalledWith("tasks", expect.objectContaining({ success: true }));
    expect(mockLogger.logStage).toHaveBeenCalledWith("export", expect.objectContaining({ success: true }));
  });

  it("should stop pipeline and return partial result on ingestion failure", async () => {
    vi.mocked(mockInputParser.parse).mockImplementation(() => {
      throw new ValidationError("Invalid", [{ path: "content", expected: "string", received: "undefined", message: "Required" }]);
    });

    const result = await specGenerator.execute({}, "/out");

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].stage).toBe("ingestion");
    expect(result.requirements).toBeUndefined();
    expect(mockEarsParser.execute).not.toHaveBeenCalled();
  });


  it("should stop pipeline and return partial result on requirements failure", async () => {
    vi.mocked(mockEarsParser.execute).mockRejectedValue(new Error("LLM timeout"));

    const result = await specGenerator.execute(validRawInput, "/out");

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].stage).toBe("requirements");
    expect(result.requirements).toBeUndefined();
    expect(result.design).toBeUndefined();
    expect(mockDesignBuilder.execute).not.toHaveBeenCalled();
  });

  it("should stop pipeline on design failure but keep requirements", async () => {
    vi.mocked(mockDesignBuilder.execute).mockRejectedValue(new Error("Design failed"));

    const result = await specGenerator.execute(validRawInput, "/out");

    expect(result.success).toBe(false);
    expect(result.requirements).toEqual(mockRequirementsDoc);
    expect(result.design).toBeUndefined();
    expect(result.errors[0].stage).toBe("design");
  });

  it("should stop pipeline on task decomposition failure", async () => {
    vi.mocked(mockTaskDecomposer.execute).mockRejectedValue(new Error("Task failed"));

    const result = await specGenerator.execute(validRawInput, "/out");

    expect(result.success).toBe(false);
    expect(result.requirements).toEqual(mockRequirementsDoc);
    expect(result.design).toEqual(mockDesignDoc);
    expect(result.tasks).toBeUndefined();
    expect(result.errors[0].stage).toBe("tasks");
  });


  it("should report export failure but keep all generated docs", async () => {
    vi.mocked(mockExporter.exportRequirements).mockRejectedValue(new Error("Disk full"));

    const result = await specGenerator.execute(validRawInput, "/out");

    expect(result.success).toBe(false);
    expect(result.requirements).toEqual(mockRequirementsDoc);
    expect(result.design).toEqual(mockDesignDoc);
    expect(result.tasks).toEqual(mockTasksDoc);
    expect(result.errors[0].stage).toBe("export");
  });

  it("should log completion with summary info", async () => {
    await specGenerator.execute(validRawInput, "/out");

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Pipeline completed",
      expect.objectContaining({ success: true, errorCount: 0 }),
    );
  });

  it("should log error when a stage fails", async () => {
    vi.mocked(mockEarsParser.execute).mockRejectedValue(new Error("Oops"));

    await specGenerator.execute(validRawInput, "/out");

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("requirements"),
      expect.any(Error),
      expect.objectContaining({ stage: "requirements" }),
    );
  });
});
