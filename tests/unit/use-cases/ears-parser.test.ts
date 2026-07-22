import { describe, it, expect, vi, beforeEach } from "vitest";
import { EarsParserUseCase } from "../../../src/use-cases/ears-parser.use-case.js";
import { PipelineError } from "../../../src/domain/schemas/error.schema.js";
import type { LLMProvider } from "../../../src/domain/ports/llm-provider.port.js";
import type { RequirementsDocument } from "../../../src/domain/schemas/requirement.schema.js";

describe("EarsParserUseCase", () => {
  let mockLLMProvider: LLMProvider;
  let earsParser: EarsParserUseCase;

  const validRequirementsDocument: RequirementsDocument = {
    title: "Requirements: User Export Feature",
    overview: "Feature allowing users to export data as CSV.",
    requirements: [
      {
        id: "FR-1.1",
        title: "CSV Export",
        earsPattern: "event-driven",
        statement: "WHEN the user clicks Export, the system SHALL generate a CSV file.",
        acceptanceCriteria: [
          {
            id: "AC-1.1.1",
            description: "Given a user with data, when Export is clicked, then a CSV downloads.",
            testable: true,
          },
        ],
        priority: "must",
      },
      {
        id: "FR-1.2",
        title: "Format Selection",
        earsPattern: "optional",
        statement: "WHERE the export feature is enabled, the system SHALL provide format options.",
        acceptanceCriteria: [
          {
            id: "AC-1.2.1",
            description: "Given the export dialog, then format options are visible.",
            testable: true,
          },
        ],
        priority: "should",
      },
    ],
  };

  beforeEach(() => {
    mockLLMProvider = {
      name: "mock",
      generateStructured: vi.fn().mockResolvedValue(validRequirementsDocument),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    earsParser = new EarsParserUseCase(mockLLMProvider);
  });

  it("should return a validated RequirementsDocument on success", async () => {
    const result = await earsParser.execute("Build CSV export feature");

    expect(result.title).toBe("Requirements: User Export Feature");
    expect(result.requirements).toHaveLength(2);
    expect(result.requirements[0].earsPattern).toBe("event-driven");
    expect(result.requirements[0].statement).toContain("SHALL");
  });

  it("should call LLM provider with structured generation", async () => {
    await earsParser.execute("Build CSV export feature");

    expect(mockLLMProvider.generateStructured).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0];
    expect(callArgs[0]).toContain("EARS");
    expect(callArgs[0]).toContain("Build CSV export feature");
  });

  it("should include all 5 EARS templates in the prompt", async () => {
    await earsParser.execute("Some feature");

    const prompt = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][0];
    expect(prompt).toContain("Ubiquitous");
    expect(prompt).toContain("Event-Driven");
    expect(prompt).toContain("State-Driven");
    expect(prompt).toContain("Optional");
    expect(prompt).toContain("Unwanted Behavior");
    expect(prompt).toContain("SHALL");
    expect(prompt).toContain("WHEN");
    expect(prompt).toContain("WHILE");
    expect(prompt).toContain("WHERE");
    expect(prompt).toContain("IF");
  });

  it("should pass temperature 0.3 by default", async () => {
    await earsParser.execute("Some feature");

    const options = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][2];
    expect(options?.temperature).toBe(0.3);
  });

  it("should allow option overrides", async () => {
    await earsParser.execute("Some feature", { temperature: 0.7, model: "gpt-4" });

    const options = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][2];
    expect(options?.temperature).toBe(0.7);
    expect(options?.model).toBe("gpt-4");
  });

  it("should throw PipelineError when LLM call fails", async () => {
    vi.mocked(mockLLMProvider.generateStructured).mockRejectedValue(
      new Error("API timeout"),
    );

    await expect(earsParser.execute("Some feature")).rejects.toThrow(PipelineError);
    try {
      await earsParser.execute("Some feature");
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      const pe = error as PipelineError;
      expect(pe.code).toBe("EARS_PARSING_FAILED");
      expect(pe.category).toBe("llm");
      expect(pe.stage).toBe("requirements");
      expect(pe.message).toContain("API timeout");
    }
  });

  it("should re-throw PipelineError from provider without wrapping", async () => {
    const originalError = new PipelineError(
      "Schema validation failed",
      "VALIDATION_FAILED",
      "validation",
      "requirements",
    );
    vi.mocked(mockLLMProvider.generateStructured).mockRejectedValue(originalError);

    await expect(earsParser.execute("Some feature")).rejects.toThrow(originalError);
  });

  it("should include system prompt with JSON-only constraint", async () => {
    await earsParser.execute("Some feature");

    const options = vi.mocked(mockLLMProvider.generateStructured).mock.calls[0][2];
    expect(options?.systemPrompt).toContain("JSON");
    expect(options?.systemPrompt).toContain("EARS");
  });
});
