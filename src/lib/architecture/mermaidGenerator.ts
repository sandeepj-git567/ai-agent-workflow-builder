import { ArchitectureEdge, ArchitectureGroup, ArchitectureNode, DiagramType } from './architectureTypes';

export class MermaidGenerator {
  /**
   * Generates clean, syntactically valid Mermaid.js diagram markup.
   */
  static generateMermaid(type: DiagramType, nodes: ArchitectureNode[], edges: ArchitectureEdge[], groups: ArchitectureGroup[] = []): string {
    switch (type) {
      case 'sequence_diagram':
        return this.generateSequenceDiagram(nodes, edges);
      case 'database_erd':
        return this.generateERDiagram(nodes, edges);
      case 'flowchart':
      case 'system_architecture':
      case 'application_architecture':
      case 'backend_architecture':
      case 'microservices':
      case 'data_flow':
      default:
        return this.generateFlowchart(nodes, edges, groups);
    }
  }

  private static generateFlowchart(nodes: ArchitectureNode[], edges: ArchitectureEdge[], groups: ArchitectureGroup[]): string {
    const lines: string[] = ['flowchart TD'];

    // Add subgraphs / groups if available
    if (groups && groups.length > 0) {
      groups.forEach((g) => {
        lines.push(`    subgraph ${g.id}["${g.label}"]`);
        g.nodeIds.forEach((nid) => {
          const node = nodes.find((n) => n.id === nid);
          if (node) {
            lines.push(`        ${node.id}["${node.label}${node.technology ? ` (${node.technology})` : ''}"]`);
          }
        });
        lines.push('    end');
      });
    }

    // Add remaining standalone nodes
    const groupedNodeIds = new Set(groups.flatMap((g) => g.nodeIds));
    nodes.forEach((n) => {
      if (!groupedNodeIds.has(n.id)) {
        lines.push(`    ${n.id}["${n.label}${n.technology ? ` (${n.technology})` : ''}"]`);
      }
    });

    // Add Connections
    edges.forEach((e) => {
      const arrow = e.direction === 'two_way' ? '<-->' : '-->';
      const label = e.label ? `|"${e.label}"|` : '';
      lines.push(`    ${e.source} ${arrow}${label} ${e.target}`);
    });

    return lines.join('\n');
  }

  private static generateSequenceDiagram(nodes: ArchitectureNode[], edges: ArchitectureEdge[]): string {
    const lines: string[] = ['sequenceDiagram'];

    nodes.forEach((n) => {
      lines.push(`    participant ${n.id} as ${n.label}`);
    });

    edges.forEach((e) => {
      const arrow = e.direction === 'two_way' ? '<<->>' : '->>';
      const label = e.label || 'Executes Request';
      lines.push(`    ${e.source}${arrow}${e.target}: ${label}`);
    });

    return lines.join('\n');
  }

  private static generateERDiagram(nodes: ArchitectureNode[], edges: ArchitectureEdge[]): string {
    const lines: string[] = ['erDiagram'];

    nodes.forEach((n) => {
      lines.push(`    ${n.id} {`);
      lines.push(`        string id PK`);
      lines.push(`        string org_id FK`);
      lines.push(`        string name`);
      lines.push('    }');
    });

    edges.forEach((e) => {
      lines.push(`    ${e.source} ||--o{ ${e.target} : "${e.label || 'has'}"`);
    });

    return lines.join('\n');
  }
}
