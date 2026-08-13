import { Pool, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { 
  Organization, 
  OrgMember, 
  Workflow, 
  WorkflowStep, 
  WorkflowTrigger, 
  WorkflowRun, 
  StepRun, 
  WorkflowData, 
  Notification,
  UserRole
} from '@/types';

// In-memory fallback database for local execution & testing
class InMemoryDb {
  organizations: Map<string, Organization> = new Map();
  org_members: Map<string, OrgMember> = new Map();
  workflows: Map<string, Workflow> = new Map();
  workflow_steps: Map<string, WorkflowStep> = new Map();
  workflow_triggers: Map<string, WorkflowTrigger> = new Map();
  workflow_runs: Map<string, WorkflowRun> = new Map();
  step_runs: Map<string, StepRun> = new Map();
  workflow_data: Map<string, WorkflowData> = new Map();
  notifications: Map<string, Notification> = new Map();

  constructor() {
    this.seedDefaults();
  }

  seedDefaults() {
    // Org A
    const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    this.organizations.set(orgAId, {
      id: orgAId,
      name: 'Acme Corp (Org A)',
      calls_used: 0,
      calls_allowed: 100,
      quota_period_start: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Org B
    const orgBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    this.organizations.set(orgBId, {
      id: orgBId,
      name: 'Beta Labs (Org B)',
      calls_used: 0,
      calls_allowed: 50,
      quota_period_start: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Org A Members
    this.addOrgMember('a1111111-1111-1111-1111-111111111111', orgAId, 'owner', 'a0000001-0000-0000-0000-000000000001');
    this.addOrgMember('a2222222-2222-2222-2222-222222222222', orgAId, 'editor', 'a0000002-0000-0000-0000-000000000002');
    this.addOrgMember('a3333333-3333-3333-3333-333333333333', orgAId, 'viewer', 'a0000003-0000-0000-0000-000000000003');

    // Org B Members
    this.addOrgMember('b1111111-1111-1111-1111-111111111111', orgBId, 'owner', 'b0000001-0000-0000-0000-000000000001');
    this.addOrgMember('b2222222-2222-2222-2222-222222222222', orgBId, 'editor', 'b0000002-0000-0000-0000-000000000002');
    this.addOrgMember('b3333333-3333-3333-3333-333333333333', orgBId, 'viewer', 'b0000003-0000-0000-0000-000000000003');

    // Multi-tenant user (belongs to both orgs)
    this.addOrgMember('ab111111-1111-1111-1111-111111111111', orgAId, 'editor', 'ab000001-0000-0000-0000-000000000001');
    this.addOrgMember('ab111111-1111-1111-1111-111111111111', orgBId, 'viewer', 'ab000002-0000-0000-0000-000000000002');

    // Org A Demo Workflow 1: 5-step chained AI pipeline
    const wf1Id = 'w1111111-1111-1111-1111-111111111111';
    const now = new Date().toISOString();
    this.workflows.set(wf1Id, {
      id: wf1Id,
      org_id: orgAId,
      name: 'Customer Sentiment & Action Pipeline (Final Demo)',
      description: '5-step chained AI pipeline: LLM Analysis -> HTTP Enrich -> Conditional Branch -> Human Approval Gate -> DB Persistence.',
      status: 'active',
      created_by: 'a1111111-1111-1111-1111-111111111111',
      created_at: now,
      updated_at: now,
    });

    const s1Id = 's1111111-1111-1111-1111-111111111111';
    this.workflow_steps.set(s1Id, {
      id: s1Id,
      workflow_id: wf1Id,
      name: 'Step 1: LLM Sentiment Classifier',
      step_type: 'llm_call',
      position: 0,
      config: {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        prompt: 'Please classify the following feedback: "I had a great experience with the customer support team, they resolved my issue immediately!" as positive, negative, or neutral.',
      },
      created_at: now,
      updated_at: now,
    });

    const s2Id = 's2222222-2222-2222-2222-222222222222';
    this.workflow_steps.set(s2Id, {
      id: s2Id,
      workflow_id: wf1Id,
      name: 'Step 2: HTTP Customer Enrichment',
      step_type: 'http_request',
      position: 1,
      config: {
        method: 'GET',
        url: 'https://httpbin.org/json',
      },
      created_at: now,
      updated_at: now,
    });

    const s3Id = 's3333333-3333-3333-3333-333333333333';
    this.workflow_steps.set(s3Id, {
      id: s3Id,
      workflow_id: wf1Id,
      name: 'Step 3: Conditional Branching',
      step_type: 'conditional_branch',
      position: 2,
      config: {
        operator: 'contains',
        value: 'positive',
        true_branch: 'VIP_FAST_TRACK',
        false_branch: 'SUPPORT_ESCALATION',
      },
      created_at: now,
      updated_at: now,
    });

    const s4Id = 's4444444-4444-4444-4444-444444444444';
    this.workflow_steps.set(s4Id, {
      id: s4Id,
      workflow_id: wf1Id,
      name: 'Step 4: Approval Gate',
      step_type: 'approval_gate',
      position: 3,
      config: {
        message: 'Require Manager Review before updating CRM record with AI classification.',
      },
      created_at: now,
      updated_at: now,
    });

    const s5Id = 's5555555-5555-5555-5555-555555555555';
    this.workflow_steps.set(s5Id, {
      id: s5Id,
      workflow_id: wf1Id,
      name: 'Step 5: Database Write & Persistence',
      step_type: 'db_write',
      position: 4,
      config: {
        key: 'customer_intelligence_record',
        payload: {
          status: 'verified_by_approval',
          branch_route: '{{steps.Step 3: Conditional Branching.output.branchSelected}}',
          llm_sentiment: '{{steps.Step 1: LLM Sentiment Classifier.output.sentiment}}',
        },
      },
      created_at: now,
      updated_at: now,
    });

    const t1Id = 't1111111-1111-1111-1111-111111111111';
    this.workflow_triggers.set(t1Id, {
      id: t1Id,
      workflow_id: wf1Id,
      trigger_type: 'manual',
      config: {},
      enabled: true,
      created_at: now,
    });

    const t2Id = 't2222222-2222-2222-2222-222222222222';
    this.workflow_triggers.set(t2Id, {
      id: t2Id,
      workflow_id: wf1Id,
      trigger_type: 'webhook',
      config: { path: '/api/webhook' },
      enabled: true,
      created_at: now,
    });

    // Org B Demo Workflow
    const wfBId = 'wbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    this.workflows.set(wfBId, {
      id: wfBId,
      org_id: orgBId,
      name: 'Support Ticket Classifier & Routing (Beta Labs)',
      description: 'Org B isolated pipeline: Classify inbound support queries and route urgent tickets.',
      status: 'active',
      created_by: 'b1111111-1111-1111-1111-111111111111',
      created_at: now,
      updated_at: now,
    });

    const sb1Id = 'sb111111-1111-1111-1111-111111111111';
    this.workflow_steps.set(sb1Id, {
      id: sb1Id,
      workflow_id: wfBId,
      name: 'Step 1: Triage Prompt Analysis',
      step_type: 'llm_call',
      position: 0,
      config: {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        prompt: 'Analyze severity: "Payment gateway timeout on checkout page."',
      },
      created_at: now,
      updated_at: now,
    });

    const sb2Id = 'sb222222-2222-2222-2222-222222222222';
    this.workflow_steps.set(sb2Id, {
      id: sb2Id,
      workflow_id: wfBId,
      name: 'Step 2: Persist Ticket Record',
      step_type: 'db_write',
      position: 1,
      config: {
        key: 'support_ticket_record',
        payload: { priority: 'high', queue: 'payments' },
      },
      created_at: now,
      updated_at: now,
    });

    const tb1Id = 'tb111111-1111-1111-1111-111111111111';
    this.workflow_triggers.set(tb1Id, {
      id: tb1Id,
      workflow_id: wfBId,
      trigger_type: 'manual',
      config: {},
      enabled: true,
      created_at: now,
    });
  }

  addOrgMember(userId: string, orgId: string, role: UserRole, id = uuidv4()) {
    const member: OrgMember = {
      id,
      user_id: userId,
      org_id: orgId,
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.org_members.set(id, member);
  }

  reset() {
    this.organizations.clear();
    this.org_members.clear();
    this.workflows.clear();
    this.workflow_steps.clear();
    this.workflow_triggers.clear();
    this.workflow_runs.clear();
    this.step_runs.clear();
    this.workflow_data.clear();
    this.notifications.clear();
    this.seedDefaults();
  }
}

// Global Singleton Memory DB
export const inMemoryDb = new InMemoryDb();

// PostgreSQL Pool Connection
let pool: Pool | null = null;
let usePostgres = false;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
    });
  } catch (err) {
    console.warn('[DB] PostgreSQL pool initialization failed, using in-memory store fallback');
    pool = null;
  }
}

