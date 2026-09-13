import { db } from '@/db';
import { AgentRun, AgentStep } from '@/types';
import { ToolRegistry } from '@/lib/tools/registry';
import { ToolExecutionContext } from '@/lib/tools/types';
import { RAGRetriever } from '@/lib/rag/retriever';
import { LLMManager } from '@/lib/ai/providers';
import { PromptTemplateService } from '@/lib/ai/prompts/promptService';

export interface StartAgentRunParams {
  orgId: string;
  userId?: string;
  userRole?: 'owner' | 'editor' | 'viewer';
  userRequest: string;
  workflowRunId?: string;
}

export class AgentOrchestrator {
  /**
   * Orchestrates an autonomous AI Agent run: Intent Classification -> Task Planning -> Context Retrieval -> Tool Execution Loop.
   */
  static async runAgent(params: StartAgentRunParams): Promise<AgentRun> {
    const { orgId, userId, userRole = 'owner', userRequest, workflowRunId } = params;

    // 1. Create Agent Run Record
    const agentRun = await db.createAgentRun({
      org_id: orgId,
      workflow_run_id: workflowRunId,
      user_request: userRequest,
    });

    await db.updateAgentRun(agentRun.id, orgId, { status: 'planning' });

    try {
      // 2. Intent Classification
      const intent = this.classifyIntent(userRequest);
      await db.updateAgentRun(agentRun.id, orgId, { intent });

      // 3. Task Planning
      const plan = this.generateTaskPlan(intent, userRequest);
      await db.updateAgentRun(agentRun.id, orgId, {
        status: 'executing',
        plan,
      });

      // Context state passed across step executions
      const agentContext: Record<string, any> = {
        userRequest,
        intent,
      };

      const toolContext: ToolExecutionContext = {
        orgId,
        userId,
        workflowRunId,
        agentRunId: agentRun.id,
        userRole,
      };

      // 4. If intent requires RAG Knowledge Retrieval, execute RAG search automatically
      if (intent === 'rag_qa' || userRequest.toLowerCase().includes('policy') || userRequest.toLowerCase().includes('doc')) {
        const ragResults = await RAGRetriever.retrieve({
          orgId,
          query: userRequest,
          topK: 3,
        });

        const ragContextText = RAGRetriever.buildContext(ragResults);
        agentContext['rag_context'] = ragContextText;
        agentContext['rag_results'] = ragResults;

        await db.createAgentStep({
          agent_run_id: agentRun.id,
          org_id: orgId,
          step_number: 0,
          action_type: 'rag_retrieval',
          tool_name: 'rag_search',
          tool_input: { query: userRequest },
          thought: 'Retrieving relevant document chunks from organization knowledge base',
        });
      }

      // 5. Tool Execution Loop
      for (let i = 0; i < plan.steps.length; i++) {
        const planStep = plan.steps[i];
        const stepNumber = i + 1;

        const dbStep = await db.createAgentStep({
          agent_run_id: agentRun.id,
          org_id: orgId,
          step_number: stepNumber,
          action_type: planStep.action_type,
          tool_name: planStep.tool_name,
          tool_input: planStep.input,
          thought: planStep.thought,
        });

        // Execute Tool via Tool Registry
        const toolResult = await ToolRegistry.executeTool(
          planStep.tool_name,
          {
            ...planStep.input,
            untrusted_context: agentContext['rag_context'],
            context: agentContext,
          },
          toolContext
        );

        if (toolResult.requiresApproval) {
          await db.updateAgentStep(dbStep.id, orgId, {
            status: 'pending',
            thought: 'Approval required to proceed with step execution',
          });

          await db.updateAgentRun(agentRun.id, orgId, {
            status: 'waiting_for_approval',
            error: toolResult.approvalMessage,
          });

          return (await db.getAgentRun(agentRun.id, orgId))!;
        }

        if (!toolResult.success) {
          await db.updateAgentStep(dbStep.id, orgId, {
            status: 'failed',
            error: toolResult.error,
            completed_at: new Date().toISOString(),
          });

          await db.updateAgentRun(agentRun.id, orgId, {
            status: 'failed',
            error: `Agent step ${stepNumber} (${planStep.tool_name}) failed: ${toolResult.error}`,
          });

          return (await db.getAgentRun(agentRun.id, orgId))!;
        }

        // Store step output in context
        agentContext[planStep.tool_name] = toolResult.output;
        agentContext[`step_${stepNumber}`] = toolResult.output;

        await db.updateAgentStep(dbStep.id, orgId, {
          status: 'completed',
          tool_output: toolResult.output,
          completed_at: new Date().toISOString(),
        });
      }

      // 6. Generate Final Agent Response
      const compiledPrompt = PromptTemplateService.compilePrompt({
        systemPrompt: 'You are an autonomous AI Agent. Summarize execution results into a clear final answer for the user.',
        userTemplate: 'User Goal: {{user_request}}\nExecution Results: {{results}}',
        variables: {
          user_request: userRequest,
          results: JSON.stringify(agentContext),
        },
        untrustedContext: agentContext['rag_context'],
      });

      const finalLlmResult = await LLMManager.generate({
        prompt: compiledPrompt.finalPrompt,
        systemPrompt: compiledPrompt.systemPrompt,
        temperature: 0.2,
      });

      const finalOutput = {
        summary: finalLlmResult.text,
        agent_context: agentContext,
        citations: agentContext['rag_results']?.map((r: any) => ({
          document_name: r.document_name,
          score: r.score,
        })),
      };

      await db.updateAgentRun(agentRun.id, orgId, {
        status: 'completed',
        final_output: finalOutput,
      });

      await db.logAuditEvent({
        org_id: orgId,
        user_id: userId,
        action: 'agent_run_completed',
        resource_type: 'agent_run',
        resource_id: agentRun.id,
        details: { intent, steps_executed: plan.steps.length },
      });

      return (await db.getAgentRun(agentRun.id, orgId))!;
    } catch (err: any) {
      console.error(`[AgentOrchestrator] Error executing agent run ${agentRun.id}:`, err);

      await db.updateAgentRun(agentRun.id, orgId, {
        status: 'failed',
        error: err.message,
      });

      return (await db.getAgentRun(agentRun.id, orgId))!;
    }
  }

