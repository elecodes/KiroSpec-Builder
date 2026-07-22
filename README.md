# KiroSpec Builder

> An AI Agent that converts your feature ideas into structured Kiro Specification files.

You describe what you want to build in plain English. The agent produces:

| File | What It Contains |
|------|------------------|
| `.kiro/specs/requirements.md` | EARS-formatted requirements with testable acceptance criteria |
| `.kiro/specs/design.md` | Domain entities, TypeScript interfaces, Mermaid diagrams |
| `.kiro/specs/tasks.md` | Numbered implementation tasks with dependencies |

---

## How to Use It

### 1. Install

```bash
git clone https://github.com/elecodes/KiroSpec-Builder.git
cd KiroSpec-Builder
npm install
npm run build
```

### 2. Configure an LLM Provider

Copy `.env.example` → `.env` and pick one:

**Option A — Ollama (free, runs locally):**
```bash
# Install Ollama from https://ollama.ai, then:
ollama pull llama3

# In your .env:
KIROSPEC_LLM_PROVIDER=ollama
```

**Option B — OpenAI (cloud, needs API key):**
```bash
# In your .env:
KIROSPEC_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

### 3. Run It

```bash
# From a file
node dist/infrastructure/cli/index.js --input my-feature.md

# From text directly
echo "Build a todo app with user auth and real-time sync" | node dist/infrastructure/cli/index.js

# See all options
node dist/infrastructure/cli/index.js --help
```

**Output:**
```
🚀 Starting spec generation pipeline...
✅ Spec generation complete!
   📄 .kiro/specs/requirements.md (2847 bytes)
   📄 .kiro/specs/design.md (4123 bytes)
   📄 .kiro/specs/tasks.md (3891 bytes)
   ⏱️  Total time: 12340ms
```

---

## Ways to Interact With the Agent

KiroSpec Builder has **4 interfaces** — all call the same pipeline:

### 🖥️ CLI (Terminal)

```bash
echo "Build a collaborative editor" | node dist/infrastructure/cli/index.js
```

### 🌐 Web UI (Browser)

```bash
node dist/infrastructure/cli/index.js --serve
# Open http://localhost:3000
```

This starts a web server with a visual interface:
- Paste your feature idea in a text area
- Click "Generate Spec"
- See results in tabbed preview (Requirements | Design | Tasks)

### 🔌 HTTP API (Programmatic)

```bash
# Start server
node dist/infrastructure/cli/index.js --serve

# Call the API
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"content": "Build a payment system with Stripe integration"}'
```

### 🤖 MCP Tool (AI Assistant Integration)

Register as an MCP server in your AI tool config:
```json
{
  "mcpServers": {
    "kirospec": {
      "command": "node",
      "args": ["dist/infrastructure/cli/index.js", "--mcp"],
      "env": { "KIROSPEC_LLM_PROVIDER": "ollama" }
    }
  }
}
```

Then any MCP-compatible AI assistant can call the `generate-spec` tool.

---

## Architecture — How the Agent Works

```
┌──────────────────────────────────────────────────────────┐
│  YOU  →  CLI / Web UI / API / MCP                        │  Entry Points
├──────────────────────────────────────────────────────────┤
│  SpecGenerator (orchestrator)                            │  Runs the pipeline
│    → InputParser     (validates + normalizes input)      │
│    → EarsParser      (LLM → EARS requirements)          │
│    → DesignBuilder   (LLM → entities + diagrams)        │
│    → TaskDecomposer  (LLM → atomic tasks)               │
│    → FileExporter    (writes Markdown files)             │
├──────────────────────────────────────────────────────────┤
│  OpenAI Adapter  ←→  Resilient Decorator  ←→  Ollama    │  LLM Providers
│                       (auto-failover)                    │  (with fallback)
├──────────────────────────────────────────────────────────┤
│  Zod Schemas (validate EVERY LLM response)              │  Domain Layer
└──────────────────────────────────────────────────────────┘
```

**Key:** The agent calls the LLM 3 times per run (requirements, design, tasks). Every LLM response is validated against a Zod schema before being used — if the LLM hallucinates invalid structure, it fails fast with a clear error.

---

## Project Structure

```
src/
├── domain/                  ← Schemas + interfaces (the contracts)
│   ├── schemas/                 Zod validation for all data shapes
│   └── ports/                   Interfaces that adapters implement
│
├── use-cases/               ← Agent logic (the brains)
│   ├── spec-generator.use-case.ts   Pipeline orchestrator
│   ├── ears-parser.use-case.ts      LLM prompt → EARS requirements
│   ├── design-builder.use-case.ts   LLM prompt → design document
│   ├── task-decomposer.use-case.ts  LLM prompt → task breakdown
│   └── input-parser.ts             Validates + normalizes input
│
├── adapters/                ← External connections (the hands)
│   ├── llm/                     OpenAI, Ollama, auto-failover
│   └── exporters/               Markdown file writer
│
└── infrastructure/          ← How users interact (the face)
    ├── cli/                     Terminal command
    ├── web/server.ts            HTTP API
    ├── web/ui/                  React web interface
    ├── mcp/                     MCP protocol server
    ├── config/                  Environment config (Zod-validated)
    ├── di/container.ts          Wires everything together
    └── logging/                 Structured JSON logs
```

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `KIROSPEC_LLM_PROVIDER` | `openai` | LLM provider: `openai` or `ollama` |
| `OPENAI_API_KEY` | — | Required if provider = openai |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model to use |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3` | Ollama model to use |
| `OUTPUT_DIR` | `.kiro/specs` | Where to write generated specs |
| `PORT` | `3000` | HTTP server port |
| `LOG_LEVEL` | `info` | Logging verbosity |

---

## Docker (Full Stack with Ollama)

```bash
docker compose up -d
docker exec kirospec-ollama ollama pull llama3

# Then use the API:
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"content": "Build a real-time chat app"}'
```

---

## Run Tests (no LLM needed)

```bash
npm test           # 213 tests, all pass with mock LLM
npm run typecheck  # TypeScript validation
npm run lint       # Code style
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js ≥ 20 |
| Validation | Zod (runtime type safety on all LLM outputs) |
| LLM | OpenAI API / Ollama (local) |
| Architecture | Clean Architecture + DDD + SOLID |
| Testing | Vitest (213 tests) |
| Frontend | React + Vite |
| Protocol | MCP (Model Context Protocol) |
| Deployment | Docker + Docker Compose |
| Logging | Pino-compatible structured JSON |

---

## EARS Syntax (What the Agent Generates)

| Pattern | Template | Example |
|---------|----------|---------|
| Ubiquitous | `The system SHALL...` | The system SHALL encrypt passwords with bcrypt. |
| Event-Driven | `WHEN <trigger>, the system SHALL...` | WHEN payment succeeds, the system SHALL send a receipt. |
| State-Driven | `WHILE <state>, the system SHALL...` | WHILE offline, the system SHALL queue changes locally. |
| Optional | `WHERE <feature>, the system SHALL...` | WHERE 2FA is enabled, the system SHALL require a code. |
| Unwanted | `IF <error>, THEN the system SHALL...` | IF the API returns 500, THEN the system SHALL retry. |

---

## License

MIT

---

*Built by Elena Menéndez with Kiro.*
