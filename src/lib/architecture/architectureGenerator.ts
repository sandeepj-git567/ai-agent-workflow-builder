import { v4 as uuidv4 } from 'uuid';
import { LLMManager } from '../ai/providers';
import { ArchitectureDiagram, ArchitectureEdge, ArchitectureNode, DiagramType, GenerateArchitectureParams } from './architectureTypes';
import { MermaidGenerator } from './mermaidGenerator';

export class ArchitectureGenerator {
  /**
   * Generates a complete architecture diagram specification and Mermaid code.
   */
  static async generateArchitecture(params: GenerateArchitectureParams): Promise<ArchitectureDiagram> {
    const { orgId, title, diagramType = 'system_architecture', planContent, documentDetails, documentId, documentName } = params;

    const systemPrompt = `You are a Principal Enterprise Systems & Software Architect.
Generate a structured Architecture Diagram specification in raw JSON format.
Your output MUST be a valid JSON object matching the requested schema with NO markdown fences.`;

    const userPrompt = `Diagram Title: "${title}"
Diagram Type: "${diagramType}"
Context: ${planContent || documentDetails ? JSON.stringify(planContent || documentDetails).substring(0, 4000) : 'Standard web & AI microservice system.'}

Generate a JSON object:
{
  "title": "${title}",
  "type": "${diagramType}",
  "description": "Technical system architecture for ${title}",
  "nodes": [
    { "id": "client", "label": "Web Client / User Interface", "category": "frontend", "technology": "Next.js 14" },
    { "id": "api_gateway", "label": "API Gateway & Router", "category": "backend", "technology": "Next.js API Routes" },
    { "id": "auth_service", "label": "Server-Side RBAC & Auth", "category": "security", "technology": "Hasura RBAC Matrix" },
    { "id": "workflow_engine", "label": "Workflow Execution Engine", "category": "backend", "technology": "TypeScript Step Runners" },
    { "id": "rag_engine", "label": "RAG Retriever & Vector Store", "category": "llm", "technology": "pgvector + Embedding Manager" },
    { "id": "llm_provider", "label": "Multi-Provider LLM Abstraction", "category": "external_service", "technology": "Groq / OpenAI / Gemini" },
    { "id": "postgres_db", "label": "PostgreSQL Database", "category": "database", "technology": "PostgreSQL 16 + pgvector" }
  ],
  "edges": [
    { "source": "client", "target": "api_gateway", "label": "HTTPS REST / GraphQL", "protocol": "HTTPS" },
    { "source": "api_gateway", "target": "auth_service", "label": "Header Auth Validation", "protocol": "Internal" },
    { "source": "api_gateway", "target": "workflow_engine", "label": "Dispatch Step Execution", "protocol": "Internal" },
    { "source": "workflow_engine", "target": "rag_engine", "label": "Query Vector Context", "protocol": "Internal" },
    { "source": "rag_engine", "target": "postgres_db", "label": "Cosine Similarity Search", "protocol": "SQL" },
    { "source": "workflow_engine", "target": "llm_provider", "label": "Generate Prompt Response", "protocol": "HTTPS API" }
  ],
  "explanation": "This architecture illustrates the flow from Next.js web client through server-side RBAC validation into the workflow engine and pgvector RAG retriever.",
  "securityBoundaries": [
    "Tenant isolation enforced via org_id filter on all database queries",
    "SSRF Guard blocks private IP ranges (10.0.0.0/8, 127.0.0.1, 169.254.169.254)",
    "API Keys processed strictly server-side"
  ],
  "assumptions": ["PostgreSQL 16 with pgvector extension installed"]
}`;

    try {
      const response = await LLMManager.generate({
        systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
      });

      return this.parseAndRepairArchitectureJson(response.text, orgId, title, diagramType, documentId, documentName);
    } catch (err) {
      console.warn('[ArchitectureGenerator] LLM diagram generation failed, producing structured fallback:', err);
      return this.generateFallbackArchitecture(orgId, title, diagramType, documentId, documentName);
    }
  }

  private static parseAndRepairArchitectureJson(rawContent: string, orgId: string, title: string, diagramType: DiagramType, documentId?: string, documentName?: string): ArchitectureDiagram {
    let clean = rawContent.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    try {
      const obj = JSON.parse(clean);
      const nodes: ArchitectureNode[] = Array.isArray(obj.nodes) ? obj.nodes : this.getDefaultNodes();
      const edges: ArchitectureEdge[] = Array.isArray(obj.edges) ? obj.edges : this.getDefaultEdges();
      const mermaidCode = MermaidGenerator.generateMermaid(diagramType, nodes, edges);

      return {
        id: uuidv4(),
        orgId,
        title: obj.title || title,
        type: diagramType,
        description: obj.description || `Architecture specification for ${title}`,
        nodes,
        edges,
        groups: Array.isArray(obj.groups) ? obj.groups : [],
        mermaidCode,
        explanation: obj.explanation || 'Detailed architecture flow diagram.',
        securityBoundaries: Array.isArray(obj.securityBoundaries) ? obj.securityBoundaries : ['Tenant isolation enforced'],
        assumptions: Array.isArray(obj.assumptions) ? obj.assumptions : ['PostgreSQL pgvector active'],
        sourceReferences: [{ documentId: documentId || '', documentName: documentName || title, pageNumber: 1 }],
        createdAt: new Date().toISOString(),
      };
    } catch (e) {
      return this.generateFallbackArchitecture(orgId, title, diagramType, documentId, documentName);
    }
  }

  private static getDefaultNodes(): ArchitectureNode[] {
    return [
      { id: 'client', label: 'Web Client', category: 'frontend', technology: 'Next.js 14' },
      { id: 'api', label: 'API Handler & Auth', category: 'backend', technology: 'TypeScript REST/GraphQL' },
      { id: 'engine', label: 'Workflow Engine', category: 'backend', technology: 'Step Executors' },
      { id: 'vector_db', label: 'Vector DB (pgvector)', category: 'database', technology: 'PostgreSQL 16' },
      { id: 'llm', label: 'LLM Provider', category: 'external_service', technology: 'Groq / OpenAI' },
    ];
  }

  private static getDefaultEdges(): ArchitectureEdge[] {
    return [
      { source: 'client', target: 'api', label: 'HTTP API Calls' },
      { source: 'api', target: 'engine', label: 'Run Workflow' },
      { source: 'engine', target: 'vector_db', label: 'Vector Cosine Search' },
      { source: 'engine', target: 'llm', label: 'Prompt Execution' },
    ];
  }

  private static generateFallbackArchitecture(orgId: string, title: string, diagramType: DiagramType, documentId?: string, documentName?: string): ArchitectureDiagram {
    const nodes = this.getDefaultNodes();
    const edges = this.getDefaultEdges();
    const mermaidCode = MermaidGenerator.generateMermaid(diagramType, nodes, edges);

    return {
      id: uuidv4(),
      orgId,
      title,
      type: diagramType,
      description: `System Architecture Diagram for ${title}`,
      nodes,
      edges,
      groups: [],
      mermaidCode,
      explanation: 'System flow architecture showing Next.js web client, workflow engine, vector store, and LLM abstraction.',
      securityBoundaries: ['Mandatory tenant isolation filtering', 'SSRF Guard active on HTTP requests'],
      assumptions: ['PostgreSQL with pgvector enabled'],
      sourceReferences: [{ documentId: documentId || '', documentName: documentName || title, pageNumber: 1 }],
      createdAt: new Date().toISOString(),
    };
  }
}
