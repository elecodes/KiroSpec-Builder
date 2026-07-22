/**
 * Domain Schemas - Central export point for all Zod schemas and inferred types.
 */

// Raw Input
export {
  RawInputSchema,
  InputMetadataSchema,
  InputFormatEnum,
  type RawInput,
  type InputMetadata,
  type InputFormat,
} from "./raw-input.schema.js";

// Error Types
export {
  ErrorResponseSchema,
  ErrorCategoryEnum,
  ErrorSeverityEnum,
  ValidationErrorDetailSchema,
  ValidationError,
  PipelineError,
  type ErrorResponse,
  type ErrorCategory,
  type ErrorSeverity,
  type ValidationErrorDetail,
} from "./error.schema.js";

// Requirements
export {
  RequirementSchema,
  RequirementsDocumentSchema,
  AcceptanceCriterionSchema,
  EarsPatternEnum,
  PriorityEnum,
  EARS_TEMPLATES,
  type Requirement,
  type RequirementsDocument,
  type AcceptanceCriterion,
  type EarsPattern,
  type Priority,
} from "./requirement.schema.js";

// Design
export {
  DesignEntitySchema,
  DesignDocumentSchema,
  AttributeSchema,
  RelationshipSchema,
  RelationshipTypeEnum,
  DiagramsSchema,
  type DesignEntity,
  type DesignDocument,
  type Attribute,
  type Relationship,
  type RelationshipType,
  type Diagrams,
} from "./design.schema.js";

// Tasks
export {
  TaskSchema,
  TasksDocumentSchema,
  ArchLayerEnum,
  ComplexityEnum,
  validateTaskDependencyOrder,
  type Task,
  type TasksDocument,
  type ArchLayer,
  type Complexity,
} from "./task.schema.js";
