import { z } from "zod";

/**
 * Schema for a single entity attribute (property) in the domain model.
 */
export const AttributeSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean().default(true),
  description: z.string().optional(),
});

export type Attribute = z.infer<typeof AttributeSchema>;

/**
 * Supported relationship types between domain entities.
 */
export const RelationshipTypeEnum = z.enum(["one-to-one", "one-to-many", "many-to-many"]);

export type RelationshipType = z.infer<typeof RelationshipTypeEnum>;

/**
 * Schema for a relationship between two domain entities.
 */
export const RelationshipSchema = z.object({
  target: z.string().min(1),
  type: RelationshipTypeEnum,
  description: z.string().optional(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

/**
 * Schema for a domain entity extracted during design generation.
 * Entities represent core domain concepts with attributes and relationships.
 */
export const DesignEntitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  attributes: z.array(AttributeSchema).min(1),
  relationships: z.array(RelationshipSchema),
});

export type DesignEntity = z.infer<typeof DesignEntitySchema>;

/**
 * Schema for architecture diagram definitions (Mermaid syntax).
 */
export const DiagramsSchema = z.object({
  sequence: z.string().min(1),
  classDiagram: z.string().min(1),
});

export type Diagrams = z.infer<typeof DiagramsSchema>;

/**
 * Schema for the complete design document.
 * Includes architecture layers, entities, interfaces, and diagrams.
 */
export const DesignDocumentSchema = z.object({
  title: z.string().min(1),
  overview: z.string().min(1),
  architectureLayers: z.array(z.string().min(1)).min(1),
  entities: z.array(DesignEntitySchema).min(1),
  interfaces: z.array(z.string().min(1)),
  diagrams: DiagramsSchema,
});

export type DesignDocument = z.infer<typeof DesignDocumentSchema>;
