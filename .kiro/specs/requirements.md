# Requirements: KiroSpec Builder

## Overview

KiroSpec Builder is an AI Agent pipeline that converts unstructured user input (voice notes, product ideas, PRDs) into native Kiro Specification files (`.kiro/specs/`). Requirements are defined using strict **EARS (Easy Approach to Requirements Syntax)** patterns.

---

## Functional Requirements

### FR-1: Input Ingestion

#### FR-1.1 — Multi-Format Input Acceptance (Ubiquitous)

> The system SHALL accept unstructured input in the following formats: plain text, Markdown, JSON, and voice-transcription text.

**Acceptance Criteria:**
- [ ] Given a plain text string, the system parses it without error and produces a structured intermediate representation.
- [ ] Given a Markdown document, the system extracts headings, lists, and prose as semantic blocks.
- [ ] Given a JSON payload conforming to `RawInputSchema`, the system validates and ingests it.
- [ ] Given a voice-transcription string (raw text), the system normalizes whitespace and processes it identically to plain text.

#### FR-1.2 — Input Validation (Unwanted Behavior)

> IF the input payload fails Zod schema validation, THEN the system SHALL return a structured error response containing the field path, expected type, and received value.

**Acceptance Criteria:**
- [ ] Given an empty input payload, the system returns a `ValidationError` with `path: "content"` and message `"Required"`.
- [ ] Given input exceeding 100,000 characters, the system returns a `ValidationError` with `code: "too_big"`.
- [ ] The error response conforms to `ErrorResponseSchema` (Zod-validated).

---

### FR-2: EARS Requirements Generation

#### FR-2.1 — Requirement Extraction (Event-Driven)

> WHEN the system receives validated input, the system SHALL extract discrete feature statements and classify each into an EARS pattern category (Ubiquitous, Event-Driven, State-Driven, Optional, Unwanted Behavior).

**Acceptance Criteria:**
- [ ] Given input containing 3 distinct feature ideas, the system produces at least 3 requirement entries.
- [ ] Each requirement entry includes: `id`, `earsPattern`, `statement`, `acceptanceCriteria[]`.
- [ ] The `earsPattern` field is one of: `ubiquitous | event-driven | state-driven | optional | unwanted-behavior`.

#### FR-2.2 — EARS Statement Formatting (Ubiquitous)

> The system SHALL format every generated requirement using its correct EARS template:
> - Ubiquitous: `"The system SHALL <action>."`
> - Event-Driven: `"WHEN <trigger>, the system SHALL <action>."`
> - State-Driven: `"WHILE <state>, the system SHALL <action>."`
> - Optional: `"WHERE <feature>, the system SHALL <action>."`
> - Unwanted Behavior: `"IF <condition>, THEN the system SHALL <action>."`

**Acceptance Criteria:**
- [ ] All generated requirement statements pass a regex validation against their respective EARS template.
- [ ] No requirement statement is generated without a corresponding `acceptanceCriteria` array with at least one entry.

#### FR-2.3 — Acceptance Criteria Generation (Event-Driven)

> WHEN a requirement statement is generated, the system SHALL produce at least one testable acceptance criterion in Given/When/Then or Given/Then format.

**Acceptance Criteria:**
- [ ] Each acceptance criterion starts with "Given" or contains a "When...Then" structure.
- [ ] Criteria are specific, measurable, and reference concrete values or states (not vague).

---

### FR-3: Design Document Generation

#### FR-3.1 — Domain Entity Extraction (Event-Driven)

> WHEN requirements generation completes, the system SHALL identify domain entities, their attributes, and relationships from the requirement set.

**Acceptance Criteria:**
- [ ] Given a requirement set mentioning "User", "Spec", and "Requirement", the system produces entity definitions for each.
- [ ] Each entity includes: `name`, `attributes[]`, `relationships[]`.
- [ ] Output conforms to `DesignSchema` (Zod-validated).

#### FR-3.2 — Interface & Schema Generation (Event-Driven)

> WHEN domain entities are extracted, the system SHALL generate TypeScript interface definitions and corresponding Zod validation schemas.

**Acceptance Criteria:**
- [ ] Each domain entity produces a matching TypeScript `interface` and a Zod `z.object()` schema.
- [ ] Generated schemas are syntactically valid TypeScript (parseable by `tsc --noEmit`).

#### FR-3.3 — Architecture Diagram Generation (Event-Driven)

> WHEN the design document is assembled, the system SHALL generate Mermaid sequence and class diagrams illustrating component interactions and domain model relationships.

**Acceptance Criteria:**
- [ ] The output contains at least one `sequenceDiagram` block showing the input-to-spec transformation flow.
- [ ] The output contains at least one `classDiagram` block showing domain entity relationships.
- [ ] Mermaid syntax is valid (parseable by the Mermaid CLI `mmdc`).

---

### FR-4: Task Decomposition

#### FR-4.1 — Task Generation (Event-Driven)

> WHEN design document generation completes, the system SHALL decompose the implementation into numbered, sequential, atomic tasks.

**Acceptance Criteria:**
- [ ] Each task includes: `id` (sequential number), `title`, `description`, `dependencies[]`, `acceptanceCriteria[]`.
- [ ] Tasks are ordered such that no task depends on a later-numbered task.
- [ ] Output conforms to `TaskSchema` (Zod-validated).

