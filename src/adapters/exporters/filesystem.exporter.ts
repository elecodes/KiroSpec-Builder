import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  SpecExporter,
  ExportResult,
} from "../../domain/ports/spec-exporter.port.js";
import type { RequirementsDocument } from "../../domain/schemas/requirement.schema.js";
import type { DesignDocument } from "../../domain/schemas/design.schema.js";
import type { TasksDocument } from "../../domain/schemas/task.schema.js";
import { EARS_TEMPLATES } from "../../domain/schemas/requirement.schema.js";
import { PipelineError } from "../../domain/schemas/error.schema.js";

/**
 * FileSystemExporter — Adapter that renders domain documents into Markdown
 * and writes them to the target directory.
 *
 * Creates the output directory if it doesn't exist (recursive mkdir).
 */
export class FileSystemExporter implements SpecExporter {
  /**
   * Export requirements document as EARS-formatted Markdown.
   */
  async exportRequirements(
    doc: RequirementsDocument,
    outputDir: string,
  ): Promise<ExportResult> {
    const content = this.renderRequirements(doc);
    return this.writeFile(outputDir, "requirements.md", content);
  }

  /**
   * Export design document as Markdown with Mermaid code blocks.
   */
  async exportDesign(
    doc: DesignDocument,
    outputDir: string,
  ): Promise<ExportResult> {
    const content = this.renderDesign(doc);
    return this.writeFile(outputDir, "design.md", content);
  }

  /**
   * Export tasks document as numbered Markdown checklist.
   */
  async exportTasks(
    doc: TasksDocument,
    outputDir: string,
  ): Promise<ExportResult> {
    const content = this.renderTasks(doc);
    return this.writeFile(outputDir, "tasks.md", content);
  }

  /**
   * Render a RequirementsDocument to EARS-formatted Markdown.
   */
  private renderRequirements(doc: RequirementsDocument): string {
    const lines: string[] = [];

    lines.push(`# ${doc.title}`);
    lines.push("");
    lines.push("## Overview");
    lines.push("");
    lines.push(doc.overview);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Functional Requirements");
    lines.push("");

    for (const req of doc.requirements) {
      lines.push(`### ${req.id} — ${req.title}`);
      lines.push("");
      lines.push(`**Pattern:** ${req.earsPattern} | **Priority:** ${req.priority}`);
      lines.push("");
      lines.push(`> ${req.statement}`);
      lines.push("");
      lines.push("**Acceptance Criteria:**");
      lines.push("");
      for (const ac of req.acceptanceCriteria) {
        lines.push(`- [ ] ${ac.description}`);
      }
      lines.push("");
    }

    if (doc.nonFunctional && doc.nonFunctional.length > 0) {
      lines.push("---");
      lines.push("");
      lines.push("## Non-Functional Requirements");
      lines.push("");
      for (const req of doc.nonFunctional) {
        lines.push(`### ${req.id} — ${req.title}`);
        lines.push("");
        lines.push(`> ${req.statement}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Render a DesignDocument to Markdown with Mermaid blocks.
   */
  private renderDesign(doc: DesignDocument): string {
    const lines: string[] = [];

    lines.push(`# ${doc.title}`);
    lines.push("");
    lines.push("## Overview");
    lines.push("");
    lines.push(doc.overview);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Architecture Layers");
    lines.push("");
    for (const layer of doc.architectureLayers) {
      lines.push(`- ${layer}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Domain Entities");
    lines.push("");

    for (const entity of doc.entities) {
      lines.push(`### ${entity.name}`);
      lines.push("");
      lines.push(entity.description);
      lines.push("");
      lines.push("**Attributes:**");
      lines.push("");
      lines.push("| Name | Type | Required | Description |");
      lines.push("|------|------|----------|-------------|");
      for (const attr of entity.attributes) {
        const desc = attr.description ?? "—";
        lines.push(
          `| ${attr.name} | \`${attr.type}\` | ${attr.required ? "Yes" : "No"} | ${desc} |`,
        );
      }
      lines.push("");

      if (entity.relationships.length > 0) {
        lines.push("**Relationships:**");
        lines.push("");
        for (const rel of entity.relationships) {
          const desc = rel.description ? ` — ${rel.description}` : "";
          lines.push(`- → \`${rel.target}\` (${rel.type})${desc}`);
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
    lines.push("## Interfaces");
    lines.push("");
    for (const iface of doc.interfaces) {
      lines.push(`- \`${iface}\``);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Sequence Diagram");
    lines.push("");
    lines.push("```mermaid");
    lines.push(doc.diagrams.sequence);
    lines.push("```");
    lines.push("");
    lines.push("## Class Diagram");
    lines.push("");
    lines.push("```mermaid");
    lines.push(doc.diagrams.classDiagram);
    lines.push("```");
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Render a TasksDocument to a numbered Markdown checklist.
   */
  private renderTasks(doc: TasksDocument): string {
    const lines: string[] = [];

    lines.push(`# ${doc.title}`);
    lines.push("");
    lines.push("## Overview");
    lines.push("");
    lines.push(doc.overview);
    lines.push("");
    lines.push("---");
    lines.push("");

    for (const task of doc.tasks) {
      const deps =
        task.dependencies.length > 0
          ? `Dependencies: [${task.dependencies.join(", ")}]`
          : "Dependencies: None";

      lines.push(`### Task ${task.id}: ${task.title}`);
      lines.push("");
      lines.push(`- **Layer:** ${task.layer}`);
      lines.push(`- **${deps}**`);
      lines.push(
        `- **Complexity:** ${task.estimatedComplexity ?? "medium"}`,
      );
      lines.push("");
      lines.push(task.description);
      lines.push("");
      lines.push("**Acceptance Criteria:**");
      lines.push("");
      for (const criterion of task.acceptanceCriteria) {
        lines.push(`- [ ] ${criterion}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Write content to a file, creating the directory if needed.
   */
  private async writeFile(
    outputDir: string,
    filename: string,
    content: string,
  ): Promise<ExportResult> {
    try {
      await mkdir(outputDir, { recursive: true });
      const filePath = join(outputDir, filename);
      const buffer = Buffer.from(content, "utf-8");
      await writeFile(filePath, buffer);

      return {
        filePath,
        sizeBytes: buffer.byteLength,
      };
    } catch (error) {
      throw new PipelineError(
        `Failed to write ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "EXPORT_WRITE_FAILED",
        "filesystem",
        "export",
      );
    }
  }
}
