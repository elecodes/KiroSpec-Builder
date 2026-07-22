import type { RequirementsDocument } from "../schemas/requirement.schema.js";
import type { DesignDocument } from "../schemas/design.schema.js";
import type { TasksDocument } from "../schemas/task.schema.js";

/**
 * Output result from an export operation.
 */
export interface ExportResult {
  /** Absolute path to the written file. */
  filePath: string;
  /** Size of the written file in bytes. */
  sizeBytes: number;
}

/**
 * Port interface for spec document export.
 *
 * Responsible for rendering domain documents into their final output format
 * (e.g., Markdown files) and writing them to the target directory.
 *
 * This interface belongs to the Domain layer — implementations live in the Adapter layer.
 */
export interface SpecExporter {
  /**
   * Export the requirements document as a formatted Markdown file.
   * Renders EARS-formatted requirements with acceptance criteria checkboxes.
   *
   * @param doc - The validated requirements document.
   * @param outputDir - Target directory for the output file.
   * @returns Metadata about the written file.
   */
  exportRequirements(doc: RequirementsDocument, outputDir: string): Promise<ExportResult>;

  /**
   * Export the design document as a formatted Markdown file.
   * Renders entities, interfaces, and Mermaid diagram code blocks.
   *
   * @param doc - The validated design document.
   * @param outputDir - Target directory for the output file.
   * @returns Metadata about the written file.
   */
  exportDesign(doc: DesignDocument, outputDir: string): Promise<ExportResult>;

  /**
   * Export the tasks document as a formatted Markdown file.
   * Renders numbered task list with checkboxes, layers, and dependencies.
   *
   * @param doc - The validated tasks document.
   * @param outputDir - Target directory for the output file.
   * @returns Metadata about the written file.
   */
  exportTasks(doc: TasksDocument, outputDir: string): Promise<ExportResult>;
}
