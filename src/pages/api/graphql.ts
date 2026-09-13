import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { WorkflowExecutor } from '@/lib/executor/engine';
import { WorkflowStep, WorkflowTrigger, StepType, TriggerType } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Extract Session Variables
  const userId = (req.headers['x-hasura-user-id'] || req.headers['authorization']?.replace('Bearer ', '') || '') as string;
  const explicitRole = (req.headers['x-hasura-role'] || '') as string;
  const adminSecret = req.headers['x-hasura-admin-secret'];

  const isAdmin = adminSecret === (process.env.HASURA_GRAPHQL_ADMIN_SECRET || 'nhost-admin-secret');

  const { query, variables } = req.method === 'POST' ? req.body || {} : req.query;

  if (!query) {
    return res.status(400).json({ errors: [{ message: 'No GraphQL query provided' }] });
  }

  try {
    const result = await executeGraphQL({
      query: String(query),
      variables: typeof variables === 'string' ? JSON.parse(variables) : (variables || {}),
      userId,
      role: explicitRole,
      isAdmin,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[GraphQL Execution Error]:', err);
    return res.status(200).json({
      errors: [{ message: err.message || 'GraphQL Execution Error' }],
    });
  }
}

interface GraphQLContext {
  query: string;
  variables: Record<string, any>;
  userId: string;
  role: string;
  isAdmin: boolean;
}

async function executeGraphQL(ctx: GraphQLContext) {
  const { query, variables, userId, isAdmin } = ctx;
  const cleanQuery = query.replace(/\s+/g, ' ').trim();

  // Helper to get allowed org IDs for current user
  const memberships = userId ? await db.getUserMemberships(userId) : [];
  const allowedOrgIds = memberships.map(m => m.org_id);
  const membershipMap = new Map(memberships.map(m => [m.org_id, m.role]));

  // --- MUTATIONS ---
  if (cleanQuery.includes('mutation')) {
    // 1. triggerWorkflowRun
    if (cleanQuery.includes('triggerWorkflowRun')) {
      const workflowId = variables.workflow_id || extractArg(query, 'workflow_id');
      if (!workflowId) throw new Error('workflow_id is required');
      if (!userId && !isAdmin) throw new Error('401: Unauthorized');

      const result = await WorkflowExecutor.startRun({
        workflowId,
        callerUserId: userId,
        triggerType: 'manual',
      });

      return { data: { triggerWorkflowRun: result } };
    }

    // 2. approveStep
    if (cleanQuery.includes('approveStep')) {
      const stepRunId = variables.step_run_id || extractArg(query, 'step_run_id');
      if (!stepRunId) throw new Error('step_run_id is required');
      if (!userId && !isAdmin) throw new Error('401: Unauthorized');

      const result = await WorkflowExecutor.approveAndResume({
        stepRunId,
        callerUserId: userId,
      });

      return { data: { approveStep: result } };
    }

    // 2.5. insert_organizations_one / createOrganization
    if (cleanQuery.includes('insert_organizations_one') || cleanQuery.includes('createOrganization')) {
      const name = variables.name || variables.object?.name || 'New Organization';
      if (!userId && !isAdmin) throw new Error('401: Unauthorized');

      const created = await db.createOrganization(name, userId || 'system');
      return { data: { insert_organizations_one: created, createOrganization: created } };
    }

    // 3. insert_workflows_one / createWorkflow
    if (cleanQuery.includes('insert_workflows_one') || cleanQuery.includes('createWorkflow')) {
      const object = variables.object || variables;
      const orgId = object.org_id;

      if (!orgId) throw new Error('org_id is required');

      // Layer 1 Check: User must belong to organization
      if (!isAdmin) {
        if (!allowedOrgIds.includes(orgId)) {
          throw new Error(`403: Forbidden - User does not belong to organization ${orgId}`);
        }
        const userRole = membershipMap.get(orgId);
        if (userRole === 'viewer') {
          throw new Error('403: Forbidden - Viewers cannot create workflows');
        }

        // Layer 2 Check: Step-level and Trigger-level gating
        const steps = (object.steps?.data || object.steps || []) as WorkflowStep[];
        const triggers = (object.triggers?.data || object.triggers || []) as WorkflowTrigger[];

        if (userRole === 'editor') {
          // Check for restricted step types: db_write, notify
          for (const s of steps) {
            if (['db_write', 'notify'].includes(s.step_type)) {
              throw new Error(`403: Forbidden - Editors cannot add restricted step type: ${s.step_type}. Only Owners can add this step.`);
            }
          }
          // Check for restricted trigger types: webhook
          for (const t of triggers) {
            if (t.trigger_type === 'webhook') {
              throw new Error('403: Forbidden - Editors cannot add webhook triggers. Only Owners can add webhook triggers.');
            }
          }
        }
      }

      const created = await db.createWorkflow({
        org_id: orgId,
        name: object.name,
        description: object.description,
        created_by: userId || 'system',
        steps: object.steps?.data || object.steps || [],
        triggers: object.triggers?.data || object.triggers || [],
      });

      return { data: { insert_workflows_one: created, createWorkflow: created } };
    }

    // 4. update_workflows_by_pk / updateWorkflow
    if (cleanQuery.includes('update_workflows_by_pk') || cleanQuery.includes('updateWorkflow')) {
      const id = variables.id || variables.pk_columns?.id || extractArg(query, 'id');
      const set = variables._set || variables.updates || variables;
      const existing = await db.getWorkflow(id);

      if (!existing) throw new Error(`404: Workflow ${id} not found`);

      if (!isAdmin) {
        if (!allowedOrgIds.includes(existing.org_id)) {
          throw new Error('403: Forbidden - Cross-organization access denied');
        }
        const userRole = membershipMap.get(existing.org_id);
        if (userRole === 'viewer') {
          throw new Error('403: Forbidden - Viewers cannot modify workflows');
        }

        // Layer 2 Check on update
        if (userRole === 'editor') {
          const steps = (set.steps?.data || set.steps || []) as WorkflowStep[];
          for (const s of steps) {
            if (['db_write', 'notify'].includes(s.step_type)) {
              throw new Error(`403: Forbidden - Editors cannot configure ${s.step_type} steps`);
            }
          }
          const triggers = (set.triggers?.data || set.triggers || []) as WorkflowTrigger[];
          for (const t of triggers) {
            if (t.trigger_type === 'webhook') {
              throw new Error('403: Forbidden - Editors cannot configure webhook triggers');
            }
          }
        }
      }

      const updated = await db.updateWorkflow(id, {
        name: set.name,
        description: set.description,
        status: set.status,
        steps: set.steps?.data || set.steps,
        triggers: set.triggers?.data || set.triggers,
      });

      return { data: { update_workflows_by_pk: updated, updateWorkflow: updated } };
    }

    // 5. delete_workflows_by_pk
    if (cleanQuery.includes('delete_workflows_by_pk') || cleanQuery.includes('deleteWorkflow')) {
      const id = variables.id || extractArg(query, 'id');
      const existing = await db.getWorkflow(id);
      if (!existing) throw new Error(`404: Workflow ${id} not found`);

      if (!isAdmin) {
        if (!allowedOrgIds.includes(existing.org_id)) {
          throw new Error('403: Forbidden - Cross-organization access denied');
        }
        const userRole = membershipMap.get(existing.org_id);
        if (userRole !== 'owner') {
          throw new Error('403: Forbidden - Only Owners can delete workflows');
        }
      }

      await db.deleteWorkflow(id);
      return { data: { delete_workflows_by_pk: { id } } };
    }
  }

  // --- QUERIES ---

  // 1. Organization Usage Summary / Aggregation
  if (cleanQuery.includes('organization_usage_summary')) {
    const orgId = variables.org_id || variables.where?.org_id?._eq;
    if (orgId) {
      if (!isAdmin && !allowedOrgIds.includes(orgId)) {
        return { data: { organization_usage_summary: [] } };
      }
      const summary = await db.getOrgUsageSummary(orgId);
      return { data: { organization_usage_summary: summary ? [summary] : [] } };
    }

    const summaries = [];
    for (const oId of allowedOrgIds) {
      const s = await db.getOrgUsageSummary(oId);
      if (s) summaries.push(s);
    }
    return { data: { organization_usage_summary: summaries } };
  }

  // 2. Organizations
  if (cleanQuery.includes('organizations')) {
    const orgs = [];
    for (const orgId of allowedOrgIds) {
      const o = await db.getOrganization(orgId);
      if (o) orgs.push(o);
    }
    return { data: { organizations: orgs } };
  }

  // 3. Workflows list
  if (cleanQuery.includes('workflows(') || cleanQuery.includes('workflows {') || cleanQuery.includes('workflows_by_pk')) {
    if (cleanQuery.includes('workflows_by_pk')) {
      const id = variables.id || extractArg(query, 'id');
      const wf = await db.getWorkflow(id);
      if (!wf || (!isAdmin && !allowedOrgIds.includes(wf.org_id))) {
        return { data: { workflows_by_pk: null } }; // Security: return null on cross-org query
      }
      return { data: { workflows_by_pk: wf } };
    }

    const orgId = variables.org_id || variables.where?.org_id?._eq;
    if (orgId) {
      if (!isAdmin && !allowedOrgIds.includes(orgId)) {
        return { data: { workflows: [] } }; // Cross-org access blocked
      }
      const list = await db.listWorkflows(orgId);
      return { data: { workflows: list } };
    }

    const allWfs: any[] = [];
    for (const oId of allowedOrgIds) {
      const list = await db.listWorkflows(oId);
      allWfs.push(...list);
    }
    return { data: { workflows: allWfs } };
  }

  // 4. Workflow Runs & Step Runs
  if (cleanQuery.includes('workflow_runs')) {
    if (cleanQuery.includes('workflow_runs_by_pk')) {
      const id = variables.id || extractArg(query, 'id');
      const run = await db.getWorkflowRun(id);
      if (!run) return { data: { workflow_runs_by_pk: null } };

      const wf = await db.getWorkflow(run.workflow_id);
      if (!wf || (!isAdmin && !allowedOrgIds.includes(wf.org_id))) {
        return { data: { workflow_runs_by_pk: null } };
      }
      return { data: { workflow_runs_by_pk: run } };
    }

    const runId = variables.run_id || variables.where?.id?._eq;
    if (runId) {
      const run = await db.getWorkflowRun(runId);
      if (!run) return { data: { workflow_runs: [] } };
      const wf = await db.getWorkflow(run.workflow_id);
      if (!wf || (!isAdmin && !allowedOrgIds.includes(wf.org_id))) {
        return { data: { workflow_runs: [] } };
      }
      return { data: { workflow_runs: [run] } };
    }
  }

  if (cleanQuery.includes('step_runs')) {
    const runId = variables.workflow_run_id || variables.where?.workflow_run_id?._eq;
    if (runId) {
      const run = await db.getWorkflowRun(runId);
      if (!run) return { data: { step_runs: [] } };
      const wf = await db.getWorkflow(run.workflow_id);
      if (!wf || (!isAdmin && !allowedOrgIds.includes(wf.org_id))) {
        return { data: { step_runs: [] } };
      }
      const steps = await db.listStepRunsForWorkflowRun(runId);
      return { data: { step_runs: steps } };
    }
  }

  // 5. Notifications
  if (cleanQuery.includes('notifications')) {
    const orgId = variables.org_id || allowedOrgIds[0];
    if (orgId && (isAdmin || allowedOrgIds.includes(orgId))) {
      const notifs = await db.listNotifications(orgId);
      return { data: { notifications: notifs } };
    }
    return { data: { notifications: [] } };
  }

  return { data: {} };
}

function extractArg(query: string, argName: string): string | null {
  const regex = new RegExp(`${argName}:\\s*["']?([^"')\\s,]+)["']?`, 'i');
  const match = query.match(regex);
  return match ? match[1] : null;
}
