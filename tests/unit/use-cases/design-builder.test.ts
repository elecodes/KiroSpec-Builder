import { describe, it, expect, vi, beforeEach } from "vitest";
import { DesignBuilderUseCase } from "../../../src/use-cases/design-builder.use-case.js";
import { PipelineError } from "../../../src/domain/schemas/error.schema.js";
import type { LLMProvider } from "../../../src/domain/ports/llm-provider.port.js";
import type { RequirementsDocument } from "../../../src/domain/schemas/requirement.schema.js";
import type { DesignDocument } from "../../../src/domain/schemas/design.schema.js";

describe("DesignBuilderUseCase", () => {
  let mockLLMProvider: LLMProvider;
  let designBuilder: DesignBuilderUseCase;

  const mockRequirements: RequirementsDocument = {
    title: "Requirements: Export Feature",
    overview: "Data export capabilities.",
    requirements: [
      {
        id: "FR-1.1",
        title: "CSV Export",
        earsPattern: "event-driven",
        statement: "WHEN the user clicks Export, the system SHALL generate a CSV file.",
        acceptanceCriteria: [
          { id: "AC-1.1.1", description: "CSV file is generated.", testable: true },
        ],
        priority: "must",
      },
      {
        id: "FR-1.2",
        title: "Export Validation",
        earsPattern: "unwanted-behavior",
        statement: "IF no data exists, THEN the system SHALL display an error.",
        acceptanceCriteria: [
          { id: "AC-1.2.1", description: "Error message shown for empty data.", testable: true },
        ],
        priority: "must",
      },
    ],
  };

  const validDesignDocument: DesignDocument = {
    title: "Design: Export Feature",
    overview: "Technical design for data export with Clean Architecture.",
    architectureLayers: ["Domain", "UseCases", "Adapters", "Infrastructure"],
    entities: [
      {
        name: "ExportRequest",
        description: "Represents a user's request to export data.",
        attributes: [
          { name: "id", type: "string", required: true, description: "Unique identifier" },
          { name: "format", type: "ExportFormat", required: true },
          { name: "userId", type: "string", required: true },
        ],
        relationships: [
          { target: "User", type: "many-to-many" as const, description: "Belongs to user" },
        ],
      },
    ],
    interfaces: ["ExportService", "DataProvider", "FileWriter"],
    diagrams: {
      sequence: "sequenceDiagram\n    participant User\n    participant ExportService\n    User->>ExportService: requestExport()\n    ExportService-->>User: CSV file",
      classDiagram: "classDiagram\n    class ExportRequest {\n      +String id\n      +String format\n    }",
    },
  };

  beforeEach(() => {
    mockLLMProvider = {
      name: "mock",
      generateStructured: vi.fn().mockResolvedValue(validDesignDocument),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    designBuilder = new DesignBuilderUseCase(mockLLMProvider);
  });

  it("should return a validated DesignDocument on success", async () => {
    const result = await designBuilder.execute(mockRequirements);

    expect(result.title).toBe("Design: Export Feature");
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe("ExportRequest");
    expect(result.interfaces).toContain("ExportService");
    expect(result.diagrams.sequence).toContain("sequenceDiagram");
    expect(result.diagrams.classDiagram).toContain("classDiagram");
  });

  it("should include requirements in the prompt", async () => {
    await designBuilder.execute(mockRequirements);

    const prompt = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][0];
    expect(prompt).toContain("FR-1.1");
    expect(prompt).toContain("CSV Export");
    expect(prompt).toContain("event-driven");
    expect(prompt).toContain("Export Validation");
  });

  it("should pass temperature 0.4 by default", async () => {
    await designBuilder.execute(mockRequirements);

    const options = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][2];
    expect(options?.temperature).toBe(0.4);
  });

  it("should allow option overrides", async () => {
    await designBuilder.execute(mockRequirements, { temperature: 0.8 });

    const options = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][2];
    expect(options?.temperature).toBe(0.8);
  });

  it("should throw PipelineError when LLM call fails", async () => {
    vi.mocked(mockLLMProvider.generateStructured).mockRejectedValue(
      new Error("Rate limit exceeded"),
    );

    await expect(designBuilder.execute(mockRequirements)).rejects.toThrow(PipelineError);
    try {
      await designBuilder.execute(mockRequirements);
    } catch (error) {
      const pe = error as PipelineError;
      expect(pe.code).toBe("DESIGN_GENERATION_FAILED");
      expect(pe.category).toBe("llm");
      expect(pe.stage).toBe("design");
      expect(pe.message).toContain("Rate limit exceeded");
    }
  });

  it("should re-throw PipelineError without wrapping", async () => {
    const originalError = new PipelineError(
      "Schema mismatch",
      "SCHEMA_ERROR",
      "validation",
      "design",
    );
    vi.mocked(mockLLMProvider.generateStructured).mockRejectedValue(originalError);

    await expect(designBuilder.execute(mockRequirements)).rejects.toBe(originalError);
  });

  it("should request Clean Architecture concepts in the prompt", async () => {
    await designBuilder.execute(mockRequirements);

    const prompt = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][0];
    expect(prompt).toContain("Architecture Layers");
    expect(prompt).toContain("Domain Entities");
    expect(prompt).toContain("Interfaces");
    expect(prompt).toContain("Mermaid");
    expect(prompt).toContain("sequence diagram");
    expect(prompt).toContain("class diagram");
  });

  it("should include system prompt for JSON-only output", async () => {
    await designBuilder.execute(mockRequirements);

    const options = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][2];
    expect(options?.systemPrompt).toContain("JSON");
    expect(options?.systemPrompt).toContain("Clean Architecture");
  });
});
