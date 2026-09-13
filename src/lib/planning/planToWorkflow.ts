import { v4 as uuidv4 } from 'uuid';
import { Workflow, WorkflowStep, WorkflowTrigger } from '@/types';
import { ProjectPlan } from './planTypes';

export class PlanToWorkflowConverter {
  /**
   * Converts a structured ProjectPlan into an executable Workflow definition.
   */
  static convertPlanToWorkflow(plan: ProjectPlan, creatorUserId: string): Workflow {
    const steps: WorkflowStep[] = [];
    let position = 0;

    // Iterate through all phases and tasks in chronological order
    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        // Map task to appropriate step type
        const stepType = this.mapTaskToStepType(task.type, task.requiresApproval, task.title);

        // Add human approval gate prior to restricted tasks if requested
        if (task.requiresApproval && stepType !== 'approval_gate') {
          steps.push({
            id: uuidv4(),
            workflow_id: '',
            name: `Approval Gate: ${task.title}`,
            step_type: 'approval_gate',
            position: position++,
            config: {
              prompt: `Manual review and approval required before executing: ${task.title}`,
              risk_level: task.priority === 'critical' ? 'high' : 'medium',
            },
            created_at: new Date().toISOString(),
          });
        }

        // Add the primary task step
        steps.push({
          id: uuidv4(),
          workflow_id: '',
          name: `${phase.name} — ${task.title}`,
          step_type: stepType,
          position: position++,
          config: this.buildStepConfig(stepType, task, plan),
          created_at: new Date().toISOString(),
        });
      }
    }

    // Append Final Response step to format workflow payload
    steps.push({
      id: uuidv4(),
      workflow_id: '',
      name: 'Format Final Output & Summary',
      step_type: 'final_response',
      position: position++,
      config: {
        template: `Execution completed for Project Plan: "${plan.title}". All steps executed successfully.`,
      },
      created_at: new Date().toISOString(),
    });

    const workflowId = uuidv4();
    const now = new Date().toISOString();

    const triggers: WorkflowTrigger[] = [
      {
        id: uuidv4(),
        workflow_id: workflowId,
        trigger_type: 'manual',
        config: {},
        enabled: true,
        created_at: now,
      },
    ];

    // Assign workflowId to all steps
    steps.forEach((s) => (s.workflow_id = workflowId));

    return {
      id: workflowId,
      org_id: plan.orgId,
      name: `Workflow: ${plan.title}`,
      description: `Automated executable workflow generated from project plan "${plan.title}"`,
      status: 'active',
      version: 1,
      created_by: creatorUserId,
      created_at: now,
      updated_at: now,
      steps,
      triggers,
    };
  }

  private static mapTaskToStepType(taskType: string, requiresApproval: boolean, title: string): any {
    const lower = (taskType || title).toLowerCase();

    if (lower.includes('approval') || lower.includes('gate') || (requiresApproval && lower.includes('review'))) {
      return 'approval_gate';
    }
    if (lower.includes('db') || lower.includes('database') || lower.includes('sql') || lower.includes('schema') || lower.includes('table')) {
      return 'db_write';
    }
    if (lower.includes('http') || lower.includes('api') || lower.includes('fetch') || lower.includes('endpoint') || lower.includes('webhook')) {
      return 'http_request';
    }
    if (lower.includes('rag') || lower.includes('vector') || lower.includes('search') || lower.includes('retrieve') || lower.includes('document')) {
      return 'rag_search';
    }
    if (lower.includes('notify') || lower.includes('slack') || lower.includes('email') || lower.includes('message')) {
      return 'notify';
    }
    if (lower.includes('memory') || lower.includes('fact')) {
      return 'memory_write';
    }
    if (lower.includes('branch') || lower.includes('if') || lower.includes('condition')) {
      return 'conditional_branch';
    }

    return 'llm_call';
  }

  private static buildStepConfig(stepType: string, task: any, plan: ProjectPlan): Record<string, any> {
    switch (stepType) {
      case 'llm_call':
        return {
          prompt: `Execute technical task: "${task.title}". Description: ${task.description}. Technologies: ${plan.technologies.join(', ')}.`,
          model: 'llama-3.1-8b-instant',
          temperature: 0.2,
        };
      case 'rag_search':
        return {
          query: task.title,
          top_k: 3,
        };
      case 'http_request':
        return {
          url: 'https://httpbin.org/post',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: task.id, title: task.title }),
        };
      case 'db_write':
        return {
          table: 'audit_logs',
          data: {
            action: 'plan_task_execution',
            resource_type: 'task',
            resource_id: task.id,
            details: { task_title: task.title },
          },
        };
      case 'notify':
        return {
          channel: 'system',
          message: `Task step "${task.title}" completed successfully.`,
        };
      case 'approval_gate':
        return {
          prompt: `Approval required for task: ${task.title}`,
          risk_level: 'medium',
        };
      case 'conditional_branch':
        return {
          condition: "prev_output != null && prev_output != ''",
        };
      case 'memory_write':
        return {
          key: `plan_task_${task.id}`,
          value: { status: 'completed', title: task.title },
        };
      default:
        return {
          prompt: task.description,
        };
    }
  }
}