  /**
   * Intent Classification Logic
   */
  private static classifyIntent(request: string): string {
    const lower = request.toLowerCase();
    if (lower.includes('policy') || lower.includes('document') || lower.includes('sla') || lower.includes('guideline') || lower.includes('search knowledge')) {
      return 'rag_qa';
    }
    if (lower.includes('http') || lower.includes('api') || lower.includes('fetch') || lower.includes('webhook')) {
      return 'data_enrichment';
    }
    if (lower.includes('code') || lower.includes('eval(') || lower.includes('syntax') || lower.includes('security check')) {
      return 'code_audit';
    }
    if (lower.includes('task') || lower.includes('todo') || lower.includes('assign')) {
      return 'task_management';
    }
    return 'general_reasoning';
  }

  /**
   * Task Planner Logic
   */
  private static generateTaskPlan(intent: string, request: string): { steps: Array<{ action_type: string; tool_name: string; input: Record<string, any>; thought: string }> } {
    switch (intent) {
      case 'rag_qa':
        return {
          steps: [
            {
              action_type: 'reasoning',
              tool_name: 'llm_call',
              input: { prompt: `Analyze user question: "${request}". Synthesize grounded response based on knowledge base context.` },
              thought: 'Synthesizing grounded answer using retrieved document context',
            },
          ],
        };
      case 'data_enrichment':
        return {
          steps: [
            {
              action_type: 'http_fetch',
              tool_name: 'http_request',
              input: { url: 'https://httpbin.org/json', method: 'GET' },
              thought: 'Fetching external enrichment data via safe HTTP client',
            },
            {
              action_type: 'reasoning',
              tool_name: 'llm_call',
              input: { prompt: `Process fetched HTTP API data for request: "${request}"` },
              thought: 'Analyzing fetched external data with LLM reasoning engine',
            },
          ],
        };
      case 'code_audit':
        return {
          steps: [
            {
              action_type: 'code_scan',
              tool_name: 'code_analysis',
              input: { code: request, language: 'typescript' },
              thought: 'Scanning input code for syntax errors and security vulnerabilities',
            },
            {
              action_type: 'reasoning',
              tool_name: 'llm_call',
              input: { prompt: `Summarize code audit findings for: "${request}"` },
              thought: 'Formulating code security review report',
            },
          ],
        };
      default:
        return {
          steps: [
            {
              action_type: 'reasoning',
              tool_name: 'llm_call',
              input: { prompt: `Address user goal: "${request}"` },
              thought: 'Reasoning about user request and generating structured response',
            },
          ],
        };
    }
  }
}
