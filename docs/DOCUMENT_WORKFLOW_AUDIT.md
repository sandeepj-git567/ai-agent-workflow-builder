# AI Document Intelligence & Workflow Planning Audit

## Executive Summary

This document provides a comprehensive audit of the **AI Agent Workflow Builder** platform architecture prior to implementing the AI-powered Document Intelligence, Structured Requirements Extraction, Dynamic Project Planning, Architecture Diagram Generation, and Executable Workflow Generation pipeline.

---

## 1. Existing System Audit

| Architecture Module | Current File / Location | Reusability / Status | Audit Findings |
|:---|:---|:---|:---|
| **Frontend UI Pages** | `src/pages/` (`index.tsx`, `knowledge-base.tsx`, `agent-playground.tsx`, `prompts.tsx`, `workflows/[id].tsx`) | **High** | Built with Next.js 14 Pages Router, React 18, TailwindCSS. Can be extended with `/documents`, `/plans`, and `/architecture` routes. |
| **Backend API Routes** | `src/pages/api/` (`documents/`, `rag/`, `agent/`, `graphql.ts`, `actions/`, `events/`, `auth/`) | **High** | REST API endpoints + Hasura GraphQL mock engine with server-side authorization parsing headers. |
| **Database & Migrations** | `src/db/index.ts`, `hasura/migrations/default/*` | **High** | Dual PostgreSQL (`pgvector`) + in-memory fallback engine. Schema contains `documents`, `document_chunks`, `document_embeddings`, `workflows`, `agent_runs`, `memories`, `audit_logs`. |
| **Auth & RBAC** | `src/context/AuthContext.tsx`, `src/lib/auth/rbac.ts` | **High** | Organization-scoped RBAC matrix (`OWNER`, `EDITOR`, `VIEWER`) and persona context switching. |
| **Multi-Tenancy** | Partitioned by `org_id` across 100% of tables | **High** | Strict row-level isolation preventing cross-tenant access. |
| **Workflow Step Types** | 12 step types in `src/lib/executor/stepRunners.ts` | **High** | `llm_call`, `rag_search`, `http_request`, `conditional_branch`, `approval_gate`, `db_write`, `notify`, `memory_read`, `memory_write`, `transform`, `web_search`, `final_response`. |
| **Execution Engine** | `src/lib/executor/engine.ts` | **High** | Deterministic step runner with step state persistence, retries, timeouts, and approval gates. |
| **RAG Implementation** | `src/lib/rag/` (`documentService.ts`, `embeddings.ts`, `retriever.ts`) | **High** | Sentence/paragraph chunker, embedding abstraction (Groq, OpenAI, Gemini, Local), vector similarity retriever. |
| **LLM Provider Abstraction** | `src/lib/ai/providers/` (`groqProvider`, `openaiProvider`, `geminiProvider`, `mockProvider`) | **High** | Extensible provider model with automatic fallback to mock responses in offline/test environments. |
| **Realtime Monitoring** | `src/lib/events/eventBus.ts`, `src/pages/api/events/notification.ts` | **High** | SSE event bus emitting workflow execution updates filtered by `org_id`. |
| **Test Suite** | `tests/*.test.ts` (9 test files, 36 passing tests) | **High** | 100% Vitest pass rate for org isolation, RBAC, execution engine, approval gates, RAG, SSRF, agent loops. |

---

## 2. Capability Analysis

### What Already Exists & Can Be Reused
- **Multi-Tenant Database & Storage**: `db.createDocument`, `db.createDocumentChunk`, `db.createDocumentEmbedding`, `db.searchSimilarChunks`.
- **RAG & Context Building**: `RAGRetriever.search()`, `EmbeddingManager.embedText()`.
- **LLM Prompt Compilation**: `compilePrompt()` in `src/lib/ai/prompts/promptCompiler.ts`.
- **Tool Execution & SSRF Protection**: `SSRFGuard` blocking private IP ranges.
- **Workflow State Engine**: `WorkflowExecutor.startRun()`, `WorkflowExecutor.approveAndResume()`.

