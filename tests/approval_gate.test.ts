import { describe, it, expect, beforeEach } from 'vitest';
import { db, inMemoryDb } from '@/db';
import { WorkflowExecutor } from '@/lib/executor/engine';

describe('Approval Gate & approveStep Hasura Action', () => {
  const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ownerA = 'a1111111-1111-1111-1111-111111111111';
  const editorA = 'a2222222-2222-2222-2222-222222222222';
  const viewerA = 'a3333333-3333-3333-3333-333333333333';
  const ownerB = 'b1111111-1111-1111-1111-111111111111';

  let workflowId: string;

  beforeEach(async () => {
    inMemoryDb.reset();

    const wf = await db.createWorkflow({
      org_id: orgAId,
      name: 'Approval Required Workflow',
      created_by: ownerA,
      steps: [
        {
          name: 'Step 1: LLM Processing',
          step_type: 'llm_call',
          position: 0,
          config: { prompt: 'Generate preliminary draft: positive sentiment' },
        },
        {
          name: 'Step 2: Human Approval Gate',
          step_type: 'approval_gate',
          position: 1,
          config: { message: 'Please review before publishing' },
        },
        {
          name: 'Step 3: Publish Notification',
          step_type: 'notify',
          position: 2,
          config: { message: 'Document published successfully!' },
        },
      ],
      triggers: [{ trigger_type: 'manual', config: {}, enabled: true }],
    });
    workflowId = wf.id;
  });

  it('pauses execution when reaching approval_gate', async () => {
    const runRes = await WorkflowExecutor.startRun({
      workflowId,
      callerUserId: ownerA,
      triggerType: 'manual',
    });

    expect(runRes.status).toBe('paused');

    const stepRuns = await db.listStepRunsForWorkflowRun(runRes.run_id);
    expect(stepRuns.length).toBe(3);

    // Step 1 should be completed
    expect(stepRuns[0].status).toBe('completed');

    // Step 2 (Approval Gate) should be paused
    expect(stepRuns[1].status).toBe('paused');

    // Step 3 should remain pending (not executed yet)
    expect(stepRuns[2].status).toBe('pending');
  });

  it('resumes and completes remaining steps when approved by Owner A', async () => {
    const runRes = await WorkflowExecutor.startRun({
      workflowId,
      callerUserId: ownerA,
      triggerType: 'manual',
    });

    const stepRunsBefore = await db.listStepRunsForWorkflowRun(runRes.run_id);
    const approvalStepRun = stepRunsBefore.find(sr => sr.status === 'paused');
    expect(approvalStepRun).toBeDefined();

    const approveRes = await WorkflowExecutor.approveAndResume({
      stepRunId: approvalStepRun!.id,
      callerUserId: ownerA,
    });

    expect(approveRes.status).toBe('completed');
    expect(approveRes.approved_by).toBe(ownerA);

    // Check final workflow run status
    const updatedRun = await db.getWorkflowRun(runRes.run_id);
    expect(updatedRun?.status).toBe('completed');

    // All step runs should now be completed
    const stepRunsAfter = await db.listStepRunsForWorkflowRun(runRes.run_id);
    expect(stepRunsAfter.every(sr => sr.status === 'completed')).toBe(true);
  });

  it('allows Editor A to approve approval gate in same org', async () => {
    const runRes = await WorkflowExecutor.startRun({
      workflowId,
      callerUserId: editorA,
      triggerType: 'manual',
    });

    const stepRunsBefore = await db.listStepRunsForWorkflowRun(runRes.run_id);
    const approvalStepRun = stepRunsBefore.find(sr => sr.status === 'paused');

    const approveRes = await WorkflowExecutor.approveAndResume({
      stepRunId: approvalStepRun!.id,
      callerUserId: editorA,
    });

    expect(approveRes.status).toBe('completed');
    expect(approveRes.approved_by).toBe(editorA);
  });

  it('rejects approval attempt from Viewer A with 403 Forbidden', async () => {
    const runRes = await WorkflowExecutor.startRun({
      workflowId,
      callerUserId: ownerA,
      triggerType: 'manual',
    });

    const stepRuns = await db.listStepRunsForWorkflowRun(runRes.run_id);
    const approvalStepRun = stepRuns.find(sr => sr.status === 'paused');

    await expect(
      WorkflowExecutor.approveAndResume({
        stepRunId: approvalStepRun!.id,
        callerUserId: viewerA,
      })
    ).rejects.toThrow(/Forbidden.*Viewers/);
  });

  it('rejects approval attempt from Org B Owner on Org A step with 403 Forbidden', async () => {
    const runRes = await WorkflowExecutor.startRun({
      workflowId,
      callerUserId: ownerA,
      triggerType: 'manual',
    });

    const stepRuns = await db.listStepRunsForWorkflowRun(runRes.run_id);
    const approvalStepRun = stepRuns.find(sr => sr.status === 'paused');

    await expect(
      WorkflowExecutor.approveAndResume({
        stepRunId: approvalStepRun!.id,
        callerUserId: ownerB,
      })
    ).rejects.toThrow(/Forbidden.*organization/);
  });
});
