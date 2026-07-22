import { describe, it, expect } from "vitest";
import {
  DesignEntitySchema,
  DesignDocumentSchema,
  AttributeSchema,
  RelationshipSchema,
  RelationshipTypeEnum,
} from "../../../src/domain/schemas/design.schema.js";

describe("AttributeSchema", () => {
  it("should accept a valid attribute", () => {
    const result = AttributeSchema.safeParse({
      name: "id",
      type: "string",
      required: true,
      description: "Unique identifier",
    });
    expect(result.success).toBe(true);
  });

  it("should default required to true", () => {
    const result = AttributeSchema.safeParse({
      name: "email",
      type: "string",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.required).toBe(true);
    }
  });

  it("should reject empty name", () => {
    const result = AttributeSchema.safeParse({
      name: "",
      type: "string",
    });
    expect(result.success).toBe(false);
  });
});

describe("RelationshipTypeEnum", () => {
  it("should accept all valid relationship types", () => {
    const types = ["one-to-one", "one-to-many", "many-to-many"];
    for (const type of types) {
      expect(RelationshipTypeEnum.safeParse(type).success).toBe(true);
    }
  });

  it("should reject invalid relationship type", () => {
    expect(RelationshipTypeEnum.safeParse("has-many").success).toBe(false);
  });
});

describe("RelationshipSchema", () => {
  it("should accept a valid relationship", () => {
    const result = RelationshipSchema.safeParse({
      target: "Requirement",
      type: "one-to-many",
      description: "A document contains many requirements",
    });
    expect(result.success).toBe(true);
  });

  it("should allow optional description", () => {
    const result = RelationshipSchema.safeParse({
      target: "Task",
      type: "many-to-many",
    });
    expect(result.success).toBe(true);
  });
});

describe("DesignEntitySchema", () => {
  const validEntity = {
    name: "Requirement",
    description: "A single EARS-formatted requirement with acceptance criteria.",
    attributes: [
      { name: "id", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "statement", type: "string", required: true },
    ],
    relationships: [
      { target: "AcceptanceCriterion", type: "one-to-many" as const },
    ],
  };

  it("should accept a valid entity", () => {
    const result = DesignEntitySchema.safeParse(validEntity);
    expect(result.success).toBe(true);
  });

  it("should require at least one attribute", () => {
    const result = DesignEntitySchema.safeParse({
      ...validEntity,
      attributes: [],
    });
    expect(result.success).toBe(false);
  });

  it("should accept entity with empty relationships", () => {
    const result = DesignEntitySchema.safeParse({
      ...validEntity,
      relationships: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("DesignDocumentSchema", () => {
  const validDocument = {
    title: "KiroSpec Builder Design",
    overview: "Clean Architecture design for the spec generation pipeline.",
    architectureLayers: ["Domain", "UseCases", "Adapters", "Infrastructure"],
    entities: [
      {
        name: "RawInput",
        description: "Unstructured user input before processing.",
        attributes: [
          { name: "id", type: "string", required: true },
          { name: "content", type: "string", required: true },
        ],
        relationships: [],
      },
    ],
    interfaces: ["LLMProvider", "SpecExporter", "InputParser"],
    diagrams: {
      sequence: "sequenceDiagram\n  User->>CLI: Submit input\n  CLI->>Pipeline: process()",
      classDiagram: "classDiagram\n  class RawInput {\n    +String id\n    +String content\n  }",
    },
  };

  it("should accept a valid design document", () => {
    const result = DesignDocumentSchema.safeParse(validDocument);
    expect(result.success).toBe(true);
  });

  it("should reject empty entities array", () => {
    const result = DesignDocumentSchema.safeParse({
      ...validDocument,
      entities: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty architectureLayers", () => {
    const result = DesignDocumentSchema.safeParse({
      ...validDocument,
      architectureLayers: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing diagrams.sequence", () => {
    const result = DesignDocumentSchema.safeParse({
      ...validDocument,
      diagrams: { classDiagram: "classDiagram\n..." },
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty sequence diagram", () => {
    const result = DesignDocumentSchema.safeParse({
      ...validDocument,
      diagrams: { sequence: "", classDiagram: "classDiagram\n..." },
    });
    expect(result.success).toBe(false);
  });
});