### What Is Missing (To Be Implemented)
1. **Multi-Format Document Extractors**: Dedicated parsing modules for PDF, DOCX, TXT, Markdown, JSON, CSV (`src/lib/documents/`).
2. **Structured Detail Extraction**: AI extractor transforming raw documents into structured requirements, risks, tasks, stakeholders, and technologies (`src/lib/documents/extractor.ts`).
3. **AI Project Plan Generator**: Module converting document details or prompt into editable structured project plans (`src/lib/planning/`).
4. **Architecture Diagram Generator**: Engine generating Mermaid.js system, sequence, ER, flow, and microservice diagrams (`src/lib/architecture/`).
5. **Plan-to-Workflow Conversion**: Converter mapping plan phases/tasks directly to executable workflow steps (`src/lib/planning/planToWorkflow.ts`).
6. **Unified UI Workflow Pipeline**: Navigation and views for Document Detail Extraction, Search, Planning, Architecture, and Visual Builder (`src/pages/documents/`, `src/pages/plans/`).
7. **End-to-End Seed Demo Workflows**: "Build an E-commerce Platform" and "Analyze Company Leave Policy".

---

## 3. Risks & Safeguards

- **Untrusted Document Content & Prompt Injection**: Uploaded documents may contain malicious instructions trying to bypass rules.
  - *Safeguard*: Wrap extracted document content inside XML delimiters (`<untrusted_document_context>`) and instruct LLMs to treat text strictly as reference context.
- **JSON Schema Validation Errors**: LLMs might return malformed JSON.
  - *Safeguard*: Use strict Zod schema validation with automatic JSON repair fallback (`repairJson()`).
- **Mermaid Diagram Syntax Errors**: LLM-generated Mermaid code could have invalid syntax.
  - *Safeguard*: Validate Mermaid syntax tokens and provide fallback renderer templates.

---

## 4. Proposed Implementation Plan & Target Files

### Phase 2: Document Upload & Extraction Engine
- `src/lib/documents/documentTypes.ts`
- `src/lib/documents/documentValidator.ts`
- `src/lib/documents/documentNormalizer.ts`
- `src/lib/documents/parsers/textParser.ts`
- `src/lib/documents/parsers/markdownParser.ts`
- `src/lib/documents/parsers/jsonParser.ts`
- `src/lib/documents/parsers/csvParser.ts`
- `src/lib/documents/parsers/pdfParser.ts`
- `src/lib/documents/parsers/docxParser.ts`
- `src/lib/documents/parserRegistry.ts`

### Phase 3: Structured Detail Extraction (AI Extractor)
- `src/lib/documents/detailExtractor.ts`
- `src/lib/documents/detailSchema.ts`

### Phase 4: RAG Search & Source Attribution Improvements
- `src/lib/rag/reranker.ts`
- `src/lib/rag/contextBuilder.ts`
- `src/pages/api/documents/[id]/search.ts`

### Phase 5: AI Project Plan Generator
- `src/lib/planning/planTypes.ts`
- `src/lib/planning/planSchema.ts`
- `src/lib/planning/planGenerator.ts`
- `src/lib/planning/planValidator.ts`

### Phase 6: System Architecture Generator & Mermaid Engine
- `src/lib/architecture/architectureTypes.ts`
- `src/lib/architecture/architectureSchema.ts`
- `src/lib/architecture/architectureGenerator.ts`
- `src/lib/architecture/mermaidGenerator.ts`

### Phase 7: Plan-to-Executable Workflow Conversion
- `src/lib/planning/planToWorkflow.ts`

### Phase 8 & 9: Frontend Pages & Execution Integration
- `src/pages/documents/index.tsx`
- `src/pages/documents/[id].tsx`
- `src/pages/plans/index.tsx`
- `src/pages/plans/[id].tsx`

### Phase 14 & 15: Automated Tests & Demo Seed Workflows
- `tests/document_intelligence.test.ts`
- `tests/plan_architecture.test.ts`
- Seed data scripts in `src/db/seed.ts`
