import { describe, it, expect, beforeEach } from 'vitest';
import { db, inMemoryDb } from '@/db';
import { WorkflowExecutor } from '@/lib/executor/engine';

describe('Workflow Execution Engine & Step Types', () => {
  const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ownerA = 'a1111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    inMemoryDb.reset();
  });

  it('executes LLM call step and captures sentiment output', async () => {
    const wf = await db.createWorkflow({
      org_id: orgAId,
      name: 'LLM Sentiment Workflow',
      created_by: ownerA,
      steps: [
        {
          name: 'Analyze Sentiment',
          step_type: 'llm_call',
          position: 0,
          config: {
            prompt: 'Please classify the following feedback: "I love this product, it is amazing!" as positive, negative, or neutral.',
          },
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

    const stepRuns = await db.listStepRunsForWorkflowRun(result.run_id);
    expect(stepRuns.length).toBe(1);
    expect(stepRuns[0].status).toBe('completed');
    expect(stepRuns[0].output).toBeDefined();
    expect(stepRuns[0].output?.sentiment).toBe('positive');
  });

  it('executes HTTP request step with retry capability', async () => {
    const wf = await db.createWorkflow({
      org_id: orgAId,
      name: 'HTTP Workflow',
      created_by: ownerA,
      steps: [
        {
          name: 'Fetch External Data',
          step_type: 'http_request',
          position: 0,
          config: {
            method: 'GET',
            url: 'https://httpbin.org/json',
          },
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

    const stepRuns = await db.listStepRunsForWorkflowRun(result.run_id);
    expect(stepRuns.length).toBe(1);
    expect(stepRuns[0].status).toBe('completed');
    expect(stepRuns[0].output?.statusCode).toBe(200);
  });

  it('demonstrates Conditional Branch evaluates previous step output and changes execution path', async () => {
    const wf = await db.createWorkflow({
      org_id: orgAId,
      name: 'LLM + Conditional Branch Workflow',
      created_by: ownerA,
      steps: [
        {
          name: 'LLM Classifier',
          step_type: 'llm_call',
          position: 0,
          config: {
            prompt: 'Analyze input sentiment: positive experience with excellent speed',
          },
        },
        {
          name: 'Evaluate Sentiment Branch',
          step_type: 'conditional_branch',
          position: 1,
          config: {
            operator: 'contains',
            value: 'positive',
            true_branch: 'VIP_CUSTOMER_FLOW',
            false_branch: 'SUPPORT_TICKET_FLOW',
          },
        },
        {
          name: 'Persist Classification Record',
          step_type: 'db_write',
          position: 2,
          config: {
            key: 'crm_enrichment',
            payload: {
              evaluation: '{{steps.Evaluate Sentiment Branch.output.branchSelected}}',
            },
          },
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

    const stepRuns = await db.listStepRunsForWorkflowRun(result.run_id);
    expect(stepRuns.length).toBe(3);

    // Step 0: LLM Output
    expect(stepRuns[0].output?.sentiment).toBe('positive');

    // Step 1: Conditional Output
    expect(stepRuns[1].output?.matched).toBe(true);
    expect(stepRuns[1].output?.branchSelected).toBe('VIP_CUSTOMER_FLOW');

    // Step 2: DB Write Output
    expect(stepRuns[2].output?.success).toBe(true);
    expect(stepRuns[2].output?.data_id).toBeDefined();

    // Verify record in workflow_data table
    const storedData = inMemoryDb.workflow_data.get(stepRuns[2].output?.data_id);
    expect(storedData).toBeDefined();
    expect(storedData?.key).toBe('crm_enrichment');
  });
});
