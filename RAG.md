# Retrieval-Augmented Generation (RAG) Architecture

## Overview

The platform includes a complete, production-grade **Retrieval-Augmented Generation (RAG) Pipeline** supporting document ingestion, configurable text chunking, embedding abstraction, vector similarity search with `pgvector`, tenant-isolated retrieval, and source attribution formatting.

---

## RAG Pipeline Lifecycle

```
DOCUMENT INGESTION
       |
       v
TEXT EXTRACTION & CHUNKING (Configurable chunk size & overlap)
       |
       v
METADATA ENRICHMENT (document_id, org_id, chunk_index, token_count)
       |
       v
EMBEDDING GENERATION (OpenAI text-embedding-3-small or Local Semantic 128-dim Vector)
       |
       v
VECTOR PERSISTENCE (PostgreSQL pgvector / InMemory Vector Store)
       |
       v
SEMANTIC RETRIEVAL (Cosine similarity search with mandatory org_id filter)
       |
       v
CONTEXT ASSEMBLY (Grounded LLM prompt construction with XML safety boundaries)
       |
       v
LLM INVOCATION & SOURCE ATTRIBUTION RESPONSE
```

---

## Core RAG Services

- **Document Service** (`src/lib/rag/documentService.ts`): Ingests text/markdown/json files, chunks text into overlapping segments, and coordinates embedding generation.
- **Embedding Provider Abstraction** (`src/lib/rag/embeddings.ts`): Unified interface over `OpenAIEmbeddingProvider` and zero-cost `LocalEmbeddingProvider`.
- **RAG Retriever** (`src/lib/rag/retriever.ts`): Executes vector similarity search enforcing tenant isolation and formats citations.
- **RAG REST APIs**:
  - `POST /api/documents` — Ingest document
  - `GET /api/documents` — List tenant documents
  - `DELETE /api/documents/:id` — Delete document
  - `POST /api/rag/search` — Vector similarity search
  - `POST /api/rag/query` — Grounded RAG query answer with document citations
