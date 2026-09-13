export interface SourceReference {
  documentId?: string;
  documentName?: string;
  pageNumber?: number;
  sectionTitle?: string;
  chunkId?: string;
  snippet?: string;
}

export interface RequirementItem {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'functional' | 'non_functional' | 'business' | 'security';
  sourceReferences?: SourceReference[];
}

export interface StakeholderItem {
  name: string;
  role: string;
  department?: string;
  responsibility?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  type?: string;
  priority?: string;
  dependencies?: string[];
  requiresApproval?: boolean;
}

export interface MilestoneItem {
  id: string;
  title: string;
  targetDate?: string;
  deliverables?: string[];
}

export interface DependencyItem {
  id: string;
  description: string;
  type: 'internal' | 'external' | 'technical';
}

export interface RiskItem {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
}

export interface ExtractedDocumentDetails {
  documentId: string;
  title: string;
  summary: string;
  purpose: string;
  objectives: string[];
  requirements: RequirementItem[];
  stakeholders: StakeholderItem[];
  tasks: TaskItem[];
  milestones: MilestoneItem[];
  dependencies: DependencyItem[];
  risks: RiskItem[];
  constraints: string[];
  assumptions: string[];
  inputs: string[];
  outputs: string[];
  technologies: string[];
  integrations: string[];
  approvalRequirements: string[];
  acceptanceCriteria: string[];
  openQuestions: string[];
  sourceReferences: SourceReference[];
}
