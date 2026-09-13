# AI Agent & GenAI Workflow Platform

> **Production-Oriented Multi-Tenant AI Agent, RAG Pipeline & GenAI Workflow Platform**  
> Built with Next.js 14, TypeScript, Tailwind CSS, PostgreSQL + `pgvector`, LLM Provider Abstraction (Groq / OpenAI / Local), Prompt Engineering Studio, Safe Tool Registry with SSRF Guards, Human-in-the-Loop Approval Gates, Docker Containerization, and GitHub Actions CI/CD.

---

## 🌟 Key Capabilities & Architectural Highlights

- **Autonomous AI Agent Orchestrator:**
  - **Intent Classification:** Intent recognition (`rag_qa`, `data_enrichment`, `code_audit`, `task_management`, `general_reasoning`).
  - **Dynamic Task Planning:** Decomposes user goal into step-by-step tool plan.
  - **Tool Execution Loop & Validation:** Executes tools via unified registry, validates outputs, and handles automatic retry/recovery.

- **Production RAG Pipeline (`pgvector`):**
  - **Ingestion & Chunking:** Paragraph/sentence boundary text chunker with configurable chunk size and overlap.
  - **Embedding Provider Abstraction:** Unified interface over OpenAI (`text-embedding-3-small`) and zero-cost `LocalEmbeddingProvider` (128-dim normalized semantic vector).
  - **Semantic Similarity Search:** Cosine similarity vector retrieval with mandatory tenant filtering.
  - **Context Assembly & Source Attribution:** Formats retrieved chunks into grounded LLM context with explicit document citation headers.

- **Unified LLM Provider Abstraction:**
  - Extensible `LLMProvider` interface over Groq (LLaMA 3.1 8B Instant), OpenAI (GPT-4o-mini), and `MockLLMProvider` (local offline fallback for zero-cost testing).

- **Prompt Engineering Studio:**
  - Versioned prompt templates (`prompt_templates`, `prompt_versions`), parameter interpolation, and **Prompt Injection Defense** using XML boundary tags and system directives.

- **Safe Tool Registry & SSRF Security Guard:**
  - Tools: `llm_call`, `http_request`, `rag_search`, `db_write`, `notify`, `web_search`, `code_analysis`, `task_management`, `memory_operations`.
  - **SSRF Protection:** `SSRFGuard` blocks private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`), internal hostnames (`localhost`, `*.local`), and unsafe non-HTTP protocols.

- **Multi-Tenant SaaS & 2-Layer Security:**
  - **Layer 1 Org Isolation:** Strict workspace isolation via mandatory `org_id` filters preventing cross-tenant read/write data leaks.
  - **Layer 2 Granular RBAC:** Role permissions (`owner`, `editor`, `viewer`) with step-level and tool risk-level gating.

- **Human-in-the-Loop Approval Gates:**
  - Execution state persistence with `paused` status until authorized user approves via `approveAndResume()`.

- **Automated Testing Suite (36 Tests):**
  - 36 passing Vitest unit, integration, security, and AI evaluation tests across 9 test files.

- **Containerization & CI/CD Pipeline:**
  - Multi-stage `Dockerfile`, `docker-compose.yml` with `ankane/pgvector` image, and `.github/workflows/ci.yml`.

---

## 🏗️ Tech Stack

- **Frontend:** Next.js 14 (Pages Router), React 18, TypeScript 5.5, Tailwind CSS, Lucide Icons
- **Backend APIs:** Next.js API Routes, GraphQL Engine, Hasura Header Conventions
- **Database & Vector Store:** PostgreSQL with `pgvector` extension & InMemoryDb fallback
- **AI Integrations:** Groq SDK, OpenAI API, Local LLM & Embedding Engine
- **Testing & Quality:** Vitest (36 passing automated tests across 9 test suites)
- **DevOps:** Docker, Docker Compose, GitHub Actions CI/CD

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```

### 3. Run Automated Test Suite
```bash
npm test
```

### 4. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Deployment

Run full containerized stack (PostgreSQL + `pgvector` + Next.js App):
```bash
docker-compose up --build
```

---

## 🧪 Test Suite Breakdown (36 Tests Passing)

Execute all 36 automated security, execution, RAG, and AI eval tests:
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

## 📜 License
MIT
