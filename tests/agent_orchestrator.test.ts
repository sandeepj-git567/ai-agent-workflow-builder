import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryDb } from '../src/db';
import { AgentOrchestrator } from '../src/lib/agent/orchestrator';
import { DocumentService } from '../src/lib/rag/documentService';

describe('AI Agent Orchestrator & Multi-Step Execution', () => {
  const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ownerAUserId = 'a1111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it('classifies intent, plans tasks, and completes an autonomous reasoning agent run', async () => {
    const run = await AgentOrchestrator.runAgent({
      orgId: orgAId,
      userId: ownerAUserId,
      userRole: 'owner',
      userRequest: 'Please analyze customer support inquiry: "The platform speed is outstanding and response is instant."',
    });

    expect(run.id).toBeDefined();
    expect(run.status).toBe('completed');
    expect(run.intent).toBe('general_reasoning');
    expect(run.final_output).toBeDefined();
    expect(run.steps).toBeDefined();
    expect(run.steps!.length).toBeGreaterThan(0);
  });

  it('integrates RAG search automatically when request involves document policies', async () => {
    // Ingest SLA policy
    await DocumentService.ingestDocument({
      orgId: orgAId,
      name: 'Acme SLA Policy.md',
      content: 'Acme SLA Policy: All tier 1 tickets must be responded to within 10 minutes.',
    });

    const run = await AgentOrchestrator.runAgent({
      orgId: orgAId,
      userId: ownerAUserId,
      userRole: 'owner',
      userRequest: 'What is the response SLA policy for tier 1 tickets?',
    });

    expect(run.status).toBe('completed');
    expect(run.intent).toBe('rag_qa');
    expect(run.steps?.some(s => s.action_type === 'rag_retrieval')).toBe(true);
  });
});
