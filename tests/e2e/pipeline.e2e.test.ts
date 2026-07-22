import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { SpecGeneratorUseCase } from "../../src/use-cases/spec-generator.use-case.js";
import { EarsParserUseCase } from "../../src/use-cases/ears-parser.use-case.js";
import { DesignBuilderUseCase } from "../../src/use-cases/design-builder.use-case.js";
import { TaskDecomposerUseCase } from "../../src/use-cases/task-decomposer.use-case.js";
import { ZodInputParser } from "../../src/use-cases/input-parser.js";
import { FileSystemExporter } from "../../src/adapters/exporters/filesystem.exporter.js";
import { StructuredLogger } from "../../src/infrastructure/logging/structured-logger.js";
import type { LLMProvider } from "../../src/domain/ports/llm-provider.port.js";
import type { RequirementsDocument } from "../../src/domain/schemas/requirement.schema.js";
import type { DesignDocument } from "../../src/domain/schemas/design.schema.js";
import type { TasksDocument } from "../../src/domain/schemas/task.schema.js";

/**
 * End-to-End Pipeline Integration Test
 *
 * Tests the full pipeline from raw text input → file generation.
 * Uses a mock LLM provider that returns pre-crafted valid responses
 * to simulate the complete flow without actual LLM calls.
 */

// Pre-crafted LLM responses matching our fixture input
const MOCK_REQUIREMENTS: RequirementsDocument = {
  title: "Requirements: Collaborative Document Editor",
  overview: "A real-time collaborative document editor with rich text, version history, access control, and offline support.",
  requirements: [
    {
      id: "FR-1.1",
      title: "Rich Text Editing",
      earsPattern: "ubiquitous",
      statement: "The system SHALL support rich text formatting including bold, italic, headings, bullet lists, and code blocks.",
      acceptanceCriteria: [
        { id: "AC-1.1.1", description: "Given a document, when the user applies bold formatting, then the selected text renders as bold.", testable: true },
        { id: "AC-1.1.2", description: "Given a document, when the user inserts a code block, then the content is rendered with monospace font.", testable: true },
      ],
      priority: "must",
    },
    {
      id: "FR-1.2",
      title: "Real-Time Cursor Visibility",
      earsPattern: "state-driven",
      statement: "WHILE multiple users are editing a document, the system SHALL display each collaborator's cursor with a unique color.",
      acceptanceCriteria: [
        { id: "AC-1.2.1", description: "Given 3 active editors, then 3 distinct colored cursors are visible.", testable: true },
      ],
      priority: "must",
    },
    {
      id: "FR-2.1",
      title: "Auto-Save",
      earsPattern: "event-driven",
      statement: "WHEN the user stops typing for more than 2 seconds, the system SHALL automatically save the document.",
      acceptanceCriteria: [
        { id: "AC-2.1.1", description: "Given idle input for 2 seconds, then the document is persisted.", testable: true },
      ],
      priority: "must",
    },
    {
      id: "FR-3.1",
      title: "Access Control",
      earsPattern: "optional",
      statement: "WHERE access control is configured, the system SHALL enforce viewer, commenter, and editor permission levels.",
      acceptanceCriteria: [
        { id: "AC-3.1.1", description: "Given a viewer role, then the user cannot modify document content.", testable: true },
      ],
      priority: "must",
    },
    {
      id: "FR-4.1",
      title: "Offline Editing",
      earsPattern: "state-driven",
      statement: "WHILE the user is offline, the system SHALL allow continued editing with local persistence.",
      acceptanceCriteria: [
        { id: "AC-4.1.1", description: "Given no network, then edits are stored locally and synced on reconnect.", testable: true },
      ],
      priority: "should",
    },
    {
      id: "FR-5.1",
      title: "WebSocket Reconnection",
      earsPattern: "unwanted-behavior",
      statement: "IF the WebSocket connection drops, THEN the system SHALL attempt reconnection with exponential backoff.",
      acceptanceCriteria: [
        { id: "AC-5.1.1", description: "Given a dropped connection, then retry attempts use exponential backoff (1s, 2s, 4s, 8s).", testable: true },
      ],
      priority: "must",
    },
  ],
};

