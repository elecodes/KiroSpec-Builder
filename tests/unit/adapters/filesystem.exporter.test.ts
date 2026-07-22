import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileSystemExporter } from "../../../src/adapters/exporters/filesystem.exporter.js";
import type { RequirementsDocument } from "../../../src/domain/schemas/requirement.schema.js";
import type { DesignDocument } from "../../../src/domain/schemas/design.schema.js";
import type { TasksDocument } from "../../../src/domain/schemas/task.schema.js";

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { mkdir, writeFile } from "node:fs/promises";

describe("FileSystemExporter", () => {
  let exporter: FileSystemExporter;

  const mockRequirements: RequirementsDocument = {
    title: "Requirements: Test Feature",
    overview: "Overview of test feature requirements.",
    requirements: [
      {
        id: "FR-1.1",
        title: "Input Acceptance",
        earsPattern: "ubiquitous",
        statement: "The system SHALL accept text input.",
        acceptanceCriteria: [
          { id: "AC-1.1.1", description: "Text input accepted without error.", testable: true },
          { id: "AC-1.1.2", description: "JSON input accepted without error.", testable: true },
        ],
        priority: "must",
      },
      {
        id: "FR-1.2",
        title: "Error Handling",
        earsPattern: "unwanted-behavior",
        statement: "IF input is empty, THEN the system SHALL return an error.",
        acceptanceCriteria: [
          { id: "AC-1.2.1", description: "Empty input returns ValidationError.", testable: true },
        ],
        priority: "must",
      },
    ],
  };

  const mockDesign: DesignDocument = {
    title: "Design: Test Feature",
    overview: "Technical design for test feature.",
    architectureLayers: ["Domain", "UseCases", "Adapters", "Infrastructure"],
    entities: [
      {
        name: "TestEntity",
        description: "A test entity.",
        attributes: [
          { name: "id", type: "string", required: true, description: "Unique ID" },
          { name: "value", type: "number", required: false },
        ],
        relationships: [
          { target: "OtherEntity", type: "one-to-many", description: "Has many" },
        ],
      },
    ],
    interfaces: ["TestService", "TestRepository"],
    diagrams: {
      sequence: "sequenceDiagram\n    A->>B: doThing()",
      classDiagram: "classDiagram\n    class TestEntity {\n      +String id\n    }",
    },
  };


  const mockTasks: TasksDocument = {
    title: "Tasks: Test Feature",
    overview: "Implementation plan for test feature.",
    tasks: [
      {
        id: 1,
        title: "Define schema",
        description: "Create Zod schema.",
        layer: "domain",
        dependencies: [],
        acceptanceCriteria: ["Schema validates", "Types inferred"],
        estimatedComplexity: "low",
      },
      {
        id: 2,
        title: "Implement service",
        description: "Business logic.",
        layer: "use-case",
        dependencies: [1],
        acceptanceCriteria: ["Service works"],
        estimatedComplexity: "medium",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    exporter = new FileSystemExporter();
  });


  describe("exportRequirements()", () => {
    it("should create output directory", async () => {
      await exporter.exportRequirements(mockRequirements, "/output");
      expect(mkdir).toHaveBeenCalledWith("/output", { recursive: true });
    });

    it("should write requirements.md file", async () => {
      await exporter.exportRequirements(mockRequirements, "/output");
      expect(writeFile).toHaveBeenCalledTimes(1);
      const [filePath] = vi.mocked(writeFile).mock.calls[0];
      expect(filePath).toContain("requirements.md");
    });

    it("should return ExportResult with file path and size", async () => {
      const result = await exporter.exportRequirements(mockRequirements, "/output");
      expect(result.filePath).toContain("requirements.md");
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it("should include EARS statements in output", async () => {
      await exporter.exportRequirements(mockRequirements, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("The system SHALL accept text input.");
      expect(content).toContain("IF input is empty, THEN the system SHALL return an error.");
    });

    it("should include acceptance criteria as checkboxes", async () => {
      await exporter.exportRequirements(mockRequirements, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("- [ ] Text input accepted without error.");
      expect(content).toContain("- [ ] JSON input accepted without error.");
    });

    it("should include requirement IDs and titles", async () => {
      await exporter.exportRequirements(mockRequirements, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("FR-1.1");
      expect(content).toContain("Input Acceptance");
      expect(content).toContain("FR-1.2");
    });
  });


  describe("exportDesign()", () => {
    it("should write design.md file", async () => {
      await exporter.exportDesign(mockDesign, "/output");
      const [filePath] = vi.mocked(writeFile).mock.calls[0];
      expect(filePath).toContain("design.md");
    });

    it("should include Mermaid code blocks", async () => {
      await exporter.exportDesign(mockDesign, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("```mermaid");
      expect(content).toContain("sequenceDiagram");
      expect(content).toContain("classDiagram");
    });

    it("should include entity attributes table", async () => {
      await exporter.exportDesign(mockDesign, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("TestEntity");
      expect(content).toContain("`string`");
      expect(content).toContain("Unique ID");
    });

    it("should include architecture layers", async () => {
      await exporter.exportDesign(mockDesign, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("Domain");
      expect(content).toContain("Infrastructure");
    });

    it("should include interfaces list", async () => {
      await exporter.exportDesign(mockDesign, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("`TestService`");
      expect(content).toContain("`TestRepository`");
    });

    it("should include relationships", async () => {
      await exporter.exportDesign(mockDesign, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("OtherEntity");
      expect(content).toContain("one-to-many");
    });
  });


  describe("exportTasks()", () => {
    it("should write tasks.md file", async () => {
      await exporter.exportTasks(mockTasks, "/output");
      const [filePath] = vi.mocked(writeFile).mock.calls[0];
      expect(filePath).toContain("tasks.md");
    });

    it("should include task numbers and titles", async () => {
      await exporter.exportTasks(mockTasks, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("Task 1: Define schema");
      expect(content).toContain("Task 2: Implement service");
    });

    it("should include layer and dependencies", async () => {
      await exporter.exportTasks(mockTasks, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("domain");
      expect(content).toContain("use-case");
      expect(content).toContain("Dependencies: None");
      expect(content).toContain("[1]");
    });

    it("should include acceptance criteria as checkboxes", async () => {
      await exporter.exportTasks(mockTasks, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("- [ ] Schema validates");
      expect(content).toContain("- [ ] Types inferred");
      expect(content).toContain("- [ ] Service works");
    });

    it("should include complexity", async () => {
      await exporter.exportTasks(mockTasks, "/output");
      const content = vi.mocked(writeFile).mock.calls[0][1].toString();
      expect(content).toContain("low");
      expect(content).toContain("medium");
    });
  });

  describe("error handling", () => {
    it("should throw PipelineError when writeFile fails", async () => {
      vi.mocked(writeFile).mockRejectedValue(new Error("EACCES"));

      await expect(
        exporter.exportRequirements(mockRequirements, "/readonly"),
      ).rejects.toThrow();
    });
  });
});
