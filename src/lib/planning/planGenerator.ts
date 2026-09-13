import { v4 as uuidv4 } from 'uuid';
import { LLMManager } from '../ai/providers';
import { GeneratePlanParams, ProjectPlan } from './planTypes';

export class PlanGenerator {
  /**
   * Generates a structured ProjectPlan from document details, prompt, or requirements.
   */
  static async generatePlan(params: GeneratePlanParams): Promise<ProjectPlan> {
    const { orgId, title, prompt, documentDetails, documentId, documentName } = params;

    const systemPrompt = `You are a Lead Software Architect and Technical Program Manager.
Generate a comprehensive, structured project plan in raw JSON format.
Your output MUST be a valid JSON object matching the requested schema with NO markdown fences around it.`;

    const userPrompt = `Project Title: "${title}"
Context / Requirements Prompt: "${prompt || 'Generate full implementation project plan.'}"
Document Context: ${documentDetails ? JSON.stringify(documentDetails).substring(0, 4000) : 'None provided'}

Generate a structured JSON object:
{
  "title": "${title}",
  "description": "Comprehensive implementation plan for ${title}",
  "goals": ["Goal 1", "Goal 2"],
  "scope": ["Core feature implementation", "Security hardening"],
  "outOfScope": ["Legacy third-party support"],
  "phases": [
    {
      "id": "phase-1",
      "name": "Foundation & Setup",
      "description": "Initialize database schema, environment config, and auth",
      "order": 1,
      "tasks": [
        {
          "id": "task-101",
          "title": "Configure Database Schema & Migrations",
          "description": "Create PostgreSQL tables and pgvector extension",
          "type": "db_write",
          "priority": "high",
          "dependencies": [],
          "estimatedComplexity": "medium",
          "requiresApproval": true,
          "output": "Database schema active with vector support"
        },
        {
          "id": "task-102",
          "title": "Set Up Authentication & RBAC",
          "description": "Configure multi-tenant headers and authorization matrix",
          "type": "llm_call",
          "priority": "high",
          "dependencies": ["task-101"],
          "estimatedComplexity": "low",
          "requiresApproval": false,
          "output": "Server-side RBAC validation active"
        }
      ]
    },
    {
      "id": "phase-2",
      "name": "Core Service Execution & Integrations",
      "description": "Implement workflow engine, LLM providers, and RAG",
      "order": 2,
      "tasks": [
        {
          "id": "task-201",
          "title": "Fetch External Third-Party APIs",
          "description": "Execute SSRF-guarded HTTP request",
          "type": "http_request",
          "priority": "medium",
          "dependencies": ["task-102"],
          "estimatedComplexity": "medium",
          "requiresApproval": true,
          "output": "API integration payload response"
        },
        {
          "id": "task-202",
          "title": "Human-in-the-Loop Review Gate",
          "description": "Pause execution until authorized user approves",
          "type": "approval_gate",
          "priority": "critical",
          "dependencies": ["task-201"],
          "estimatedComplexity": "low",
          "requiresApproval": true,
          "output": "Manual approval decision recorded"
        }
      ]
    }
  ],
  "technologies": ["Next.js", "TypeScript", "PostgreSQL", "pgvector", "TailwindCSS"],
  "architectureNotes": ["Stateless web server backed by indexed PostgreSQL"],
  "databaseEntities": [
    { "name": "project_plans", "description": "Stores generated plans", "fields": ["id", "org_id", "title", "phases"] }
  ],
  "apiRequirements": [
    { "endpoint": "/api/plans", "method": "POST", "description": "Create plan", "requiresAuth": true }
  ],
  "risks": [
    { "title": "API Rate Limits", "description": "LLM calls may hit rate limits", "severity": "medium" }
  ],
  "assumptions": ["PostgreSQL 16 is available"],
  "testingStrategy": ["Automated Vitest unit and integration tests"],
  "deploymentStrategy": ["Multi-stage Docker containerization"],
  "acceptanceCriteria": ["All tests pass with 0 errors"],
  "sourceReferences": [
    { "documentId": "${documentId || ''}", "documentName": "${documentName || title}", "pageNumber": 1 }
  ]
}`;

    try {
      const response = await LLMManager.generate({
        systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
      });

      const plan = this.parseAndRepairPlanJson(response.text, orgId, title, documentId, documentName);
      return plan;
    } catch (err) {
      console.warn('[PlanGenerator] LLM plan generation failed, producing default fallback plan:', err);
      return this.generateFallbackPlan(orgId, title, documentId, documentName);
    }
  }

