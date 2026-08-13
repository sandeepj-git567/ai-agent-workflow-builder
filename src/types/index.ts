export type UserRole = 'owner' | 'editor' | 'viewer';

export type StepType = 
  | 'llm_call' 
  | 'http_request' 
  | 'db_write' 
  | 'notify' 
  | 'conditional_branch' 
  | 'approval_gate';

export type TriggerType = 
  | 'manual' 
  | 'webhook' 
  | 'scheduled' 
  | 'database_event';

export type WorkflowStatus = 'active' | 'draft' | 'archived';

export type RunStatus = 
  | 'pending' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type StepRunStatus = 
  | 'pending' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'skipped';

export interface Organization {
  id: string;
  name: string;
  calls_used: number;
  calls_allowed: number;
  quota_period_start: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  org_id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  steps?: WorkflowStep[];
  triggers?: WorkflowTrigger[];
  runs?: WorkflowRun[];
  organization?: Organization;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  name: string;
  step_type: StepType;
  position: number;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTrigger {
  id: string;
  workflow_id: string;
  trigger_type: TriggerType;
  config: Record<string, any>;
  enabled: boolean;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  triggered_by: string | null;
  trigger_type: TriggerType | string;
  status: RunStatus;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  step_runs?: StepRun[];
  workflow?: Workflow;
  workflow_data?: WorkflowData[];
}

export interface StepRun {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  status: StepRunStatus;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  error: string | null;
  attempt_count: number;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  step?: WorkflowStep;
}

export interface WorkflowData {
  id: string;
  workflow_run_id: string;
  org_id: string;
  key: string;
  payload: Record<string, any>;
  created_at: string;
}

export interface Notification {
  id: string;
  workflow_run_id: string | null;
  org_id: string;
  channel: string;
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface OrgUsageSummary {
  org_id: string;
  name: string;
  calls_used: number;
  calls_allowed: number;
  remaining: number;
  quota_period_start: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  orgMemberships: Array<{
    orgId: string;
    orgName: string;
    role: UserRole;
  }>;
}

export interface HasuraActionPayload<T = Record<string, any>> {
  action: {
    name: string;
  };
  input: T;
  session_variables: {
    'x-hasura-user-id'?: string;
    'x-hasura-role'?: string;
    'x-hasura-allowed-roles'?: string[];
    [key: string]: any;
  };
}
