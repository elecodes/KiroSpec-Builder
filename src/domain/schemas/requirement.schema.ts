import { z } from "zod";

/**
 * EARS (Easy Approach to Requirements Syntax) pattern categories.
 * Each requirement must be classified into exactly one pattern.
 */
export const EarsPatternEnum = z.enum([
  "ubiquitous",
  "event-driven",
  "state-driven",
  "optional",
  "unwanted-behavior",
]);

export type EarsPattern = z.infer<typeof EarsPatternEnum>;

/**
 * EARS pattern templates for requirement statement formatting.
 */
export const EARS_TEMPLATES: Record<EarsPattern, string> = {
  ubiquitous: 'The system SHALL <action>.',
  "event-driven": 'WHEN <trigger>, the system SHALL <action>.',
  "state-driven": 'WHILE <state>, the system SHALL <action>.',
  optional: 'WHERE <feature>, the system SHALL <action>.',
  "unwanted-behavior": 'IF <condition>, THEN the system SHALL <action>.',
};

/**
 * Priority classification using MoSCoW method.
 */
export const PriorityEnum = z.enum(["must", "should", "could", "wont"]);

export type Priority = z.infer<typeof PriorityEnum>;

/**
 * Schema for a single testable acceptance criterion.
 * Each criterion must be specific, measurable, and verifiable.
 */
export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  testable: z.boolean().default(true),
});

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

/**
 * Schema for a single EARS-formatted requirement.
 * The `id` follows the pattern FR-X.Y (e.g., FR-1.1, FR-2.3).
 * The `statement` must conform to the EARS template for its pattern.
 */
export const RequirementSchema = z.object({
  id: z.string().regex(/^FR-\d+\.\d+$/, "Requirement ID must follow pattern FR-X.Y"),
  title: z.string().min(1),
  earsPattern: EarsPatternEnum,
  statement: z.string().min(1),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  priority: PriorityEnum.default("must"),
});

export type Requirement = z.infer<typeof RequirementSchema>;

/**
 * Schema for the complete requirements document.
 * Requires at least one functional requirement entry.
 */
export const RequirementsDocumentSchema = z.object({
  title: z.string().min(1),
  overview: z.string().min(1),
  requirements: z.array(RequirementSchema).min(1),
  nonFunctional: z.array(RequirementSchema).optional(),
});

export type RequirementsDocument = z.infer<typeof RequirementsDocumentSchema>;