// Test postgres connectivity
export async function checkPostgresConnection(): Promise<boolean> {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    usePostgres = true;
    return true;
  } catch {
    usePostgres = false;
    return false;
  }
}

// Event Emitter for GraphQL Subscriptions
type SubscriptionListener = (data: any) => void;
class PubSubManager {
  private listeners: Map<string, Set<SubscriptionListener>> = new Map();

  subscribe(topic: string, listener: SubscriptionListener): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    this.listeners.get(topic)!.add(listener);
    return () => {
      this.listeners.get(topic)?.delete(listener);
    };
  }

  publish(topic: string, data: any) {
    const topicListeners = this.listeners.get(topic);
    if (topicListeners) {
      topicListeners.forEach(listener => {
        try {
          listener(data);
        } catch (e) {
          console.error('[PubSub] Listener error:', e);
        }
      });
    }
  }
}

export const pubsub = new PubSubManager();

// Export Database Service Layer
export const db = {
  // Organizations
  async getOrganization(orgId: string): Promise<Organization | null> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query('SELECT * FROM public.organizations WHERE id = $1', [orgId]);
        return res.rows[0] || null;
      } catch (err) {
        console.warn('[DB] Postgres query failed, falling back to memory:', err);
      }
    }
    return inMemoryDb.organizations.get(orgId) || null;
  },

  async updateOrganizationQuota(orgId: string, callsUsed: number): Promise<void> {
    if (usePostgres && pool) {
      try {
        await pool.query(
          'UPDATE public.organizations SET calls_used = $1, updated_at = NOW() WHERE id = $2',
          [callsUsed, orgId]
        );
      } catch (err) {
        console.warn('[DB] Postgres quota update failed:', err);
      }
    }
    const org = inMemoryDb.organizations.get(orgId);
    if (org) {
      org.calls_used = callsUsed;
      org.updated_at = new Date().toISOString();
    }
  },

  async incrementQuotaAtomically(orgId: string): Promise<boolean> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query(
          `UPDATE public.organizations 
           SET calls_used = calls_used + 1, updated_at = NOW() 
           WHERE id = $1 AND calls_used < calls_allowed 
           RETURNING calls_used, calls_allowed`,
          [orgId]
        );
        if (res.rowCount && res.rowCount > 0) {
          const org = inMemoryDb.organizations.get(orgId);
          if (org) org.calls_used = res.rows[0].calls_used;
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[DB] Postgres atomic increment error, memory fallback:', err);
      }
    }
    const org = inMemoryDb.organizations.get(orgId);
    if (!org) return false;
    if (org.calls_used >= org.calls_allowed) return false;
    org.calls_used += 1;
    org.updated_at = new Date().toISOString();
    return true;
  },

  async getOrgUsageSummary(orgId: string) {
    const org = await this.getOrganization(orgId);
    if (!org) return null;
    return {
      org_id: org.id,
      name: org.name,
      calls_used: org.calls_used,
      calls_allowed: org.calls_allowed,
      remaining: Math.max(0, org.calls_allowed - org.calls_used),
      quota_period_start: org.quota_period_start,
      created_at: org.created_at,
      updated_at: org.updated_at,
    };
  },

  // Org Members
  async getOrgMember(userId: string, orgId: string): Promise<OrgMember | null> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query(
          'SELECT * FROM public.org_members WHERE user_id = $1 AND org_id = $2',
          [userId, orgId]
        );
        return res.rows[0] || null;
      } catch (err) {
        console.warn('[DB] Postgres member query failed:', err);
      }
    }
    for (const member of inMemoryDb.org_members.values()) {
      if (member.user_id === userId && member.org_id === orgId) {
        return member;
      }
    }
    return null;
  },

  async getUserMemberships(userId: string): Promise<OrgMember[]> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query(
          `SELECT m.*, row_to_json(o) as organization 
           FROM public.org_members m 
           JOIN public.organizations o ON m.org_id = o.id 
           WHERE m.user_id = $1`,
          [userId]
        );
        return res.rows;
      } catch (err) {
        console.warn('[DB] Postgres memberships query failed:', err);
      }
    }
    const members: OrgMember[] = [];
    for (const member of inMemoryDb.org_members.values()) {
      if (member.user_id === userId) {
        const org = inMemoryDb.organizations.get(member.org_id);
        members.push({ ...member, organization: org });
      }
    }
    return members;
  },

  // Workflows
  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query('SELECT * FROM public.workflows WHERE id = $1', [workflowId]);
        if (res.rows[0]) {
          const stepsRes = await pool.query(
            'SELECT * FROM public.workflow_steps WHERE workflow_id = $1 ORDER BY position ASC',
            [workflowId]
          );
          const triggersRes = await pool.query(
            'SELECT * FROM public.workflow_triggers WHERE workflow_id = $1',
            [workflowId]
          );
          return {
            ...res.rows[0],
            steps: stepsRes.rows,
            triggers: triggersRes.rows,
          };
        }
      } catch (err) {
        console.warn('[DB] Postgres workflow query failed:', err);
      }
    }
    const wf = inMemoryDb.workflows.get(workflowId);
    if (!wf) return null;
    const steps = Array.from(inMemoryDb.workflow_steps.values())
      .filter(s => s.workflow_id === workflowId)
      .sort((a, b) => a.position - b.position);
    const triggers = Array.from(inMemoryDb.workflow_triggers.values())
      .filter(t => t.workflow_id === workflowId);
    return { ...wf, steps, triggers };
  },

  async listWorkflows(orgId: string): Promise<Workflow[]> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query(
          'SELECT * FROM public.workflows WHERE org_id = $1 ORDER BY created_at DESC',
          [orgId]
        );
        const workflows: Workflow[] = [];
        for (const wf of res.rows) {
          const steps = await pool.query(
            'SELECT * FROM public.workflow_steps WHERE workflow_id = $1 ORDER BY position ASC',
            [wf.id]
          );
          const triggers = await pool.query(
            'SELECT * FROM public.workflow_triggers WHERE workflow_id = $1',
            [wf.id]
          );
          const runs = await pool.query(
            'SELECT * FROM public.workflow_runs WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT 5',
            [wf.id]
          );
          workflows.push({ ...wf, steps: steps.rows, triggers: triggers.rows, runs: runs.rows });
        }
        return workflows;
      } catch (err) {
        console.warn('[DB] Postgres listWorkflows error:', err);
      }
    }
    return Array.from(inMemoryDb.workflows.values())
      .filter(wf => wf.org_id === orgId)
      .map(wf => {
        const steps = Array.from(inMemoryDb.workflow_steps.values())
          .filter(s => s.workflow_id === wf.id)
          .sort((a, b) => a.position - b.position);
        const triggers = Array.from(inMemoryDb.workflow_triggers.values())
          .filter(t => t.workflow_id === wf.id);
        const runs = Array.from(inMemoryDb.workflow_runs.values())
          .filter(r => r.workflow_id === wf.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);
        return { ...wf, steps, triggers, runs };
      });
  },

  async createWorkflow(data: {
    org_id: string;
    name: string;
    description?: string;
    created_by: string;
    steps?: Array<Omit<WorkflowStep, 'id' | 'workflow_id' | 'created_at' | 'updated_at'>>;
    triggers?: Array<Omit<WorkflowTrigger, 'id' | 'workflow_id' | 'created_at'>>;
  }): Promise<Workflow> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const wf: Workflow = {
      id,
      org_id: data.org_id,
      name: data.name,
      description: data.description || '',
      status: 'active',
      created_by: data.created_by,
      created_at: now,
      updated_at: now,
      steps: [],
      triggers: [],
    };

    if (usePostgres && pool) {
      try {
        await pool.query(
          `INSERT INTO public.workflows (id, org_id, name, description, status, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [wf.id, wf.org_id, wf.name, wf.description, wf.status, wf.created_by, wf.created_at, wf.updated_at]
        );
      } catch (err) {
        console.warn('[DB] Postgres insert workflow error:', err);
      }
    }
    inMemoryDb.workflows.set(id, wf);

    if (data.steps && data.steps.length > 0) {
      for (const stepData of data.steps) {
        await this.createWorkflowStep(id, stepData);
      }
    }

    if (data.triggers && data.triggers.length > 0) {
      for (const triggerData of data.triggers) {
        await this.createWorkflowTrigger(id, triggerData);
      }
    }

    return (await this.getWorkflow(id))!;
  },

  async updateWorkflow(
    workflowId: string, 
    data: { 
      name?: string; 
      description?: string; 
      status?: 'active' | 'draft' | 'archived';
      steps?: Array<Omit<WorkflowStep, 'id' | 'workflow_id' | 'created_at' | 'updated_at'>>;
      triggers?: Array<Omit<WorkflowTrigger, 'id' | 'workflow_id' | 'created_at'>>;
    }
  ): Promise<Workflow | null> {
    const wf = await this.getWorkflow(workflowId);
    if (!wf) return null;
    const now = new Date().toISOString();

    if (data.name !== undefined) wf.name = data.name;
    if (data.description !== undefined) wf.description = data.description;
    if (data.status !== undefined) wf.status = data.status;
    wf.updated_at = now;

    if (usePostgres && pool) {
      try {
        await pool.query(
          `UPDATE public.workflows SET name = $1, description = $2, status = $3, updated_at = $4 WHERE id = $5`,
          [wf.name, wf.description, wf.status, wf.updated_at, workflowId]
        );
      } catch (err) {
        console.warn('[DB] Postgres update workflow error:', err);
      }
    }
    inMemoryDb.workflows.set(workflowId, wf);

    if (data.steps) {
      // Clear existing steps and insert new ones
      if (usePostgres && pool) {
        try {
          await pool.query('DELETE FROM public.workflow_steps WHERE workflow_id = $1', [workflowId]);
        } catch {}
      }
      for (const [sId, step] of inMemoryDb.workflow_steps.entries()) {
        if (step.workflow_id === workflowId) {
          inMemoryDb.workflow_steps.delete(sId);
        }
      }
      for (const stepData of data.steps) {
        await this.createWorkflowStep(workflowId, stepData);
      }
    }

    if (data.triggers) {
      if (usePostgres && pool) {
        try {
          await pool.query('DELETE FROM public.workflow_triggers WHERE workflow_id = $1', [workflowId]);
        } catch {}
      }
      for (const [tId, trg] of inMemoryDb.workflow_triggers.entries()) {
        if (trg.workflow_id === workflowId) {
          inMemoryDb.workflow_triggers.delete(tId);
        }
      }
      for (const triggerData of data.triggers) {
        await this.createWorkflowTrigger(workflowId, triggerData);
      }
    }

    return await this.getWorkflow(workflowId);
  },

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    if (usePostgres && pool) {
      try {
        await pool.query('DELETE FROM public.workflows WHERE id = $1', [workflowId]);
      } catch (err) {
        console.warn('[DB] Postgres delete workflow error:', err);
      }
    }
    inMemoryDb.workflows.delete(workflowId);
    return true;
  },

  async createWorkflowStep(
    workflowId: string, 
    data: Omit<WorkflowStep, 'id' | 'workflow_id' | 'created_at' | 'updated_at'>
  ): Promise<WorkflowStep> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const step: WorkflowStep = {
      id,
      workflow_id: workflowId,
      name: data.name,
      step_type: data.step_type,
      position: data.position,
      config: data.config || {},
      created_at: now,
      updated_at: now,
    };

    if (usePostgres && pool) {
      try {
        await pool.query(
          `INSERT INTO public.workflow_steps (id, workflow_id, name, step_type, position, config, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [step.id, step.workflow_id, step.name, step.step_type, step.position, JSON.stringify(step.config), step.created_at, step.updated_at]
        );
      } catch (err) {
        console.warn('[DB] Postgres insert step error:', err);
      }
    }
    inMemoryDb.workflow_steps.set(id, step);
    return step;
  },

  async createWorkflowTrigger(
    workflowId: string,
    data: Omit<WorkflowTrigger, 'id' | 'workflow_id' | 'created_at'>
  ): Promise<WorkflowTrigger> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const trigger: WorkflowTrigger = {
      id,
      workflow_id: workflowId,
      trigger_type: data.trigger_type,
      config: data.config || {},
      enabled: data.enabled !== undefined ? data.enabled : true,
      created_at: now,
    };

    if (usePostgres && pool) {
      try {
        await pool.query(
          `INSERT INTO public.workflow_triggers (id, workflow_id, trigger_type, config, enabled, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [trigger.id, trigger.workflow_id, trigger.trigger_type, JSON.stringify(trigger.config), trigger.enabled, trigger.created_at]
        );
      } catch (err) {
        console.warn('[DB] Postgres insert trigger error:', err);
      }
    }
    inMemoryDb.workflow_triggers.set(id, trigger);
    return trigger;
  },

  // Workflow Runs
  async createWorkflowRun(data: {
    workflow_id: string;
    triggered_by?: string | null;
    trigger_type: string;
  }): Promise<WorkflowRun> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const run: WorkflowRun = {
      id,
      workflow_id: data.workflow_id,
      triggered_by: data.triggered_by || null,
      trigger_type: data.trigger_type,
      status: 'pending',
      started_at: now,
      completed_at: null,
      error: null,
      created_at: now,
      step_runs: [],
    };

    if (usePostgres && pool) {
      try {
        await pool.query(
          `INSERT INTO public.workflow_runs (id, workflow_id, triggered_by, trigger_type, status, started_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [run.id, run.workflow_id, run.triggered_by, run.trigger_type, run.status, run.started_at, run.created_at]
        );
      } catch (err) {
        console.warn('[DB] Postgres insert run error:', err);
      }
    }
    inMemoryDb.workflow_runs.set(id, run);
    pubsub.publish(`workflow_run:${id}`, run);
    return run;
  },

  async updateWorkflowRun(runId: string, updates: Partial<WorkflowRun>): Promise<WorkflowRun | null> {
    const run = inMemoryDb.workflow_runs.get(runId);
    if (!run) return null;
    Object.assign(run, updates);

    if (usePostgres && pool) {
      try {
        const fields: string[] = [];
        const values: any[] = [];
        let i = 1;
        if (updates.status !== undefined) { fields.push(`status = $${i++}`); values.push(updates.status); }
        if (updates.started_at !== undefined) { fields.push(`started_at = $${i++}`); values.push(updates.started_at); }
        if (updates.completed_at !== undefined) { fields.push(`completed_at = $${i++}`); values.push(updates.completed_at); }
        if (updates.error !== undefined) { fields.push(`error = $${i++}`); values.push(updates.error); }
        if (fields.length > 0) {
          values.push(runId);
          await pool.query(`UPDATE public.workflow_runs SET ${fields.join(', ')} WHERE id = $${i}`, values);
        }
      } catch (err) {
        console.warn('[DB] Postgres update run error:', err);
      }
    }

    pubsub.publish(`workflow_run:${runId}`, run);
    return run;
  },

  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query('SELECT * FROM public.workflow_runs WHERE id = $1', [runId]);
        if (res.rows[0]) {
          const stepRunsRes = await pool.query(
            `SELECT sr.*, row_to_json(ws) as step 
             FROM public.step_runs sr 
             JOIN public.workflow_steps ws ON sr.workflow_step_id = ws.id 
             WHERE sr.workflow_run_id = $1 
             ORDER BY ws.position ASC`,
            [runId]
          );
          const dataRes = await pool.query('SELECT * FROM public.workflow_data WHERE workflow_run_id = $1', [runId]);
          return {
            ...res.rows[0],
            step_runs: stepRunsRes.rows,
            workflow_data: dataRes.rows,
          };
        }
      } catch (err) {
        console.warn('[DB] Postgres get run error:', err);
      }
    }
    const run = inMemoryDb.workflow_runs.get(runId);
    if (!run) return null;
    const step_runs = Array.from(inMemoryDb.step_runs.values())
      .filter(sr => sr.workflow_run_id === runId)
      .map(sr => {
        const step = inMemoryDb.workflow_steps.get(sr.workflow_step_id);
        return { ...sr, step };
      })
      .sort((a, b) => (a.step?.position || 0) - (b.step?.position || 0));
    const workflow_data = Array.from(inMemoryDb.workflow_data.values())
      .filter(wd => wd.workflow_run_id === runId);
    return { ...run, step_runs, workflow_data };
  },

  // Step Runs
  async createStepRun(data: {
    workflow_run_id: string;
    workflow_step_id: string;
    status?: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
    input?: Record<string, any>;
  }): Promise<StepRun> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stepRun: StepRun = {
      id,
      workflow_run_id: data.workflow_run_id,
      workflow_step_id: data.workflow_step_id,
      status: data.status || 'pending',
      input: data.input || {},
      output: null,
      error: null,
      attempt_count: 0,
      approved_by: null,
      approved_at: null,
      started_at: data.status === 'running' ? now : null,
      completed_at: null,
      created_at: now,
    };

    if (usePostgres && pool) {
      try {
        await pool.query(
          `INSERT INTO public.step_runs (id, workflow_run_id, workflow_step_id, status, input, attempt_count, started_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [stepRun.id, stepRun.workflow_run_id, stepRun.workflow_step_id, stepRun.status, JSON.stringify(stepRun.input), stepRun.attempt_count, stepRun.started_at, stepRun.created_at]
        );
      } catch (err) {
        console.warn('[DB] Postgres insert step run error:', err);
      }
    }

    inMemoryDb.step_runs.set(id, stepRun);
    pubsub.publish(`step_run:${data.workflow_run_id}`, stepRun);
    pubsub.publish(`step_runs:${data.workflow_run_id}`, await this.listStepRunsForWorkflowRun(data.workflow_run_id));
    return stepRun;
  },

  async updateStepRun(stepRunId: string, updates: Partial<StepRun>): Promise<StepRun | null> {
    const sr = inMemoryDb.step_runs.get(stepRunId);
    if (!sr) return null;
    Object.assign(sr, updates);

    if (usePostgres && pool) {
      try {
        const fields: string[] = [];
        const values: any[] = [];
        let i = 1;
        if (updates.status !== undefined) { fields.push(`status = $${i++}`); values.push(updates.status); }
        if (updates.input !== undefined) { fields.push(`input = $${i++}`); values.push(JSON.stringify(updates.input)); }
        if (updates.output !== undefined) { fields.push(`output = $${i++}`); values.push(JSON.stringify(updates.output)); }
        if (updates.error !== undefined) { fields.push(`error = $${i++}`); values.push(updates.error); }
        if (updates.attempt_count !== undefined) { fields.push(`attempt_count = $${i++}`); values.push(updates.attempt_count); }
        if (updates.approved_by !== undefined) { fields.push(`approved_by = $${i++}`); values.push(updates.approved_by); }
        if (updates.approved_at !== undefined) { fields.push(`approved_at = $${i++}`); values.push(updates.approved_at); }
        if (updates.started_at !== undefined) { fields.push(`started_at = $${i++}`); values.push(updates.started_at); }
        if (updates.completed_at !== undefined) { fields.push(`completed_at = $${i++}`); values.push(updates.completed_at); }
        if (fields.length > 0) {
          values.push(stepRunId);
          await pool.query(`UPDATE public.step_runs SET ${fields.join(', ')} WHERE id = $${i}`, values);
        }
      } catch (err) {
        console.warn('[DB] Postgres update step run error:', err);
      }
    }

    const step = inMemoryDb.workflow_steps.get(sr.workflow_step_id);
    const enriched = { ...sr, step };
    pubsub.publish(`step_run:${sr.workflow_run_id}`, enriched);
    pubsub.publish(`step_runs:${sr.workflow_run_id}`, await this.listStepRunsForWorkflowRun(sr.workflow_run_id));
    return sr;
  },

  async getStepRun(stepRunId: string): Promise<StepRun | null> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query('SELECT * FROM public.step_runs WHERE id = $1', [stepRunId]);
        if (res.rows[0]) {
          const stepRes = await pool.query('SELECT * FROM public.workflow_steps WHERE id = $1', [res.rows[0].workflow_step_id]);
          return { ...res.rows[0], step: stepRes.rows[0] };
        }
      } catch {}
    }
    const sr = inMemoryDb.step_runs.get(stepRunId);
    if (!sr) return null;
    const step = inMemoryDb.workflow_steps.get(sr.workflow_step_id);
    return { ...sr, step };
  },

  async listStepRunsForWorkflowRun(workflowRunId: string): Promise<StepRun[]> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query(
          `SELECT sr.*, row_to_json(ws) as step 
           FROM public.step_runs sr 
           JOIN public.workflow_steps ws ON sr.workflow_step_id = ws.id 
           WHERE sr.workflow_run_id = $1 
           ORDER BY ws.position ASC`,
          [workflowRunId]
        );
        return res.rows;
      } catch {}
    }
    return Array.from(inMemoryDb.step_runs.values())
      .filter(sr => sr.workflow_run_id === workflowRunId)
      .map(sr => ({ ...sr, step: inMemoryDb.workflow_steps.get(sr.workflow_step_id) }))
      .sort((a, b) => (a.step?.position || 0) - (b.step?.position || 0));
  },

  // Workflow Data (db_write)
  async createWorkflowData(data: {
    workflow_run_id: string;
    org_id: string;
    key: string;
    payload: Record<string, any>;
  }): Promise<WorkflowData> {
    const id = uuidv4();
    const wd: WorkflowData = {
      id,
      workflow_run_id: data.workflow_run_id,
      org_id: data.org_id,
      key: data.key,
      payload: data.payload,
      created_at: new Date().toISOString(),
    };

    if (usePostgres && pool) {
      try {
        await pool.query(
          `INSERT INTO public.workflow_data (id, workflow_run_id, org_id, key, payload, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [wd.id, wd.workflow_run_id, wd.org_id, wd.key, JSON.stringify(wd.payload), wd.created_at]
        );
      } catch {}
    }
    inMemoryDb.workflow_data.set(id, wd);
    return wd;
  },

  // Notifications
  async createNotification(data: {
    workflow_run_id?: string | null;
    org_id: string;
    channel?: string;
    message: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    const id = uuidv4();
    const notif: Notification = {
      id,
      workflow_run_id: data.workflow_run_id || null,
      org_id: data.org_id,
      channel: data.channel || 'in_app',
      message: data.message,
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
    };

    if (usePostgres && pool) {
      try {
        await pool.query(
          `INSERT INTO public.notifications (id, workflow_run_id, org_id, channel, message, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [notif.id, notif.workflow_run_id, notif.org_id, notif.channel, notif.message, JSON.stringify(notif.metadata), notif.created_at]
        );
      } catch {}
    }
    inMemoryDb.notifications.set(id, notif);
    pubsub.publish(`notifications:${data.org_id}`, notif);
    return notif;
  },

  async listNotifications(orgId: string): Promise<Notification[]> {
    if (usePostgres && pool) {
      try {
        const res = await pool.query(
          'SELECT * FROM public.notifications WHERE org_id = $1 ORDER BY created_at DESC LIMIT 20',
          [orgId]
        );
        return res.rows;
      } catch {}
    }
    return Array.from(inMemoryDb.notifications.values())
      .filter(n => n.org_id === orgId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
};
