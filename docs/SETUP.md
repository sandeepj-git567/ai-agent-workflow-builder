# Setup & Local Development Guide

## Prerequisites

- **Node.js**: v18.x or v20.x
- **npm**: v9.x or later
- **Docker & Docker Compose** (Optional, for running local pgvector PostgreSQL database)

---

## Quick Start (Zero External Setup)

The application includes a built-in in-memory fallback database engine, enabling immediate local development without requiring a local PostgreSQL instance.

```bash
# 1. Clone & Install Dependencies
git clone https://github.com/sandeepj-git567/ai-agent-workflow-builder.git
cd ai-agent-workflow-builder
npm install

# 2. Configure Environment Variables
cp .env.example .env

# 3. Start Development Server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## Production Setup with Docker & PostgreSQL (pgvector)

To run the application with a real PostgreSQL database with `pgvector` support:

```bash
# 1. Copy Docker environment settings
cp .env.docker.example .env

# 2. Launch Stack via Docker Compose
docker compose up -d

# 3. Verify Health Probes
curl http://localhost:3000/api/health
curl http://localhost:3000/api/readiness
```

---

## Running Test Suite

```bash
# Run unit & integration tests
npm test

# Run TypeScript type check
npx tsc --noEmit

# Run production build validation
npm run build
```
