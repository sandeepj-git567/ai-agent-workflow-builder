import { describe, it, expect } from 'vitest';
import { PlanGenerator } from '@/lib/planning/planGenerator';
import { ArchitectureGenerator } from '@/lib/architecture/architectureGenerator';
import { MermaidGenerator } from '@/lib/architecture/mermaidGenerator';
import { PlanToWorkflowConverter } from '@/lib/planning/planToWorkflow';

describe('Plan & Architecture Generator Suite', () => {
  const orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ownerId = 'a1111111-1111-1111-1111-111111111111';

  it('generates structured ProjectPlan with phases and tasks', async () => {
    const plan = await PlanGenerator.generatePlan({
      orgId,
      title: 'Build E-Commerce Platform',
      prompt: 'Need user auth, inventory, and payment integration',
    });

    expect(plan.title).toBe('Build E-Commerce Platform');
    expect(plan.phases.length).toBeGreaterThanOrEqual(1);
    expect(plan.phases[0].tasks.length).toBeGreaterThanOrEqual(1);
    expect(plan.technologies.length).toBeGreaterThanOrEqual(1);
  });

  it('renders valid Mermaid.js flowchart markup', () => {
    const nodes = [
      { id: 'client', label: 'Web UI', category: 'frontend' as const },
      { id: 'db', label: 'PostgreSQL', category: 'database' as const },
    ];
    const edges = [
      { source: 'client', target: 'db', label: 'SQL Query' },
    ];

    const mermaid = MermaidGenerator.generateMermaid('flowchart', nodes, edges);
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('client["Web UI"]');
    expect(mermaid).toContain('client -->|"SQL Query"| db');
  });

  it('generates complete ArchitectureDiagram object', async () => {
    const diagram = await ArchitectureGenerator.generateArchitecture({
      orgId,
      title: 'Microservices System Architecture',
      diagramType: 'system_architecture',
    });

    expect(diagram.title).toBe('Microservices System Architecture');
    expect(diagram.nodes.length).toBeGreaterThanOrEqual(3);
    expect(diagram.mermaidCode).toContain('flowchart TD');
    expect(diagram.securityBoundaries.length).toBeGreaterThanOrEqual(1);
  });

  it('converts ProjectPlan into executable Workflow definition', async () => {
    const plan = await PlanGenerator.generatePlan({
      orgId,
      title: 'Automated Deployment Pipeline Plan',
    });

    const workflow = PlanToWorkflowConverter.convertPlanToWorkflow(plan, ownerId);
    expect(workflow.name).toContain('Automated Deployment Pipeline Plan');
    expect(workflow.steps!.length).toBeGreaterThanOrEqual(2);
    expect(workflow.steps![workflow.steps!.length - 1].step_type).toBe('final_response');
  });
});
