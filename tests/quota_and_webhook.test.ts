import { describe, it, expect, beforeEach } from 'vitest';
import { db, inMemoryDb } from '@/db';
import { WorkflowExecutor } from '@/lib/executor/engine';

describe('Quota Enforcement & Webhook Trigger', () => {
  const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ownerA = 'a1111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it('rejects workflow execution when quota is exhausted', async () => {
    // Set calls_used = 100, calls_allowed = 100
    await db.updateOrganizationQuota(orgAId, 100);

    const wf = await db.createWorkflow({
      org_id: orgAId,
      name: 'Quota Test Workflow',
      created_by: ownerA,
      steps: [
        {
          name: 'Quick Step',
          step_type: 'http_request',
          position: 0,
          config: { url: 'https://httpbin.org/json' },
        },
      ],
      triggers: [{ trigger_type: 'manual', config: {}, enabled: true }],
    });

    await expect(
      WorkflowExecutor.startRun({
        workflowId: wf.id,
        callerUserId: ownerA,
        triggerType: 'manual',
      })
    ).rejects.toThrow(/429: Quota Exceeded/);
  });

  it('increments quota calls_used upon successful workflow completion', async () => {
    const initialOrg = await db.getOrganization(orgAId);
    const initialUsed = initialOrg?.calls_used || 0;

    const wf = await db.createWorkflow({
      org_id: orgAId,
      name: 'Quota Increment Workflow',
      created_by: ownerA,
      steps: [
        {
          name: 'Quick Step',
          step_type: 'http_request',
          position: 0,
          config: { url: 'https://httpbin.org/json' },
        },
      ],
      triggers: [{ trigger_type: 'manual', config: {}, enabled: true }],
    });

    const result = await WorkflowExecutor.startRun({
      workflowId: wf.id,
      callerUserId: ownerA,
      triggerType: 'manual',
    });

    expect(result.status).toBe('completed');

    const updatedOrg = await db.getOrganization(orgAId);
    expect(updatedOrg?.calls_used).toBe(initialUsed + 1);
  });

  it('triggers workflow execution via webhook trigger without manual user click', async () => {
    const wf = await db.createWorkflow({
      org_id: orgAId,
      name: 'Inbound Webhook Workflow',
      created_by: ownerA,
      steps: [
        {
          name: 'Process Webhook Data',
          step_type: 'db_write',
          position: 0,
          config: {
            key: 'webhook_event_payload',
            payload: { received: '{{input.eventType}}' },
          },
        },
      ],
      triggers: [
        {
          trigger_type: 'webhook',
          config: { path: '/api/webhook' },
          enabled: true,
        },
      ],
    });

    const result = await WorkflowExecutor.startRun({
      workflowId: wf.id,
      triggerType: 'webhook',
      initialInput: { eventType: 'user_signup', userId: 'user-999' },
    });

    expect(result.status).toBe('completed');
    expect(result.trigger_type).toBe('webhook');

    // Confirm run was recorded
    const run = await db.getWorkflowRun(result.run_id);
    expect(run?.trigger_type).toBe('webhook');
    expect(run?.status).toBe('completed');
  });
});
