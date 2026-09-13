import { SourceReference } from '../documents/detailSchema';

export type DiagramType =
  | 'system_architecture'
  | 'application_architecture'
  | 'backend_architecture'
  | 'database_erd'
  | 'sequence_diagram'
  | 'flowchart'
  | 'microservices'
  | 'data_flow';

export type NodeCategory =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'queue'
  | 'llm'
  | 'storage'
  | 'external_service'
  | 'user'
  | 'security';

export interface ArchitectureNode {
  id: string;
  label: string;
  category: NodeCategory;
  technology?: string;
  description?: string;
}

export interface ArchitectureEdge {
  source: string;
  target: string;
  label?: string;
  protocol?: string;
  direction?: 'one_way' | 'two_way';
}

export interface ArchitectureGroup {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface ArchitectureDiagram {
  id: string;
  orgId: string;
  planId?: string;
  documentId?: string;
  title: string;
  type: DiagramType;
  description: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  groups: ArchitectureGroup[];
  mermaidCode: string;
  explanation: string;
  securityBoundaries: string[];
  assumptions: string[];
  sourceReferences: SourceReference[];
  createdAt: string;
}

export interface GenerateArchitectureParams {
  orgId: string;
  title: string;
  diagramType?: DiagramType;
  planContent?: any;
  documentDetails?: any;
  documentId?: string;
  documentName?: string;
}
