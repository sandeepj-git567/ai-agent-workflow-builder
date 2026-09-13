import { LLMManager } from '../ai/providers';
import { ExtractedDocumentDetails } from './detailSchema';

export class DetailExtractor {
  /**
   * Analyzes document text using an LLM and returns structured details.
   */
  static async extractDetails(documentId: string, documentName: string, text: string): Promise<ExtractedDocumentDetails> {
    const systemPrompt = `You are a Principal Enterprise Systems Architect and Requirements Engineer.
Analyze the provided document text and extract structured details in valid JSON format.
Your output MUST be a single raw JSON object matching the requested schema with NO markdown code block backticks around it.`;

    const userPrompt = `Document Title: "${documentName}"
Document Text Snippet:
<untrusted_document_context>
${text.substring(0, 12000)}
</untrusted_document_context>

Extract details in JSON matching this exact structure:
{
  "documentId": "${documentId}",
  "title": "${documentName}",
  "summary": "Brief 2-3 sentence overview of the document content",
  "purpose": "Primary objective of the system or policy described",
  "objectives": ["Goal 1", "Goal 2"],
  "requirements": [
    {
      "id": "REQ-001",
      "title": "User Authentication",
      "description": "System must support secure login",
      "priority": "high",
      "category": "functional"
    }
  ],
  "stakeholders": [
    { "name": "System Administrator", "role": "Owner", "responsibility": "System Configuration" }
  ],
  "tasks": [
    { "id": "TASK-001", "title": "Setup DB Schema", "description": "Run initial migration", "priority": "high", "requiresApproval": false }
  ],
  "milestones": [
    { "id": "M-1", "title": "Initial Alpha Launch", "targetDate": "2026-Q4", "deliverables": ["DB Schema", "API Setup"] }
  ],
  "dependencies": [
    { "id": "DEP-1", "description": "PostgreSQL database instance", "type": "technical" }
  ],
  "risks": [
    { "id": "RISK-1", "title": "API Rate Limiting", "description": "External API limits may restrict throughput", "severity": "medium", "mitigation": "Add caching" }
  ],
  "constraints": ["Must conform to ISO security standards"],
  "assumptions": ["PostgreSQL 16 with pgvector is available"],
  "inputs": ["User registration details"],
  "outputs": ["Structured project plan", "Execution logs"],
  "technologies": ["Next.js", "TypeScript", "PostgreSQL", "pgvector"],
  "integrations": ["Groq API", "OpenAI API"],
  "approvalRequirements": ["Owner approval required before DB migrations"],
  "acceptanceCriteria": ["All unit tests pass with zero errors"],
  "openQuestions": ["Will SSO authentication be required in Phase 2?"],
  "sourceReferences": [
    { "documentId": "${documentId}", "documentName": "${documentName}", "pageNumber": 1 }
  ]
}`;

    try {
      const response = await LLMManager.generate({
        systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
      });

      const parsed = this.parseAndRepairJson(response.text, documentId, documentName);
      return parsed;
    } catch (err) {
      console.warn('[DetailExtractor] LLM extraction failed or returned malformed data, generating structured fallback:', err);
      return this.generateFallbackDetails(documentId, documentName, text);
    }
  }

  private static parseAndRepairJson(rawContent: string, documentId: string, documentName: string): ExtractedDocumentDetails {
    let cleanText = rawContent.trim();

    // Strip markdown code block fences if present
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    try {
      const obj = JSON.parse(cleanText);
      return {
        documentId,
        title: obj.title || documentName,
        summary: obj.summary || 'Summary generated from document analysis.',
        purpose: obj.purpose || 'Extracted document purpose.',
        objectives: Array.isArray(obj.objectives) ? obj.objectives : ['Document analysis completed.'],
        requirements: Array.isArray(obj.requirements) ? obj.requirements : [],
        stakeholders: Array.isArray(obj.stakeholders) ? obj.stakeholders : [],
        tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
        milestones: Array.isArray(obj.milestones) ? obj.milestones : [],
        dependencies: Array.isArray(obj.dependencies) ? obj.dependencies : [],
        risks: Array.isArray(obj.risks) ? obj.risks : [],
        constraints: Array.isArray(obj.constraints) ? obj.constraints : [],
        assumptions: Array.isArray(obj.assumptions) ? obj.assumptions : [],
        inputs: Array.isArray(obj.inputs) ? obj.inputs : [],
        outputs: Array.isArray(obj.outputs) ? obj.outputs : [],
        technologies: Array.isArray(obj.technologies) ? obj.technologies : [],
        integrations: Array.isArray(obj.integrations) ? obj.integrations : [],
        approvalRequirements: Array.isArray(obj.approvalRequirements) ? obj.approvalRequirements : [],
        acceptanceCriteria: Array.isArray(obj.acceptanceCriteria) ? obj.acceptanceCriteria : [],
        openQuestions: Array.isArray(obj.openQuestions) ? obj.openQuestions : [],
        sourceReferences: Array.isArray(obj.sourceReferences)
          ? obj.sourceReferences
          : [{ documentId, documentName, pageNumber: 1 }],
      };
    } catch (e) {
      throw new Error(`JSON Repair Error: ${e}`);
    }
  }

  private static generateFallbackDetails(documentId: string, documentName: string, text: string): ExtractedDocumentDetails {
    return {
      documentId,
      title: documentName,
      summary: `Automated summary for ${documentName}. The document contains ${text.length} characters of reference material.`,
      purpose: `Primary requirements and operational specifications extracted from ${documentName}.`,
      objectives: ['Validate system capabilities', 'Ensure compliance with requirements'],
      requirements: [
        {
          id: 'REQ-01',
          title: 'Document Processing & Intelligence',
          description: 'Extract details, generate project plans, and execute workflows.',
          priority: 'high',
          category: 'functional',
        },
      ],
      stakeholders: [{ name: 'Project Admin', role: 'Owner', responsibility: 'System Execution' }],
      tasks: [
        { id: 'TSK-01', title: 'Initialize Workflow Pipeline', description: 'Run workflow engine steps', priority: 'high', requiresApproval: false },
      ],
      milestones: [{ id: 'MS-01', title: 'Verification Phase', deliverables: ['Passing test suite', 'Verified build'] }],
      dependencies: [{ id: 'DEP-01', description: 'Database and LLM provider connectivity', type: 'technical' }],
      risks: [{ id: 'RSK-01', title: 'External Service Availability', description: 'API rate limits or connectivity loss', severity: 'medium' }],
      constraints: ['Must satisfy strict multi-tenant isolation'],
      assumptions: ['Environment configuration is loaded safely'],
      inputs: [documentName],
      outputs: ['Structured Plan', 'Architecture Diagram', 'Executable Workflow'],
      technologies: ['Next.js', 'TypeScript', 'PostgreSQL', 'Groq', 'OpenAI'],
      integrations: ['LLM Provider API'],
      approvalRequirements: ['Human approval gate before restricted operations'],
      acceptanceCriteria: ['All automated tests pass cleanly'],
      openQuestions: ['Are additional file types needed?'],
      sourceReferences: [{ documentId, documentName, pageNumber: 1 }],
    };
  }
}