#### FR-4.2 — Task Atomicity (Ubiquitous)

> The system SHALL ensure each generated task is independently testable and completable within a single focused implementation session.

**Acceptance Criteria:**
- [ ] No task description references more than one architectural layer (Domain, UseCase, Adapter, Infrastructure).
- [ ] Each task has at least one acceptance criterion that can be verified with an automated test.

---

### FR-5: Output & File Export

#### FR-5.1 — Kiro Spec File Generation (Event-Driven)

> WHEN the full pipeline (requirements, design, tasks) completes, the system SHALL write output to the `.kiro/specs/` directory structure with files: `requirements.md`, `design.md`, `tasks.md`.

**Acceptance Criteria:**
- [ ] Files are written to `<project-root>/.kiro/specs/`.
- [ ] Each file uses valid Markdown syntax.
- [ ] File content conforms to the Kiro spec format conventions.

#### FR-5.2 — Idempotent Regeneration (State-Driven)

> WHILE a `.kiro/specs/` directory already exists with prior output, the system SHALL offer a `--force` flag to overwrite or a `--merge` flag to append/update without data loss.

**Acceptance Criteria:**
- [ ] Running with `--force` replaces all files.
- [ ] Running with `--merge` preserves existing content and appends new entries with incremented IDs.
- [ ] Running without flags when specs exist returns a confirmation prompt (CLI) or warning (API).

---

### FR-6: MCP Server Exposure

#### FR-6.1 — MCP Tool Registration (Ubiquitous)

> The system SHALL expose the spec-generation pipeline as an MCP-compatible tool with proper tool schema definitions (name, description, inputSchema, outputSchema).

**Acceptance Criteria:**
- [ ] The MCP server registers a tool named `generate-spec` with a valid JSON Schema input definition.
- [ ] The tool responds to `tools/list` and `tools/call` protocol messages.
- [ ] Tool input/output schemas are derived from Zod schemas via `zod-to-json-schema`.

#### FR-6.2 — MCP Transport Support (Optional)

> WHERE the MCP server is deployed, the system SHALL support both `stdio` and `HTTP/SSE` transports.

**Acceptance Criteria:**
- [ ] The server starts in `stdio` mode when invoked via CLI pipe.
- [ ] The server starts in `HTTP/SSE` mode when the `--transport http` flag is provided.
- [ ] Both transports pass the MCP protocol conformance validation.

---

### FR-7: Web UI

#### FR-7.1 — Input Interface (Ubiquitous)

> The system SHALL provide a React-based web interface with a text input area for submitting raw feature ideas.

**Acceptance Criteria:**
- [ ] The UI renders a textarea and a "Generate Spec" button.
- [ ] Submitting input triggers the pipeline and displays a loading state.
- [ ] On completion, the generated spec files are displayed in formatted Markdown preview panes.

#### FR-7.2 — Error Display (Unwanted Behavior)

> IF the pipeline returns an error, THEN the system SHALL display the error message in a dismissible alert component with the error category and detail.

**Acceptance Criteria:**
- [ ] Validation errors display the field path and expected format.
- [ ] LLM errors display a user-friendly message with a retry option.
- [ ] Network errors display a connectivity warning.

---

### FR-8: LLM Provider Abstraction

#### FR-8.1 — Multi-Provider Support (Ubiquitous)

> The system SHALL support multiple LLM providers (OpenAI, Genkit, LangChain, Ollama) via a unified adapter interface.

**Acceptance Criteria:**
- [ ] The `LLMProvider` interface defines: `generateStructured<T>(prompt, schema): Promise<T>`.
- [ ] At least OpenAI and Ollama adapters are implemented.
- [ ] Provider selection is configurable via environment variable `KIROSPEC_LLM_PROVIDER`.

#### FR-8.2 — Local Fallback (Unwanted Behavior)

> IF the primary LLM provider is unreachable or returns a 5xx error, THEN the system SHALL automatically fall back to the local Ollama instance.

**Acceptance Criteria:**
- [ ] After 3 consecutive failures to the primary provider, the system switches to Ollama.
- [ ] A warning log entry is emitted: `"Primary LLM unavailable, falling back to Ollama"`.
- [ ] The fallback is transparent to the calling code (same output schema).

---

## Non-Functional Requirements

### NFR-1: Performance

> The system SHALL complete the full pipeline (input → specs) within 60 seconds for inputs under 5,000 characters when using a cloud LLM provider.

### NFR-2: Reliability

> The system SHALL maintain a success rate of ≥ 95% for spec generation on well-formed inputs (valid text, < 50,000 characters).

### NFR-3: Extensibility

> The system SHALL allow new EARS pattern types and new LLM providers to be added without modifying existing use-case or domain layer code (Open/Closed Principle).

### NFR-4: Type Safety

> The system SHALL enforce runtime type validation on all LLM outputs using Zod schemas, rejecting malformed responses before they reach the domain layer.

### NFR-5: Observability

> The system SHALL emit structured JSON logs for each pipeline stage (ingestion, requirements, design, tasks, export) including duration, token usage, and error details.