  private static parseAndRepairPlanJson(rawContent: string, orgId: string, title: string, documentId?: string, documentName?: string): ProjectPlan {
    let clean = rawContent.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    try {
      const obj = JSON.parse(clean);
      return {
        id,
        orgId,
        title: obj.title || title,
        description: obj.description || `Generated project plan for ${title}`,
        goals: Array.isArray(obj.goals) ? obj.goals : ['Implement technical requirements'],
        scope: Array.isArray(obj.scope) ? obj.scope : ['Core system workflow'],
        outOfScope: Array.isArray(obj.outOfScope) ? obj.outOfScope : [],
        phases: Array.isArray(obj.phases) ? obj.phases : this.getDefaultPhases(),
        technologies: Array.isArray(obj.technologies) ? obj.technologies : ['Next.js', 'TypeScript', 'PostgreSQL'],
        architectureNotes: Array.isArray(obj.architectureNotes) ? obj.architectureNotes : [],
        databaseEntities: Array.isArray(obj.databaseEntities) ? obj.databaseEntities : [],
        apiRequirements: Array.isArray(obj.apiRequirements) ? obj.apiRequirements : [],
        risks: Array.isArray(obj.risks) ? obj.risks : [],
        assumptions: Array.isArray(obj.assumptions) ? obj.assumptions : [],
        testingStrategy: Array.isArray(obj.testingStrategy) ? obj.testingStrategy : ['Vitest Automated Suite'],
        deploymentStrategy: Array.isArray(obj.deploymentStrategy) ? obj.deploymentStrategy : ['Docker Containerization'],
        acceptanceCriteria: Array.isArray(obj.acceptanceCriteria) ? obj.acceptanceCriteria : ['All 36 tests pass'],
        sourceReferences: Array.isArray(obj.sourceReferences)
          ? obj.sourceReferences
          : [{ documentId: documentId || '', documentName: documentName || title, pageNumber: 1 }],
        createdAt: now,
        updatedAt: now,
      };
    } catch (e) {
      return this.generateFallbackPlan(orgId, title, documentId, documentName);
    }
  }

  private static getDefaultPhases() {
    return [
      {
        id: 'phase-1',
        name: 'Architecture & Foundation Setup',
        description: 'Initialize multi-tenant database tables and authentication',
        order: 1,
        tasks: [
          {
            id: 'task-101',
            title: 'Initialize Database Tables & Vectors',
            description: 'Apply SQL migrations for vector storage and workflows',
            type: 'db_write',
            priority: 'high' as const,
            dependencies: [],
            estimatedComplexity: 'medium' as const,
            requiresApproval: true,
            output: 'Database schema active',
          },
        ],
      },
      {
        id: 'phase-2',
        name: 'Workflow Engine & Execution',
        description: 'Execute workflow steps with approval gates and monitoring',
        order: 2,
        tasks: [
          {
            id: 'task-201',
            title: 'Execute RAG Context Retrieval',
            description: 'Perform similarity search across document vectors',
            type: 'rag_search',
            priority: 'high' as const,
            dependencies: ['task-101'],
            estimatedComplexity: 'medium' as const,
            requiresApproval: false,
            output: 'Relevant context retrieved',
          },
          {
            id: 'task-202',
            title: 'Human Approval Gate',
            description: 'Pause execution for owner approval before external operations',
            type: 'approval_gate',
            priority: 'critical' as const,
            dependencies: ['task-201'],
            estimatedComplexity: 'low' as const,
            requiresApproval: true,
            output: 'Approval decision confirmed',
          },
        ],
      },
    ];
  }

  private static generateFallbackPlan(orgId: string, title: string, documentId?: string, documentName?: string): ProjectPlan {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      orgId,
      title,
      description: `Structured implementation plan for ${title}`,
      goals: ['Complete technical requirements', 'Ensure multi-tenant security', 'Deploy containerized platform'],
      scope: ['Backend API', 'Workflow Engine', 'RAG Pipeline', 'Frontend Canvas'],
      outOfScope: ['Third-party legacy system migration'],
      phases: this.getDefaultPhases(),
      technologies: ['Next.js', 'TypeScript', 'PostgreSQL', 'pgvector', 'Groq', 'OpenAI'],
      architectureNotes: ['Stateless modular monolith with PostgreSQL vector storage'],
      databaseEntities: [
        { name: 'project_plans', description: 'Plan records', fields: ['id', 'org_id', 'title', 'phases'] },
      ],
      apiRequirements: [
        { endpoint: '/api/plans', method: 'POST', description: 'Plan management endpoint', requiresAuth: true },
      ],
      risks: [{ title: 'API Throttling', description: 'Manage LLM rate limits', severity: 'medium' }],
      assumptions: ['Database connections are properly pooled'],
      testingStrategy: ['36 Vitest unit and integration tests'],
      deploymentStrategy: ['Multi-stage Dockerfile deployment'],
      acceptanceCriteria: ['0 TypeScript errors, clean production build'],
      sourceReferences: [{ documentId: documentId || '', documentName: documentName || title, pageNumber: 1 }],
      createdAt: now,
      updatedAt: now,
    };
  }
}
