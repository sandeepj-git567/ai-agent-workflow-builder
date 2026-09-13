import { describe, it, expect, beforeEach } from 'vitest';
import { db, inMemoryDb } from '../src/db';
import { DocumentService } from '../src/lib/rag/documentService';
import { RAGRetriever } from '../src/lib/rag/retriever';
import { EmbeddingManager } from '../src/lib/rag/embeddings';

describe('RAG Pipeline & Tenant Isolation', () => {
  const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const orgBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it('ingests document, generates text chunks, and embeds vectors correctly', async () => {
    const doc = await DocumentService.ingestDocument({
      orgId: orgAId,
      name: 'Acme Security Policy.md',
      content: 'All API keys must be stored in secure vault. Passwords require 16 characters. Multi-factor authentication is mandatory for administrative access.',
      chunkSize: 60,
      chunkOverlap: 10,
    });

    expect(doc.id).toBeDefined();
    expect(doc.status).toBe('processed');
    expect(doc.chunks).toBeDefined();
    expect(doc.chunks!.length).toBeGreaterThan(0);

    const fetchedDoc = await db.getDocument(doc.id, orgAId);
    expect(fetchedDoc).not.toBeNull();
    expect(fetchedDoc?.name).toBe('Acme Security Policy.md');
  });

  it('performs semantic vector search and enforces strict tenant isolation', async () => {
    // Ingest Org A document
    await DocumentService.ingestDocument({
      orgId: orgAId,
      name: 'Org A Confidential Operations.md',
      content: 'Acme Corp secret blueprint: Deployment target is AWS us-east-1 serverless cluster.',
    });

    // Ingest Org B document
    await DocumentService.ingestDocument({
      orgId: orgBId,
      name: 'Org B Secret Financials.md',
      content: 'Beta Labs quarterly revenue exceeded budget projections by 45 percent.',
    });

    // Query with Org A tenant context
    const orgAResults = await RAGRetriever.retrieve({
      orgId: orgAId,
      query: 'deployment target AWS cluster',
      topK: 5,
    });

    expect(orgAResults.length).toBeGreaterThan(0);
    expect(orgAResults.every(r => r.document_name.includes('Org A'))).toBe(true);

    // Verify Org A query NEVER returns Org B document chunks!
    const leakedDoc = orgAResults.find(r => r.document_name.includes('Org B'));
    expect(leakedDoc).toBeUndefined();

    // Query with Org B tenant context
    const orgBResults = await RAGRetriever.retrieve({
      orgId: orgBId,
      query: 'quarterly revenue budget',
      topK: 5,
    });

    expect(orgBResults.length).toBeGreaterThan(0);
    expect(orgBResults.every(r => r.document_name.includes('Org B'))).toBe(true);

    // Verify Org B query NEVER returns Org A document chunks!
    const leakedDocA = orgBResults.find(r => r.document_name.includes('Org A'));
    expect(leakedDocA).toBeUndefined();
  });

  it('assembles grounded context string with explicit document attributions', async () => {
    const results = [
      {
        chunk_id: 'c1',
        document_id: 'd1',
        document_name: 'Acme Guidelines.md',
        content: 'VIP support requests have 15-minute response SLA.',
        score: 0.95,
        metadata: {},
      },
    ];

    const context = RAGRetriever.buildContext(results);
    expect(context).toContain('Source #1: Acme Guidelines.md');
    expect(context).toContain('Relevance: 95%');
    expect(context).toContain('VIP support requests have 15-minute response SLA.');
  });
});
