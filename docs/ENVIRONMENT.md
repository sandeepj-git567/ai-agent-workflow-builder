# Environment Variables Documentation

| Variable Name | Description | Default / Example | Required |
|---|---|---|---|
| `PORT` | Server HTTP listening port | `3000` | No |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` | Yes |
| `NEXT_PUBLIC_APP_URL` | Public application URL for client-side API requests | `http://localhost:3000` | Yes |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/workflow_builder` | Optional (falls back to in-memory engine) |
| `PGSSLMODE` | PostgreSQL SSL connection mode | `disable` | No |
| `GROQ_API_KEY` | Groq LLM API Key (fast inference) | `gsk_...` | Optional (uses mock responses if omitted) |
| `GROQ_DEFAULT_MODEL` | Default model for Groq Provider | `llama-3.1-8b-instant` | No |
| `OPENAI_API_KEY` | OpenAI API Key (alternative LLM provider) | `sk-...` | Optional |
| `OPENAI_DEFAULT_MODEL` | Default model for OpenAI Provider | `gpt-4o-mini` | No |
| `HASURA_GRAPHQL_ENDPOINT` | Hasura GraphQL Engine Endpoint | `http://localhost:8080/v1/graphql` | No |
| `HASURA_GRAPHQL_ADMIN_SECRET` | Admin secret key for Hasura GraphQL | `nhost-admin-secret` | No |
| `WORKFLOW_EXECUTION_TIMEOUT_MS` | Maximum execution time per step (ms) | `30000` | No |
| `MAX_STEP_RETRIES` | Max retries for failed step execution | `2` | No |
| `STEP_RETRY_DELAY_MS` | Delay between step retries (ms) | `1000` | No |
