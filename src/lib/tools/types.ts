export type ToolRiskLevel = 'low' | 'medium' | 'high';

export interface ToolExecutionContext {
  orgId: string;
  userId?: string;
  workflowRunId?: string;
  agentRunId?: string;
  userRole?: 'owner' | 'editor' | 'viewer';
}

export interface ToolExecutionResult {
  success: boolean;
  output: Record<string, any>;
  error?: string;
  requiresApproval?: boolean;
  approvalMessage?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  inputSchema: Record<string, any>;
  execute(input: Record<string, any>, context: ToolExecutionContext): Promise<ToolExecutionResult>;
}
