# Getting Started — How to Run KiroSpec Builder

## Quick Reference (Pick One)

---

### Option 1: Local (Ollama — Free, No API Key)

```bash
git clone https://github.com/elecodes/KiroSpec-Builder.git
cd KiroSpec-Builder
git checkout feat/phase-5-integration-delivery
npm install

# Install Ollama: https://ollama.ai
ollama pull llama3

export KIROSPEC_LLM_PROVIDER=ollama
npm run build

# Generate specs from a file:
echo "Build a todo app with user auth and real-time sync" | npx kirospec generate

# Or from a file:
npx kirospec generate --input your-feature.md
```

---

### Option 2: Local (OpenAI — Cloud, Needs Key)

```bash
git clone https://github.com/elecodes/KiroSpec-Builder.git
cd KiroSpec-Builder
git checkout feat/phase-5-integration-delivery
npm install

export KIROSPEC_LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-your-key-here
npm run build

echo "Build a collaborative editor" | npx kirospec generate
```

---

### Option 3: Docker (Zero Config)

```bash
git clone https://github.com/elecodes/KiroSpec-Builder.git
cd KiroSpec-Builder
git checkout feat/phase-5-integration-delivery

docker compose up -d
docker exec kirospec-ollama ollama pull llama3

# Use the API:
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"content": "Build a collaborative document editor"}'

# Check health:
curl http://localhost:3000/api/health
```

---

### Option 4: Just Run Tests (No API Key Needed)

```bash
git checkout feat/phase-5-integration-delivery
npm install
npm test
```

---

## Merge Order (if creating PRs on GitHub)

Merge these branches into `main` in order:
1. `feat/phase-1-domain-layer`
2. `feat/phase-2-use-cases-layer`
3. `feat/phase-3-adapters-layer`
4. `feat/phase-4-infrastructure-layer`
5. `feat/phase-5-integration-delivery`

Or just use `feat/phase-5-integration-delivery` directly — it has ALL the code.

---

## Output

Running `kirospec generate` produces:
- `.kiro/specs/requirements.md` — EARS-formatted requirements
- `.kiro/specs/design.md` — Entities + Mermaid diagrams
- `.kiro/specs/tasks.md` — Numbered implementation tasks