const MOCK_DESIGN: DesignDocument = {
  title: "Design: Collaborative Document Editor",
  overview: "Clean Architecture design with CRDT-based real-time collaboration, WebSocket transport, and PostgreSQL persistence.",
  architectureLayers: ["Domain", "UseCases", "Adapters", "Infrastructure"],
  entities: [
    {
      name: "Document",
      description: "A collaborative document with rich text content and metadata.",
      attributes: [
        { name: "id", type: "string", required: true, description: "Unique document identifier" },
        { name: "title", type: "string", required: true },
        { name: "content", type: "CRDTDocument", required: true },
        { name: "ownerId", type: "string", required: true },
        { name: "createdAt", type: "DateTime", required: true },
        { name: "updatedAt", type: "DateTime", required: true },
      ],
      relationships: [
        { target: "Collaborator", type: "one-to-many", description: "Has many collaborators" },
        { target: "Version", type: "one-to-many", description: "Has version history" },
      ],
    },
    {
      name: "Collaborator",
      description: "A user with a specific permission level on a document.",
      attributes: [
        { name: "userId", type: "string", required: true },
        { name: "documentId", type: "string", required: true },
        { name: "role", type: "Permission", required: true },
        { name: "cursorColor", type: "string", required: true },
      ],
      relationships: [
        { target: "Document", type: "many-to-many", description: "Belongs to document" },
      ],
    },
    {
      name: "Version",
      description: "A snapshot of document content at a point in time.",
      attributes: [
        { name: "id", type: "string", required: true },
        { name: "documentId", type: "string", required: true },
        { name: "content", type: "string", required: true },
        { name: "timestamp", type: "DateTime", required: true },
      ],
      relationships: [
        { target: "Document", type: "many-to-many", description: "Belongs to document" },
      ],
    },
  ],
  interfaces: ["DocumentRepository", "CollaborationService", "WebSocketTransport", "AutoSaveScheduler"],
  diagrams: {
    sequence: "sequenceDiagram\n    participant User\n    participant Editor\n    participant CRDT\n    participant WebSocket\n    participant Server\n    participant DB\n    User->>Editor: type text\n    Editor->>CRDT: applyOperation()\n    CRDT->>WebSocket: broadcast(op)\n    WebSocket->>Server: relay(op)\n    Server->>DB: persist(doc)\n    Server-->>WebSocket: ack",
    classDiagram: "classDiagram\n    class Document {\n      +String id\n      +String title\n      +CRDTDocument content\n      +String ownerId\n    }\n    class Collaborator {\n      +String userId\n      +Permission role\n      +String cursorColor\n    }\n    class Version {\n      +String id\n      +String content\n      +DateTime timestamp\n    }\n    Document --> Collaborator\n    Document --> Version",
  },
};

