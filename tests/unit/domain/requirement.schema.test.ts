import { describe, it, expect } from "vitest";
import {
  RequirementSchema,
  RequirementsDocumentSchema,
  EarsPatternEnum,
  AcceptanceCriterionSchema,
  EARS_TEMPLATES,
} from "../../../src/domain/schemas/requirement.schema.js";

describe("EarsPatternEnum", () => {
  it("should accept all valid EARS patterns", () => {
    const patterns = ["ubiquitous", "event-driven", "state-driven", "optional", "unwanted-behavior"];
    for (const pattern of patterns) {
      const result = EarsPatternEnum.safeParse(pattern);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid EARS patterns", () => {
    const result = EarsPatternEnum.safeParse("behavioral");
    expect(result.success).toBe(false);
  });
});

describe("EARS_TEMPLATES", () => {
  it("should have a template for each EARS pattern", () => {
    expect(EARS_TEMPLATES["ubiquitous"]).toContain("SHALL");
    expect(EARS_TEMPLATES["event-driven"]).toContain("WHEN");
    expect(EARS_TEMPLATES["state-driven"]).toContain("WHILE");
    expect(EARS_TEMPLATES["optional"]).toContain("WHERE");
    expect(EARS_TEMPLATES["unwanted-behavior"]).toContain("IF");
  });
});

describe("AcceptanceCriterionSchema", () => {
  it("should accept a valid criterion", () => {
    const result = AcceptanceCriterionSchema.safeParse({
      id: "AC-1",
      description: "Given valid input, the system returns a structured response.",
      testable: true,
    });
    expect(result.success).toBe(true);
  });

  it("should default testable to true", () => {
    const result = AcceptanceCriterionSchema.safeParse({
      id: "AC-1",
      description: "Some criterion",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.testable).toBe(true);
    }
  });

  it("should reject empty description", () => {
    const result = AcceptanceCriterionSchema.safeParse({
      id: "AC-1",
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("RequirementSchema", () => {
  const validRequirement = {
    id: "FR-1.1",
    title: "Multi-Format Input Acceptance",
    earsPattern: "ubiquitous" as const,
    statement: "The system SHALL accept unstructured input in multiple formats.",
    acceptanceCriteria: [
      {
        id: "AC-1.1.1",
        description: "Given a plain text string, the system parses it without error.",
        testable: true,
      },
    ],
    priority: "must" as const,
  };

  it("should accept a valid requirement", () => {
    const result = RequirementSchema.safeParse(validRequirement);
    expect(result.success).toBe(true);
  });

  it("should enforce FR-X.Y ID pattern", () => {
    const result = RequirementSchema.safeParse({
      ...validRequirement,
      id: "REQ-001",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("id");
    }
  });

  it("should accept FR-10.22 (multi-digit)", () => {
    const result = RequirementSchema.safeParse({
      ...validRequirement,
      id: "FR-10.22",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty acceptanceCriteria array", () => {
    const result = RequirementSchema.safeParse({
      ...validRequirement,
      acceptanceCriteria: [],
    });
    expect(result.success).toBe(false);
  });

  it("should default priority to 'must'", () => {
    const { priority, ...withoutPriority } = validRequirement;
    const result = RequirementSchema.safeParse(withoutPriority);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("must");
    }
  });

  it("should reject invalid earsPattern", () => {
    const result = RequirementSchema.safeParse({
      ...validRequirement,
      earsPattern: "custom",
    });
    expect(result.success).toBe(false);
  });
});

describe("RequirementsDocumentSchema", () => {
  const validDocument = {
    title: "KiroSpec Builder Requirements",
    overview: "Requirements for the AI Agent pipeline.",
    requirements: [
      {
        id: "FR-1.1",
        title: "Input Acceptance",
        earsPattern: "ubiquitous" as const,
        statement: "The system SHALL accept text input.",
        acceptanceCriteria: [
          { id: "AC-1", description: "Text input is accepted.", testable: true },
        ],
        priority: "must" as const,
      },
    ],
  };

  it("should accept a valid document", () => {
    const result = RequirementsDocumentSchema.safeParse(validDocument);
    expect(result.success).toBe(true);
  });

  it("should reject a document with empty requirements array", () => {
    const result = RequirementsDocumentSchema.safeParse({
      ...validDocument,
      requirements: [],
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional nonFunctional requirements", () => {
    const result = RequirementsDocumentSchema.safeParse({
      ...validDocument,
      nonFunctional: [
        {
          id: "FR-9.1",
          title: "Performance",
          earsPattern: "ubiquitous" as const,
          statement: "The system SHALL respond within 60 seconds.",
          acceptanceCriteria: [
            { id: "AC-NF-1", description: "Pipeline completes in < 60s.", testable: true },
          ],
          priority: "must" as const,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing title", () => {
    const { title, ...withoutTitle } = validDocument;
    const result = RequirementsDocumentSchema.safeParse(withoutTitle);
    expect(result.success).toBe(false);
  });
});
