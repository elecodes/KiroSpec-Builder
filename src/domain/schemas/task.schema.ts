import { z } from "zod";

/**
 * Architectural layers that a task can target.
 * Each task must target exactly one layer for atomicity.
 */
export const ArchLayerEnum = z.enum(["domain", "use-case", "adapter", "infrastructure"]);

export type ArchLayer = z.infer<typeof ArchLayerEnum>;

/**
 * Estimated complexity for task scoping and planning.
 */
export const ComplexityEnum = z.enum(["low", "medium", "high"]);

export type Complexity = z.infer<typeof ComplexityEnum>;

/**
 * Schema for an atomic implementation task.
 * Tasks are independently testable and target a single architectural layer.
 */
export const TaskSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  layer: ArchLayerEnum,
  dependencies: z.array(z.number().int().nonnegative()),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  estimatedComplexity: ComplexityEnum.default("medium"),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Schema for the complete tasks document.
 * Tasks must be ordered such that no task depends on a later-numbered task.
 */
export const TasksDocumentSchema = z.object({
  title: z.string().min(1),
  overview: z.string().min(1),
  tasks: z.array(TaskSchema).min(1),
});

export type TasksDocument = z.infer<typeof TasksDocumentSchema>;

/**
 * Validates that task dependencies respect topological ordering.
 * No task should depend on a task with a higher or equal ID.
 */
export function validateTaskDependencyOrder(tasks: Task[]): boolean {
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (dep >= task.id) {
        return false;
      }
    }
  }
  return true;
}