const MOCK_TASKS: TasksDocument = {
  title: "Tasks: Collaborative Document Editor",
  overview: "Implementation plan for the collaborative document editor, ordered by architectural layer.",
  tasks: [
    {
      id: 1,
      title: "Define Document and Collaborator domain schemas",
      description: "Create Zod schemas for Document, Collaborator, Version entities with all attributes and relationships.",
      layer: "domain",
      dependencies: [],
      acceptanceCriteria: ["All schemas validate correctly", "TypeScript types inferred"],
      estimatedComplexity: "low",
    },
    {
      id: 2,
      title: "Define domain port interfaces",
      description: "Create interfaces for DocumentRepository, CollaborationService, WebSocketTransport, AutoSaveScheduler.",
      layer: "domain",
      dependencies: [1],
      acceptanceCriteria: ["Interfaces use domain types only", "No external dependencies"],
      estimatedComplexity: "low",
    },
    {
      id: 3,
      title: "Implement CRDT editing use case",
      description: "Business logic for applying CRDT operations to documents with conflict resolution.",
      layer: "use-case",
      dependencies: [1, 2],
      acceptanceCriteria: ["Operations are commutative", "Concurrent edits merge correctly"],
      estimatedComplexity: "high",
    },
    {
      id: 4,
      title: "Implement auto-save use case",
      description: "Debounced save logic triggered after 2 seconds of inactivity or every 30 seconds.",
      layer: "use-case",
      dependencies: [1, 2],
      acceptanceCriteria: ["Save triggers after 2s idle", "Periodic save every 30s"],
      estimatedComplexity: "medium",
    },
    {
      id: 5,
      title: "Implement WebSocket adapter",
      description: "WebSocket server and client adapters for real-time message relay with reconnection.",
      layer: "adapter",
      dependencies: [2, 3],
      acceptanceCriteria: ["Messages relay to all connected clients", "Reconnection uses exponential backoff"],
      estimatedComplexity: "high",
    },
    {
      id: 6,
      title: "Implement PostgreSQL repository adapter",
      description: "Database adapter for document CRUD and version history storage.",
      layer: "adapter",
      dependencies: [1, 2],
      acceptanceCriteria: ["Documents persist and retrieve correctly", "Version history is maintained"],
      estimatedComplexity: "medium",
    },
    {
      id: 7,
      title: "Implement REST API endpoints",
      description: "Express routes for document CRUD, sharing, and version management.",
      layer: "infrastructure",
      dependencies: [3, 4, 5, 6],
      acceptanceCriteria: ["All CRUD endpoints return correct responses", "Access control enforced"],
      estimatedComplexity: "medium",
    },
    {
      id: 8,
      title: "Implement React editor frontend",
      description: "Rich text editor UI with CRDT integration, cursor rendering, and offline support.",
      layer: "infrastructure",
      dependencies: [5, 7],
      acceptanceCriteria: ["Editor renders rich text", "Cursors visible for collaborators", "Works offline"],
      estimatedComplexity: "high",
    },
  ],
};

