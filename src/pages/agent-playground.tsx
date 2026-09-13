import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Bot, 
  Play, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Terminal, 
  FileText, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  ArrowRight 
} from 'lucide-react';
import { AgentRun } from '@/types';

export default function AgentPlaygroundPage() {
  const { currentUser, currentOrgId, currentRole } = useAuth();
  
  const [requestText, setRequestText] = useState('What is the Acme customer support SLA policy for VIP tickets?');
  const [running, setRunning] = useState(false);
  const [agentRun, setAgentRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAgent = async (promptToRun?: string) => {
    const prompt = promptToRun || requestText;
    if (!prompt || prompt.trim() === '') return;

    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers are not authorized to run AI agents');
      return;
    }

    setRunning(true);
    setError(null);
    setAgentRun(null);

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
        body: JSON.stringify({
          org_id: currentOrgId,
          user_request: prompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error executing agent run');
      }

      setAgentRun(data.agent_run);
    } catch (err: any) {
      setError(err.message || 'Failed to run AI Agent');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" /> Autonomous AI Agent Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-2">
              AI Agent Playground
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Execute multi-step autonomous AI agent runs featuring <strong>Intent Classification</strong>, <strong>Dynamic Task Planning</strong>, <strong>RAG Context Retrieval</strong>, and <strong>Safe Tool Execution Loops</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Scenario Prompts */}
      <div className="space-y-3">
        <span className="text-xs font-mono font-semibold uppercase text-slate-400">Quick Test Scenarios:</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => {
              const p = 'What is the Acme customer support SLA policy for VIP tickets?';
              setRequestText(p);
              handleRunAgent(p);
            }}
            className="p-3.5 rounded-xl bg-surface-200 hover:bg-surface-100 border border-white/10 text-left transition-all space-y-1 group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-brand-300">
              <span>Scenario 1: RAG Knowledge QA</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">
              Retrieves SLA guidelines from org documents & generates grounded response with citations.
            </p>
          </button>

          <button
            onClick={() => {
              const p = 'Fetch external customer API payload and analyze data structure.';
              setRequestText(p);
              handleRunAgent(p);
            }}
            className="p-3.5 rounded-xl bg-surface-200 hover:bg-surface-100 border border-white/10 text-left transition-all space-y-1 group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
              <span>Scenario 2: Data Enrichment API</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">
              Executes safe HTTP API tool call with SSRF guards and synthesizes payload insights.
            </p>
          </button>

          <button
            onClick={() => {
              const p = 'Perform a code security audit on this snippet: eval(req.query.cmd);';
              setRequestText(p);
              handleRunAgent(p);
            }}
            className="p-3.5 rounded-xl bg-surface-200 hover:bg-surface-100 border border-white/10 text-left transition-all space-y-1 group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
              <span>Scenario 3: Code Security Audit</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">
              Executes code analysis scanner tool & detects security vulnerabilities.
            </p>
          </button>
        </div>
      </div>

      {/* Interactive Agent Request Box */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <label className="block text-xs font-bold font-mono text-slate-300 uppercase">
          Agent Prompt Request:
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            placeholder="Type goal for AI Agent..."
            className="flex-1 px-4 py-3 rounded-xl bg-surface-100 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500 font-mono"
          />
          <button
            onClick={() => handleRunAgent()}
            disabled={running}
            className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{running ? 'Agent Executing...' : 'Execute Agent Run'}</span>
          </button>
        </div>
      </div>

      {/* Execution Results View */}
      {error && (
        <div className="glass-panel p-5 rounded-2xl border-rose-500/40 bg-rose-950/20 text-rose-300 text-sm">
          <strong>Agent Run Error:</strong> {error}
        </div>
      )}

      {agentRun && (
        <div className="space-y-6">
          
          {/* Status Header */}
          <div className="glass-panel p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-300">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-mono text-slate-400">Agent Run ID: {agentRun.id}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-white uppercase">{agentRun.intent || 'General'}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {agentRun.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Executed at: {new Date(agentRun.created_at).toLocaleTimeString()}
            </div>
          </div>

          {/* Planned Steps & Execution Trail */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
              <Terminal className="h-4 w-4 text-brand-400" />
              <span>Executed Tool Steps ({agentRun.steps?.length || 0})</span>
            </h3>

            <div className="space-y-3">
              {agentRun.steps?.map((step) => (
                <div
                  key={step.id}
                  className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500">#{step.step_number}</span>
                      <span className="font-bold text-white uppercase">{step.action_type}</span>
                      {step.tool_name && (
                        <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                          Tool: {step.tool_name}
                        </span>
                      )}
                    </div>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {step.status}
                    </span>
                  </div>

                  {step.thought && (
                    <p className="text-xs text-slate-300 italic font-mono bg-white/5 p-2.5 rounded-lg border border-white/5">
                      💡 Thought: {step.thought}
                    </p>
                  )}

                  {step.tool_output && (
                    <div className="bg-surface-300 p-3 rounded-xl border border-white/5 text-xs font-mono text-slate-300 overflow-x-auto max-h-40">
                      <pre>{JSON.stringify(step.tool_output, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Final Agent Answer Box */}
          {agentRun.final_output && (
            <div className="glass-panel p-6 rounded-2xl border-emerald-500/30 bg-emerald-950/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                  <span>Final Agent Answer & Response</span>
                </h3>
              </div>

              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap bg-surface-200/60 p-4 rounded-xl border border-white/10 font-sans">
                {agentRun.final_output.summary}
              </div>

              {agentRun.final_output.citations && agentRun.final_output.citations.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Document Citations:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {agentRun.final_output.citations.map((c: any, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {c.document_name} ({Math.round(c.score * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
