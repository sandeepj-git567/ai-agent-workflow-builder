# System Architecture — AI Agent Workflow Builder Platform

## Logical System Architecture

```
                                      USER
                                       |
                                       v
                         FRONTEND / WORKFLOW BUILDER
  (Dashboard | Workflow Builder | Live Execution Monitor | Agent Playground | Knowledge Base | Prompt Studio | Security Audit)
                                       |
                                       v
                              API / BACKEND (Next.js API & GraphQL Engine)
                                       |
        +------------------------------+------------------------------+
        |                              |                              |
  Authentication                RBAC & Gating                  Tenant Isolation
  (JWT / Session Headers)       (Owner/Editor/Viewer)          (Mandatory org_id Filters)
        |                              |                              |
        +------------------------------+------------------------------+
                                       |
                                       v
                             AI AGENT ORCHESTRATOR
  (Intent Classifier -> Task Planner -> Prompt Builder -> Tool Selector -> RAG Search -> LLM Invocation -> Validator -> Approval -> Memory)
                                       |
                                       v
                           SAFE TOOL REGISTRY & EXECUTORS
  (RAG Search | Web Search | HTTP Request [SSRF Guarded] | DB Write | Code Analysis | Task Manager | Notifications | Memory)
                                       |
                                       v
                            PERSISTENCE & VECTOR STORE
  (PostgreSQL + pgvector / InMemory Fallback: Orgs, Users, Workflows, Runs, Documents, Embeddings, Prompts, Memories, Audits)
                                       |
                                       v
                              REAL-TIME SSE / EVENTS
```

---

## Component Boundaries

1. **Frontend**:
   - Next.js 14 Pages Router UI with Glassmorphic Tailwind CSS design system.
   - Interactive Workflow Canvas, Live Real-time SSE Execution Monitor, Autonomous Agent Playground, RAG Knowledge Base Manager, Prompt Studio, and Security Audit Matrix.

2. **Backend & GraphQL Engine**:
   - Next.js API Routes (`/api/graphql`, `/api/actions/*`, `/api/documents/*`, `/api/rag/*`, `/api/agent/*`).
   - Layer 1 Organization Multi-tenancy filtering on every single database query.
   - Layer 2 Role-Based Access Control (`owner`, `editor`, `viewer`).

3. **AI Agent Orchestrator**:
   - Classifies user intent (`rag_qa`, `data_enrichment`, `code_audit`, `task_management`, `general_reasoning`).
   - Generates step-by-step task execution plan.
   - Performs automatic RAG context retrieval when document knowledge is required.
   - Executes dynamic tools via `ToolRegistry`.

4. **Safe Tool Registry & SSRF Guard**:
   - Unified registry for AI agent tools (`llm_call`, `http_request`, `rag_search`, `db_write`, `notify`, `web_search`, `code_analysis`, `task_management`, `memory_operations`).
   - `SSRFGuard` validates HTTP target URLs against private IP subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`), prohibited hostnames (`localhost`, `*.local`), and non-HTTP protocols.

5. **RAG Pipeline**:
   - Text extraction & configurable chunking (chunk size & overlap).
   - Abstraction over embedding providers (`OpenAIEmbeddingProvider` & `LocalEmbeddingProvider`).
   - Cosine similarity vector search in PostgreSQL `pgvector` or InMemoryDb.
   - Context assembly with explicit document attribution headers.

6. **Persistence**:
   - PostgreSQL database with `pgvector` extension.
   - InMemoryDb fallback for zero-dependency local testing.
