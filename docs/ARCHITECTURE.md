# System Architecture Specification

## Overview

`AI Agent Workflow Builder` is a production-grade, multi-tenant AI Agent & GenAI Workflow Platform built with Next.js, TypeScript, PostgreSQL (with pgvector), and multi-provider LLM integrations.

---

## High-Level Architecture Diagram

```
[ Frontend Dashboard & Workflow Canvas ]
                  │
                  ▼
         [ GraphQL / REST API ]
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
[ Agent Engine ] [ Workflow ] [ RAG Engine ]
     │            │            │
     ▼            ▼            ▼
[ LLM Abstraction Layer ] ──> [ Vector DB (pgvector) ]
  (Groq, OpenAI, Gemini, Mock)
```

---

## Core System Modules

1. **Workflow Engine (`src/lib/executor/engine.ts`)**:
   - Executes 12 step types deterministically.
   - Enforces approval gates, retries, step timeouts, and payload interpolation.

2. **Agent Orchestrator (`src/lib/agent/orchestrator.ts`)**:
   - Intent classification, planning, tool selection, RAG retrieval, and bounded execution loops.

3. **RAG Retriever & Document Processing (`src/lib/rag/`)**:
   - Ingests multi-format documents (PDF, Markdown, TXT, DOCX, JSON, CSV).
   - Generates vector embeddings and performs cosine similarity search.

4. **Multi-Tenant Isolation & RBAC (`src/pages/api/graphql.ts`)**:
   - Tenant isolation enforced via `organization_id` on all tables.
   - Role-based access control (`OWNER`, `EDITOR`, `VIEWER`).

5. **Security & SSRF Guard (`src/lib/tools/ssrfGuard.ts`)**:
   - SSRF protection blocking private IP ranges (`10.0.0.0/8`, `127.0.0.1`, `192.168.0.0/16`, `169.254.169.254`).
   - Security audit logging and HMAC webhook signature verification.
