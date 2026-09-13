# AI Agent & GenAI Workflow Platform

> AI Agent Workflow Builder is a production-oriented multi-tenant GenAI workflow platform built with Next.js, TypeScript, PostgreSQL, pgvector, and multi-provider LLM integrations. It supports AI agent orchestration, RAG-based document retrieval, workflow automation, approval gates, role-based access control, tenant isolation, SSRF protection, webhook validation, quotas, and real-time execution events. The project includes automated testing, Docker configuration, and cloud deployment preparation.

---

## 🌟 Key Features & Architectural Highlights

### 1. Autonomous AI Agent Orchestrator
- **Intent Recognition & Planning:** Categorizes user intent (`rag_qa`, `data_enrichment`, `code_audit`, `task_management`, `general_reasoning`) and generates dynamic execution plans.
- **Bounded Loop & Safety Policies:** Enforces `MAX_STEPS = 10` and `MAX_RETRIES = 2` to prevent infinite loops and token budget overruns.
- **Tool Selection & Human Approval:** Integrates tool execution with persistent human-in-the-loop approval gates.

### 2. RAG Pipeline & Vector Storage
- **Multi-Format Ingestion:** Extracts and cleans text from `.txt`, `.md`, `.pdf`, `.docx`, `.json`, `.csv` files.
- **Chunking Engine:** Paragraph/sentence chunker with 500-character target size and 50-character overlap.
- **Vector Search (`pgvector`):** Cosine similarity retrieval with SQL `<=>` distance operator and in-memory fallback.
- **Source Attribution:** Returns document name, chunk index, and relevance score for grounded context assembly.

### 3. Unified LLM Provider Abstraction
- Unified interface for **Groq** (LLaMA 3.1 8B Instant), **OpenAI** (GPT-4o-mini), **Gemini** (1.5 Flash), and **MockLLMProvider** for zero-cost offline testing.

### 4. 12 Executable Workflow Step Types
1. `llm_call`: Prompt execution with model selection.
2. `rag_search`: Document context retrieval.
3. `http_request`: SSRF-guarded outbound HTTP client.
4. `conditional_branch`: JavaScript expression branch evaluation.
5. `approval_gate`: State persistence pausing execution for manual approval.
6. `db_write`: Database row insertion.
7. `notify`: Realtime notification event dispatch.
8. `memory_read`: Context retrieval from short/long-term memory.
9. `memory_write`: Fact & preference storage.
10. `transform`: Data mapping and formatting.
11. `web_search`: SSRF-safe web search simulation.
12. `final_response`: Execution response payload formatting.

### 5. Multi-Tenant Isolation & 2-Layer Security
- **Layer 1 Tenant Isolation:** Every query filters by `org_id` preventing cross-tenant read/write data leaks.
- **Layer 2 Server-Side RBAC:** Enforces `OWNER`, `EDITOR`, `VIEWER` permission matrices across API routes and GraphQL handlers.
- **SSRF Protection:** `SSRFGuard` blocks private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`) and AWS/GCP IMDS hostnames.

---

## 🏗️ Technology Stack

- **Frontend:** Next.js 14 (Pages Router), React 18, TypeScript 5.5, Tailwind CSS, Lucide Icons
- **Backend APIs:** Next.js API Routes, GraphQL Engine, Server-Sent Events (SSE)
- **Database & Storage:** PostgreSQL 16 with `pgvector` extension + InMemoryDb fallback
- **AI / LLM Integrations:** Groq SDK, OpenAI API, Google Gemini API
- **Testing & Quality:** Vitest 2.0 (36 passing automated tests), ESLint

---

## 🚀 Quick Start & Local Setup

```bash
# 1. Clone & Install Dependencies
git clone https://github.com/sandeepj-git567/ai-agent-workflow-builder.git
cd ai-agent-workflow-builder
npm install

# 2. Configure Environment
cp .env.example .env

# 3. Run Validation Commands
npx tsc --noEmit
npm run lint
npm test

# 4. Start Development Server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 🐳 Docker Deployment Setup

Run containerized stack (PostgreSQL + `pgvector` + Next.js App):
```bash
docker-compose up -d
```
*(Note: Docker runtime verification requires Docker installed on the host system)*

---

## 🧪 Test Suite Breakdown (36 Tests Passing)

```bash
npm test
```

- `tests/auth_org_isolation.test.ts` — Verifies Layer 1 Organization Isolation.
- `tests/roles_and_gating.test.ts` — Verifies Layer 2 RBAC Step Gating.
- `tests/workflow_execution.test.ts` — Verifies workflow execution engine.
- `tests/approval_gate.test.ts` — Verifies human-in-the-loop pause & resume.
- `tests/quota_and_webhook.test.ts` — Verifies atomic quotas and webhooks.
- `tests/rag_pipeline.test.ts` — Verifies document chunking, vector search & tenant isolation.
- `tests/tool_ssrf.test.ts` — Verifies SSRF guard blocking private IP targets.
- `tests/agent_orchestrator.test.ts` — Verifies intent classification & agent tool loops.
- `tests/ai_evals.test.ts` — Verifies prompt injection resistance & AI benchmarks.

---

## 📝 Verification Status & Limitations

- **Build & Types:** Verified complete (`npx tsc --noEmit` exit 0, `npm run lint` exit 0, `npm run build` exit 0).
- **Test Suite:** Verified complete (36/36 tests passing).
- **Docker & Cloud Live Deployment:** Source-code verified. Runtime verification depends on host Docker daemon & active cloud credentials.
- **Web Search Step:** Implemented as a safe simulation endpoint.

---

## 📜 License
MIT
