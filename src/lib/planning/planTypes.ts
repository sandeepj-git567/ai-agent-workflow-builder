import { SourceReference } from '../documents/detailSchema';

export type PlanComplexity = 'low' | 'medium' | 'high';
export type PlanPriority = 'low' | 'medium' | 'high' | 'critical';

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  type: string; // step_type e.g. llm_call, http_request, approval_gate, etc.
  priority: PlanPriority;
  dependencies: string[];
  estimatedComplexity: PlanComplexity;
  requiresApproval: boolean;
  output: string;
}

export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  tasks: PlanTask[];
}

export interface DatabaseEntity {
  name: string;
  description: string;
  fields: string[];
}

export interface ApiRequirement {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  requiresAuth: boolean;
}

export interface ProjectPlan {
  id: string;
  orgId: string;
  title: string;
  description: string;
  goals: string[];
  scope: string[];
  outOfScope: string[];
  phases: PlanPhase[];
  technologies: string[];
  architectureNotes: string[];
  databaseEntities: DatabaseEntity[];
  apiRequirements: ApiRequirement[];
  risks: { title: string; description: string; severity: string }[];
  assumptions: string[];
  testingStrategy: string[];
  deploymentStrategy: string[];
  acceptanceCriteria: string[];
  sourceReferences: SourceReference[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePlanParams {
  orgId: string;
  title: string;
  prompt?: string;
  documentDetails?: any;
  documentId?: string;
  documentName?: string;
}
