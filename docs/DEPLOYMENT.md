# Cloud Deployment & Infrastructure Guide

## Architectural Deployment Overview

`AI Agent Workflow Builder` is designed as a stateless Next.js web service backed by PostgreSQL with `pgvector`.

---

## Required Environment Variables

Ensure the following variables are configured in your hosting platform (Vercel, AWS App Runner, GCP Cloud Run, or Kubernetes):

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
DATABASE_URL=postgresql://user:password@pg-host:5432/dbname?sslmode=require
PGSSLMODE=require
GROQ_API_KEY=gsk_your_groq_key
OPENAI_API_KEY=sk-your-openai-key
HASURA_GRAPHQL_ENDPOINT=https://your-hasura.nhost.app/v1/graphql
HASURA_GRAPHQL_ADMIN_SECRET=your-admin-secret
```

---

## Database Provisioning & Migrations

1. Provision PostgreSQL 16 on AWS RDS, Supabase, Nhost, or GCP Cloud SQL.
2. Enable vector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Run database migrations:
   ```bash
   npm run db:migrate
   ```

---

## Vercel / Cloud Run Deployment Steps

### Vercel Deployment:
1. Connect GitHub repository `sandeepj-git567/ai-agent-workflow-builder`.
2. Configure Environment Variables under Project Settings.
3. Deploy automatically via git push to `main`.

### Docker Container Deployment:
```bash
docker build -t ai-agent-workflow-builder .
docker run -p 3000:3000 --env-file .env ai-agent-workflow-builder
```

---

## Known Production Architecture Notes

- **Realtime Events**: Built using Server-Sent Events (`/api/events/notification`). For multi-instance horizontal scaling, attach Redis PubSub backplane.
- **Workflow State**: Persisted in PostgreSQL database tables (`workflows`, `workflow_runs`, `step_runs`, `approvals`).
