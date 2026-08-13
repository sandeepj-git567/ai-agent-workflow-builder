import { describe, it, expect, beforeEach } from 'vitest';
import { db, inMemoryDb } from '@/db';
import { WorkflowExecutor } from '@/lib/executor/engine';

describe('Organization Isolation & Security (Layer 1)', () => {
  const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const orgBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const ownerA = 'a1111111-1111-1111-1111-111111111111';
  const ownerB = 'b1111111-1111-1111-1111-111111111111';
  const viewerB = 'b3333333-3333-3333-3333-333333333333';

  let workflowAId: string;

  beforeEach(async () => {
    inMemoryDb.reset();

    // Create a workflow in Org A
    const wf = await db.createWorkflow({
      org_id: orgAId,
      name: 'Org A Confidential Pipeline',
      description: 'Secret internal workflow',
      created_by: ownerA,
      steps: [
        {
          name: 'Analyze Document',
          step_type: 'llm_call',
          position: 0,
          config: { prompt: 'Analyze this secret text: positive' },
        },
      ],
      triggers: [
        {
          trigger_type: 'manual',
          config: {},
          enabled: true,
        },
      ],
    });
    workflowAId = wf.id;
  });

  it('allows Org A user to query Org A workflows', async () => {
    const orgAWorkflows = await db.listWorkflows(orgAId);
    expect(orgAWorkflows.length).toBeGreaterThanOrEqual(1);
    expect(orgAWorkflows.some(w => w.id === workflowAId)).toBe(true);
  });

  it('prevents Org B user from triggering Org A workflow', async () => {
    await expect(
      WorkflowExecutor.startRun({
        workflowId: workflowAId,
        callerUserId: ownerB,
        triggerType: 'manual',
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it('prevents Org B viewer from triggering Org A workflow', async () => {
    await expect(
      WorkflowExecutor.startRun({
        workflowId: workflowAId,
        callerUserId: viewerB,
        triggerType: 'manual',
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it('prevents unauthenticated execution of manual workflows', async () => {
    await expect(
      WorkflowExecutor.startRun({
        workflowId: workflowAId,
        callerUserId: null,
        triggerType: 'manual',
      })
    ).rejects.toThrow(/Unauthorized/);
  });

  it('protects against random guessed UUIDs', async () => {
    const fakeWorkflowId = '99999999-9999-9999-9999-999999999999';
    await expect(
      WorkflowExecutor.startRun({
        workflowId: fakeWorkflowId,
        callerUserId: ownerA,
        triggerType: 'manual',
      })
    ).rejects.toThrow(/not found/);
  });
});
