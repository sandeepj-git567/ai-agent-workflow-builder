import { db } from '@/db';
import { 
  WorkflowRun, 
  StepRun, 
  Workflow, 
  WorkflowStep, 
  UserRole 
} from '@/types';
import { 
  executeLlmStep, 
  executeHttpStep, 
  executeConditionalStep, 
  executeDbWriteStep, 
  executeNotifyStep, 
  StepExecutionContext 
} from './stepRunners';

export interface WorkflowRunResponse {
  run_id: string;
  workflow_id: string;
  status: string;
  triggered_by: string | null;
  trigger_type: string;
  started_at: string;
  message?: string;
  error?: string;
}

export interface ApproveStepResponse {
  step_run_id: string;
  workflow_run_id: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  message?: string;
}

export class WorkflowExecutor {
  /**
   * Starts a workflow run with strict organization isolation, quota enforcement, and sequential step execution.
   */
  static async startRun(params: {
    workflowId: string;
    callerUserId?: string | null;
    triggerType: 'manual' | 'webhook' | 'scheduled' | 'database_event';
    initialInput?: Record<string, any>;
    bypassAuth?: boolean;
  }): Promise<WorkflowRunResponse> {
    const { workflowId, callerUserId, triggerType, initialInput, bypassAuth } = params;

    console.log(`[workflow] Starting run for workflow ${workflowId} (Trigger: ${triggerType})`);

    // 1. Load Workflow
    const workflow = await db.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`404: Workflow with id ${workflowId} not found`);
    }

    const orgId = workflow.org_id;

    // 2. Organization Isolation & Permission Check
    if (!bypassAuth && triggerType === 'manual') {
      if (!callerUserId) {
        throw new Error('401: Unauthorized — Caller user ID is required for manual workflow execution');
      }

      const membership = await db.getOrgMember(callerUserId, orgId);
      if (!membership) {
        throw new Error(`403: Forbidden — User ${callerUserId} does not belong to organization ${orgId}`);
      }

      if (membership.role === 'viewer') {
        throw new Error(`403: Forbidden — Viewers are not authorized to trigger workflows`);
      }
    } else if (triggerType === 'webhook') {
      // Validate webhook trigger exists and is enabled
      const triggers = workflow.triggers || [];
      const webhookTrigger = triggers.find(t => t.trigger_type === 'webhook' && t.enabled);
      if (!webhookTrigger) {
        throw new Error(`403: Webhook trigger is not enabled for workflow ${workflowId}`);
      }
    }

    // 3. Quota Enforcement (Server-side check)
    const org = await db.getOrganization(orgId);
    if (!org) {
      throw new Error(`404: Organization ${orgId} not found`);
    }

    if (org.calls_used >= org.calls_allowed) {
      console.warn(`[workflow] Quota exceeded for org ${orgId}: ${org.calls_used} / ${org.calls_allowed}`);
      throw new Error(`429: Quota Exceeded — Organization has used ${org.calls_used} of ${org.calls_allowed} allowed workflow calls`);
    }

    // 4. Create Workflow Run
    const run = await db.createWorkflowRun({
      workflow_id: workflowId,
      triggered_by: callerUserId || null,
      trigger_type: triggerType,
    });

    await db.updateWorkflowRun(run.id, { status: 'running' });

    // 5. Load and Sort Steps
    const steps = (workflow.steps || []).sort((a, b) => a.position - b.position);
    if (steps.length === 0) {
      await db.updateWorkflowRun(run.id, { 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      });
      await db.incrementQuotaAtomically(orgId);
      return {
        run_id: run.id,
        workflow_id: workflowId,
        status: 'completed',
        triggered_by: callerUserId || null,
        trigger_type: triggerType,
        started_at: run.started_at || new Date().toISOString(),
        message: 'Workflow completed (0 steps defined)',
      };
    }

    // 6. Pre-create step_run records in 'pending' status
    const stepRuns: StepRun[] = [];
    for (const step of steps) {
      const sr = await db.createStepRun({
        workflow_run_id: run.id,
        workflow_step_id: step.id,
        status: 'pending',
        input: step.config,
      });
      stepRuns.push(sr);
    }

    // 7. Execute Steps Sequentially
    const context: StepExecutionContext = {
      workflowRunId: run.id,
      orgId,
      workflowId,
      stepsOutput: {},
      stepRuns: [],
      initialInput: initialInput || {},
    };

    const executionResult = await this.executeStepSequence(steps, stepRuns, context, 0);

    return {
      run_id: run.id,
      workflow_id: workflowId,
      status: executionResult.status,
      triggered_by: callerUserId || null,
      trigger_type: triggerType,
      started_at: run.started_at || new Date().toISOString(),
      message: executionResult.message,
      error: executionResult.error,
    };
  }

  /**
   * Resumes a paused workflow run after an approval gate is approved.
   */
  static async approveAndResume(params: {
    stepRunId: string;
    callerUserId: string;
  }): Promise<ApproveStepResponse> {
    const { stepRunId, callerUserId } = params;

    console.log(`[workflow] Processing approval for step_run ${stepRunId} by user ${callerUserId}`);

    // 1. Load Step Run
    const stepRun = await db.getStepRun(stepRunId);
    if (!stepRun) {
      throw new Error(`404: Step run ${stepRunId} not found`);
    }

    // 2. Load Workflow Run & Workflow
    const workflowRun = await db.getWorkflowRun(stepRun.workflow_run_id);
    if (!workflowRun) {
      throw new Error(`404: Workflow run ${stepRun.workflow_run_id} not found`);
    }

    const workflow = await db.getWorkflow(workflowRun.workflow_id);
    if (!workflow) {
      throw new Error(`404: Workflow ${workflowRun.workflow_id} not found`);
    }

    const orgId = workflow.org_id;

    // 3. Organization Isolation & Role Check
    const membership = await db.getOrgMember(callerUserId, orgId);
    if (!membership) {
      throw new Error(`403: Forbidden — User does not belong to the workflow's organization`);
    }

    if (membership.role === 'viewer') {
      throw new Error(`403: Forbidden — Viewers are not authorized to approve approval gates`);
    }

    // 4. Verify Step is an Approval Gate and is currently Paused
    const step = stepRun.step || (workflow.steps || []).find(s => s.id === stepRun.workflow_step_id);
    if (!step || step.step_type !== 'approval_gate') {
      throw new Error(`400: Step run ${stepRunId} is not an approval_gate`);
    }

    if (stepRun.status !== 'paused') {
      throw new Error(`400: Step run ${stepRunId} is not in 'paused' state (current: ${stepRun.status})`);
    }

    // 5. Mark Step Run as Approved & Completed
    const now = new Date().toISOString();
    await db.updateStepRun(stepRunId, {
      status: 'completed',
      approved_by: callerUserId,
      approved_at: now,
      completed_at: now,
      output: {
        approved: true,
        approved_by: callerUserId,
        approved_at: now,
      },
    });

    console.log(`[workflow] Step ${step.name} approved. Resuming workflow execution.`);

    // 6. Resume Workflow Run
    await db.updateWorkflowRun(workflowRun.id, { status: 'running' });

    // 7. Load all sorted steps & existing step runs
    const allSteps = (workflow.steps || []).sort((a, b) => a.position - b.position);
    const allStepRuns = await db.listStepRunsForWorkflowRun(workflowRun.id);

    // Build context up to this point
    const context: StepExecutionContext = {
      workflowRunId: workflowRun.id,
      orgId,
      workflowId: workflow.id,
      stepsOutput: {},
      stepRuns: allStepRuns,
      initialInput: {},
    };

    for (const sr of allStepRuns) {
      if (sr.output) {
        const s = allSteps.find(st => st.id === sr.workflow_step_id);
        if (s) {
          context.stepsOutput[s.name] = sr.output;
          context.stepsOutput[s.id] = sr.output;
        }
      }
    }

    // Find the next step index to execute
    const currentStepIndex = allSteps.findIndex(s => s.id === step.id);
    const nextStepIndex = currentStepIndex + 1;

    // 8. Execute remaining steps
    await this.executeStepSequence(allSteps, allStepRuns, context, nextStepIndex);

    return {
      step_run_id: stepRunId,
      workflow_run_id: workflowRun.id,
      status: 'completed',
      approved_by: callerUserId,
      approved_at: now,
      message: 'Step approved and workflow resumed',
    };
  }

  /**
   * Helper to execute a sequence of workflow steps starting from a given index.
   */
  private static async executeStepSequence(
    steps: WorkflowStep[],
    stepRuns: StepRun[],
    context: StepExecutionContext,
    startIndex: number
  ): Promise<{ status: string; message?: string; error?: string }> {
    const runId = context.workflowRunId;
    const orgId = context.orgId;

    for (let i = startIndex; i < steps.length; i++) {
      const step = steps[i];
      const stepRun = stepRuns.find(sr => sr.workflow_step_id === step.id) || stepRuns[i];

      console.log(`[workflow] Executing step ${step.position}: ${step.name} (${step.step_type})`);

      // 1. Handle Approval Gate
      if (step.step_type === 'approval_gate') {
        await db.updateStepRun(stepRun.id, {
          status: 'paused',
          started_at: new Date().toISOString(),
          input: step.config,
        });

        await db.updateWorkflowRun(runId, { status: 'paused' });
        console.log(`[workflow] Approval gate reached. Workflow run ${runId} paused awaiting approval.`);

        return {
          status: 'paused',
          message: `Paused at step: ${step.name}`,
        };
      }

      // 2. Mark step as running
      await db.updateStepRun(stepRun.id, {
        status: 'running',
        started_at: new Date().toISOString(),
        input: step.config,
      });

      try {
        let result: any;

        switch (step.step_type) {
          case 'llm_call':
            result = await executeLlmStep(step, context);
            break;
          case 'http_request':
            result = await executeHttpStep(step, context);
            break;
          case 'conditional_branch':
            result = await executeConditionalStep(step, context);
            break;
          case 'db_write':
            result = await executeDbWriteStep(step, context);
            break;
          case 'notify':
            result = await executeNotifyStep(step, context);
            break;
          default:
            result = { output: { executed: true }, attemptCount: 1 };
        }

        const completedAt = new Date().toISOString();

        // Update step run to completed
        const updatedSr = await db.updateStepRun(stepRun.id, {
          status: 'completed',
          output: result.output,
          attempt_count: result.attemptCount || 1,
          completed_at: completedAt,
        });

        // Store in context for subsequent steps
        context.stepsOutput[step.name] = result.output;
        context.stepsOutput[step.id] = result.output;
        if (updatedSr) {
          context.stepRuns.push(updatedSr);
        }

        console.log(`[workflow] Step ${step.name} completed successfully`);
      } catch (err: any) {
        console.error(`[workflow] Step ${step.name} failed:`, err.message);

        const failedAt = new Date().toISOString();
        await db.updateStepRun(stepRun.id, {
          status: 'failed',
          error: err.message,
          completed_at: failedAt,
        });

        await db.updateWorkflowRun(runId, {
          status: 'failed',
          error: `Step ${step.name} failed: ${err.message}`,
          completed_at: failedAt,
        });

        return {
          status: 'failed',
          error: err.message,
        };
      }
    }

    // All steps finished successfully!
    const finishTime = new Date().toISOString();
    await db.updateWorkflowRun(runId, {
      status: 'completed',
      completed_at: finishTime,
    });

    // Atomic Quota Increment on success
    const incremented = await db.incrementQuotaAtomically(orgId);
    console.log(`[workflow] Run ${runId} completed. Quota incremented for org ${orgId}: ${incremented}`);

    return {
      status: 'completed',
      message: 'Workflow run completed successfully',
    };
  }
}
