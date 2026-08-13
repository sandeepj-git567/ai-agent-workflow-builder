# ai-agent-workflow-builder

> **Production-Grade Multi-Tenant AI Agent Workflow Builder MVP**
> Built with Next.js, Hasura GraphQL Schema & Permissions, Nhost architecture, Role-Based Access Control, Human-in-the-loop Approval Gates, and Real-Time SSE Subscriptions.

---

## 🌟 Key Features

- **Multi-Tenant Architecture & Layer 1 Org Isolation:** Strict workspace isolation preventing unauthorized cross-tenant read/write access.
- **Granular RBAC & Step-Level Gating (Layer 2):**
  - **Owner:** Full workflow configuration, deletion, webhooks, and restricted step permissions (`db_write`, `notify`).
  - **Editor:** Workflow authoring, editing, and execution of standard steps.
  - **Viewer:** Read-only access to workflow configurations and execution history.
- **Workflow Execution Engine (Layer 3):**
  - `llm_call`: Groq (LLaMA 3.1 8B Instant) and OpenAI LLM reasoning with output key extraction.
  - `http_request`: External API data fetching with configurable HTTP methods and exponential retry backoff.
  - `conditional_branch`: Dynamic rule evaluation routing execution paths conditionally based on previous step results.
  - `approval_gate`: Human-in-the-loop execution pauses with Hasura Action `approveStep` resuming remaining steps.
  - `db_write`: Secure JSON payload persistence and key-value state storage.
  - `notify`: Multi-channel notification delivery and alerting.
- **Real-Time Execution Subscriptions:** Live execution stream powered by Server-Sent Events / GraphQL subscriptions.
- **Automated Webhooks & Quota Enforcement:** Ingest external webhooks (`/api/webhook/[id]`) and enforce organization call quotas atomically.
- **1-Click Security Audit:** Interactive live audit suite (`/security-audit`) verifying permission layers in real-time.

---

## 🏗️ Tech Stack

- **Framework:** Next.js 14, React 18, TypeScript 5
- **Styling:** Tailwind CSS, Lucide Icons, Glassmorphic UI Design System
- **API & Schema:** GraphQL, Hasura GraphQL Engine, Nhost
- **Database:** PostgreSQL (with in-memory fallback for local testing)
- **AI Integrations:** Groq SDK, OpenAI SDK
- **Testing:** Vitest (21/21 passing automated tests across 5 layers)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

### 3. Run Test Suite
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security Audit & Testing

Run all 21 security and execution tests:
```bash
npm test
```

- `tests/auth_org_isolation.test.ts` — Verifies organization tenant isolation (Layer 1).
- `tests/roles_and_gating.test.ts` — Verifies role gating and step restrictions (Layer 2).
- `tests/workflow_execution.test.ts` — Verifies execution engine and step handlers (Layer 3).
- `tests/approval_gate.test.ts` — Verifies pause-and-resume approval gates (Layer 4).
- `tests/quota_and_webhook.test.ts` — Verifies atomic quota limits and webhook ingestion (Layer 5).

---

## 📜 License
MIT
