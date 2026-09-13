import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentService } from '../src/lib/rag/documentService';
import { RagSysService } from '../src/lib/rag/ragSysService';
import { db, inMemoryDb } from '../src/db';

describe('RagSys PDF Question Answering System', () => {
  const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it('1. Answers user question accurately using strictly grounded PDF document context', async () => {
    const doc = await DocumentService.ingestDocument({
      orgId: ORG_A,
      name: 'Acme_SLA_Guidelines.txt',
      content: 'Acme Support SLA Policy: All VIP customer tickets must be responded to within 15 minutes. Regular tickets have an SLA of 4 hours.',
      fileType: 'text',
    });

    const result = await RagSysService.askQuestion({
      orgId: ORG_A,
      documentId: doc.id,
      question: 'What is the SLA response time for VIP customer tickets?',
    });

    expect(result.chunkCount).toBeGreaterThan(0);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.answer).toContain('15 minutes');
    expect(result.sourceDetails[0].documentName).toBe('Acme_SLA_Guidelines.txt');
  });

  it('2. Returns strict fallback message when question cannot be answered from document context', async () => {
    const doc = await DocumentService.ingestDocument({
      orgId: ORG_A,
      name: 'Product_Catalog.txt',
      content: 'Acme Software Modules: Workflow Engine, RAG Knowledge Base, Prompt Studio.',
      fileType: 'text',
    });

    const result = await RagSysService.askQuestion({
      orgId: ORG_A,
      documentId: doc.id,
      question: 'What is the pricing cost of the enterprise tier in Euros?',
    });

    // RagSys prompt rule 3 requires exact fallback string
    expect(result.answer).toBe("I couldn't find that information in the PDF.");
  });

  it('3. Provides exact source chunk citations and page metadata', async () => {
    const doc = await DocumentService.ingestDocument({
      orgId: ORG_A,
      name: 'Security_Compliance.txt',
      content: 'Security Requirement 10.2: All API requests must be authenticated using JWT Bearer headers.',
      fileType: 'text',
    });

    const result = await RagSysService.askQuestion({
      orgId: ORG_A,
      documentId: doc.id,
      question: 'How should API requests be authenticated?',
    });

    expect(result.sourceDetails.length).toBe(1);
    expect(result.sourceDetails[0].content).toContain('JWT Bearer headers');
    expect(result.sourceDetails[0].relevanceScore).toBeGreaterThan(0);
  });

  it('4. Strictly isolates RAG Q&A queries per tenant organization', async () => {
    await DocumentService.ingestDocument({
      orgId: ORG_A,
      name: 'OrgA_Secret_Policy.txt',
      content: 'Org A Secret Encryption Passphrase is AlphaDelta99.',
      fileType: 'text',
    });

    // Query from Org B Knowledge Base for Org A document
    const result = await RagSysService.askQuestion({
      orgId: ORG_B,
      question: 'What is the Secret Encryption Passphrase?',
    });

    expect(result.answer).toBe("I couldn't find that information in the PDF.");
    expect(result.chunkCount).toBe(0);
  });
});