describe("E2E: Full Pipeline Integration", () => {
  let outputDir: string;
  let mockLLMProvider: LLMProvider;

  beforeEach(() => {
    outputDir = join(process.cwd(), "tests", ".tmp-e2e-output", randomUUID());

    // Mock LLM provider returns valid, pre-crafted responses
    let callCount = 0;
    mockLLMProvider = {
      name: "mock-e2e",
      generateStructured: vi.fn().mockImplementation(async () => {
        callCount++;
        switch (callCount) {
          case 1: return MOCK_REQUIREMENTS;
          case 2: return MOCK_DESIGN;
          case 3: return MOCK_TASKS;
          default: return MOCK_REQUIREMENTS;
        }
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    // Cleanup temp output
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("should execute full pipeline from fixture input to output files", async () => {
    // Arrange
    const fixtureContent = readFileSync(
      join(process.cwd(), "tests/fixtures/product-idea.txt"),
      "utf-8",
    );

    const logger = new StructuredLogger("error"); // Suppress logs in tests
    const inputParser = new ZodInputParser();
    const earsParser = new EarsParserUseCase(mockLLMProvider);
    const designBuilder = new DesignBuilderUseCase(mockLLMProvider);
    const taskDecomposer = new TaskDecomposerUseCase(mockLLMProvider);
    const exporter = new FileSystemExporter();

    const specGenerator = new SpecGeneratorUseCase(
      inputParser, earsParser, designBuilder, taskDecomposer, exporter, logger,
    );

    const rawInput = {
      id: randomUUID(),
      content: fixtureContent,
      format: "text" as const,
      metadata: {
        timestamp: new Date().toISOString(),
        source: "e2e-test",
        language: "en",
      },
    };

    // Act
    const result = await specGenerator.execute(rawInput, outputDir);

    // Assert — Pipeline success
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);

    // Assert — Requirements
    expect(result.requirements).toBeDefined();
    expect(result.requirements!.requirements.length).toBeGreaterThanOrEqual(3);
    expect(result.requirements!.requirements[0].statement).toContain("SHALL");

    // Assert — Design
    expect(result.design).toBeDefined();
    expect(result.design!.entities.length).toBeGreaterThanOrEqual(1);
    expect(result.design!.diagrams.sequence).toContain("sequenceDiagram");
    expect(result.design!.diagrams.classDiagram).toContain("classDiagram");

    // Assert — Tasks
    expect(result.tasks).toBeDefined();
    expect(result.tasks!.tasks.length).toBeGreaterThanOrEqual(3);
    expect(result.tasks!.tasks[0].dependencies).toEqual([]);

    // Assert — File exports
    expect(result.exports).toBeDefined();
    expect(result.exports).toHaveLength(3);
  });

  it("should produce valid requirements.md file", async () => {
    const fixtureContent = readFileSync(
      join(process.cwd(), "tests/fixtures/product-idea.txt"),
      "utf-8",
    );

    const logger = new StructuredLogger("error");
    const specGenerator = new SpecGeneratorUseCase(
      new ZodInputParser(),
      new EarsParserUseCase(mockLLMProvider),
      new DesignBuilderUseCase(mockLLMProvider),
      new TaskDecomposerUseCase(mockLLMProvider),
      new FileSystemExporter(),
      logger,
    );

    await specGenerator.execute(
      { id: randomUUID(), content: fixtureContent, format: "text" as const, metadata: { timestamp: new Date().toISOString(), language: "en" } },
      outputDir,
    );

    // Verify file exists and has EARS content
    const reqPath = join(outputDir, "requirements.md");
    expect(existsSync(reqPath)).toBe(true);

    const content = readFileSync(reqPath, "utf-8");
    expect(content).toContain("# Requirements:");
    expect(content).toContain("SHALL");
    expect(content).toContain("- [ ]"); // Acceptance criteria checkboxes
    expect(content).toContain("FR-1.1");
  });

  it("should produce valid design.md file with Mermaid diagrams", async () => {
    const fixtureContent = readFileSync(
      join(process.cwd(), "tests/fixtures/product-idea.txt"),
      "utf-8",
    );

    const logger = new StructuredLogger("error");
    const specGenerator = new SpecGeneratorUseCase(
      new ZodInputParser(),
      new EarsParserUseCase(mockLLMProvider),
      new DesignBuilderUseCase(mockLLMProvider),
      new TaskDecomposerUseCase(mockLLMProvider),
      new FileSystemExporter(),
      logger,
    );

    await specGenerator.execute(
      { id: randomUUID(), content: fixtureContent, format: "text" as const, metadata: { timestamp: new Date().toISOString(), language: "en" } },
      outputDir,
    );

    const designPath = join(outputDir, "design.md");
    expect(existsSync(designPath)).toBe(true);

    const content = readFileSync(designPath, "utf-8");
    expect(content).toContain("```mermaid");
    expect(content).toContain("sequenceDiagram");
    expect(content).toContain("classDiagram");
    expect(content).toContain("Document");
    expect(content).toContain("`string`"); // Attribute type rendering
  });

  it("should produce valid tasks.md file with numbered tasks", async () => {
    const fixtureContent = readFileSync(
      join(process.cwd(), "tests/fixtures/product-idea.txt"),
      "utf-8",
    );

    const logger = new StructuredLogger("error");
    const specGenerator = new SpecGeneratorUseCase(
      new ZodInputParser(),
      new EarsParserUseCase(mockLLMProvider),
      new DesignBuilderUseCase(mockLLMProvider),
      new TaskDecomposerUseCase(mockLLMProvider),
      new FileSystemExporter(),
      logger,
    );

    await specGenerator.execute(
      { id: randomUUID(), content: fixtureContent, format: "text" as const, metadata: { timestamp: new Date().toISOString(), language: "en" } },
      outputDir,
    );

    const tasksPath = join(outputDir, "tasks.md");
    expect(existsSync(tasksPath)).toBe(true);

    const content = readFileSync(tasksPath, "utf-8");
    expect(content).toContain("### Task 1:");
    expect(content).toContain("- [ ]"); // Acceptance criteria checkboxes
    expect(content).toContain("**Layer:**");
    expect(content).toContain("domain");
  });

  it("should handle validation errors gracefully", async () => {
    const logger = new StructuredLogger("error");
    const specGenerator = new SpecGeneratorUseCase(
      new ZodInputParser(),
      new EarsParserUseCase(mockLLMProvider),
      new DesignBuilderUseCase(mockLLMProvider),
      new TaskDecomposerUseCase(mockLLMProvider),
      new FileSystemExporter(),
      logger,
    );

    // Empty content should fail validation
    const result = await specGenerator.execute(
      { id: "not-a-uuid", content: "", format: "text", metadata: { timestamp: "bad" } },
      outputDir,
    );

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].stage).toBe("ingestion");
  });
});
