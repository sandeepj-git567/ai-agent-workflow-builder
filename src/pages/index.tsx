import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { fetchGraphQL } from '@/lib/graphqlClient';
import { Workflow, StepType } from '@/types';
import { 
  Plus, 
  Play, 
  Layers, 
  Clock, 
  CheckCircle2, 
  PauseCircle, 
  XCircle, 
  Radio, 
  Sparkles,
  Zap, 
  Building2, 
  Trash2,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

export default function WorkflowsPage() {
  const router = useRouter();
  const { currentUser, currentOrgId, currentRole, orgUsage, refreshOrgUsage } = useAuth();
  
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  // Load Workflows
  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraphQL({
        query: `
          query GetWorkflows($org_id: uuid!) {
            workflows(where: { org_id: { _eq: $org_id } }, order_by: { created_at: desc }) {
              id
              name
              description
              status
              created_by
              created_at
              steps {
                id
                name
                step_type
                position
              }
              triggers {
                id
                trigger_type
                enabled
              }
              runs {
                id
                status
                started_at
                completed_at
              }
            }
          }
        `,
        variables: { org_id: currentOrgId },
        userId: currentUser.id,
        role: currentRole,
      });

      setWorkflows(data?.workflows || []);
    } catch (err: any) {
      console.error('Error loading workflows:', err);
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [currentOrgId, currentUser.id, currentRole]);

  // Trigger Run (Manual execution)
  const handleRunWorkflow = async (workflowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers are not authorized to trigger workflows');
      return;
    }

    setRunningId(workflowId);
    try {
      const res = await fetchGraphQL({
        query: `
          mutation TriggerRun($workflow_id: uuid!) {
            triggerWorkflowRun(workflow_id: $workflow_id) {
              run_id
              status
              message
            }
          }
        `,
        variables: { workflow_id: workflowId },
        userId: currentUser.id,
        role: currentRole,
      });

      await refreshOrgUsage();
      const runId = res?.triggerWorkflowRun?.run_id;
      if (runId) {
        router.push(`/workflows/${workflowId}?run=${runId}`);
      } else {
        await loadWorkflows();
      }
    } catch (err: any) {
      alert(`Error triggering run: ${err.message}`);
    } finally {
      setRunningId(null);
    }
  };

  // Delete Workflow
  const handleDeleteWorkflow = async (workflowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentRole !== 'owner') {
      alert('Forbidden: Only Owners can delete workflows');
      return;
    }

    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await fetchGraphQL({
        query: `
          mutation DeleteWorkflow($id: uuid!) {
            delete_workflows_by_pk(id: $id) {
              id
            }
          }
        `,
        variables: { id: workflowId },
        userId: currentUser.id,
        role: currentRole,
      });

      await loadWorkflows();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Quick Seed Final Demo Scenario Workflow
  const handleSeedDemoWorkflow = async () => {
    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers cannot create workflows');
      return;
    }

    try {
      const data = await fetchGraphQL({
        query: `
          mutation CreateDemoWorkflow($object: workflows_insert_input!) {
            insert_workflows_one(object: $object) {
              id
              name
            }
          }
        `,
        variables: {
          object: {
            org_id: currentOrgId,
            name: 'Customer Sentiment & Action Pipeline (Final Demo)',
            description: '5-step chained AI pipeline: LLM Analysis -> HTTP Enrich -> Conditional Branch -> Human Approval Gate -> DB Persistence.',
            steps: {
              data: [
                {
                  name: 'Step 1: LLM Sentiment Classifier',
                  step_type: 'llm_call',
                  position: 0,
                  config: {
                    provider: 'groq',
                    model: 'llama-3.1-8b-instant',
                    prompt: 'Please classify the following feedback: "I had a great experience with the customer support team, they resolved my issue immediately!" as positive, negative, or neutral.',
                  },
                },
                {
                  name: 'Step 2: HTTP Customer Enrichment',
                  step_type: 'http_request',
                  position: 1,
                  config: {
                    method: 'GET',
                    url: 'https://httpbin.org/json',
                  },
                },
                {
                  name: 'Step 3: Conditional Branching',
                  step_type: 'conditional_branch',
                  position: 2,
                  config: {
                    operator: 'contains',
                    value: 'positive',
                    true_branch: 'VIP_FAST_TRACK',
                    false_branch: 'SUPPORT_ESCALATION',
                  },
                },
                {
                  name: 'Step 4: Approval Gate',
                  step_type: 'approval_gate',
                  position: 3,
                  config: {
                    message: 'Require Manager Review before updating CRM record with AI classification.',
                  },
                },
                {
                  name: 'Step 5: Database Write & Persistence',
                  step_type: 'db_write',
                  position: 4,
                  config: {
                    key: 'customer_intelligence_record',
                    payload: {
                      status: 'verified_by_approval',
                      branch_route: '{{steps.Step 3: Conditional Branching.output.branchSelected}}',
                      llm_sentiment: '{{steps.Step 1: LLM Sentiment Classifier.output.sentiment}}',
                    },
                  },
                },
              ],
            },
            triggers: {
              data: [
                {
                  trigger_type: 'manual',
                  config: {},
                  enabled: true,
                },
                {
                  trigger_type: 'webhook',
                  config: { path: '/api/webhook' },
                  enabled: true,
                },
              ],
            },
          },
        },
        userId: currentUser.id,
        role: currentRole,
      });

      const newId = data?.insert_workflows_one?.id;
      if (newId) {
        router.push(`/workflows/${newId}`);
      } else {
        await loadWorkflows();
      }
    } catch (err: any) {
      alert(`Error creating demo workflow: ${err.message}`);
    }
  };

  const getStepBadge = (type: StepType) => {
    switch (type) {
      case 'llm_call':
        return <span key={type} className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">LLM Call</span>;
      case 'http_request':
        return <span key={type} className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">HTTP</span>;
      case 'conditional_branch':
        return <span key={type} className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">Branch</span>;
      case 'approval_gate':
        return <span key={type} className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">Approval Gate</span>;
      case 'db_write':
        return <span key={type} className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">DB Write</span>;
      case 'notify':
        return <span key={type} className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">Notify</span>;
      default:
        return null;
    }
  };

  const getRunStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            <Radio className="h-3.5 w-3.5" /> Running
          </span>
        );
      case 'paused':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <PauseCircle className="h-3.5 w-3.5" /> Paused (Approval)
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="h-3.5 w-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-white/10">
            No runs yet
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Top Banner / Org Context */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> {currentUser.orgName}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Role: <strong className="text-white uppercase">{currentRole}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-2">
              AI Agent Workflows
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Build, execute, and monitor resilient multi-step AI agent pipelines with conditional branching, human approval gates, and live real-time execution subscriptions.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {currentRole === 'owner' && (
              <button
                onClick={handleSeedDemoWorkflow}
                className="px-4 py-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-200 border border-white/10 hover:border-brand-500/40 text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
              >
                <Sparkles className="h-4 w-4 text-brand-400" />
                <span>+ Final Demo Scenario</span>
              </button>
            )}

            {currentRole !== 'viewer' ? (
              <Link
                href="/workflows/new"
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-brand-500/20 hover:scale-[1.02]"
              >
                <Plus className="h-4 w-4" />
                <span>Create Workflow</span>
              </Link>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-surface-200 border border-amber-500/20 text-amber-300/80 text-xs flex items-center gap-1.5 font-medium">
                <ShieldAlert className="h-4 w-4" />
                <span>Viewer mode (Read-only)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-brand-400" />
            <span>Configured Workflows</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {workflows.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-48 rounded-xl bg-surface-200/50 border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-surface-100 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <Zap className="h-6 w-6 text-brand-400" />
            </div>
            <h3 className="text-base font-semibold text-white">No workflows in this organization yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Get started by creating a new AI workflow or clicking the Final Demo Scenario button above to instant-load the test suite.
            </p>
            {currentRole === 'owner' && (
              <button
                onClick={handleSeedDemoWorkflow}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all inline-flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>Create Final Demo Workflow</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {workflows.map((wf) => {
              const lastRun = wf.runs?.[0];
              const steps = wf.steps || [];
              const triggers = wf.triggers || [];

              return (
                <div
                  key={wf.id}
                  onClick={() => router.push(`/workflows/${wf.id}`)}
                  className="glass-card rounded-2xl p-6 cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors">
                          {wf.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {wf.description || 'No description provided.'}
                        </p>
                      </div>
                      <div>
                        {getRunStatusBadge(lastRun?.status)}
                      </div>
                    </div>

                    {/* Step Type Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {steps.map((s) => getStepBadge(s.step_type))}
                      {steps.length === 0 && (
                        <span className="text-xs text-slate-500 italic">No steps configured</span>
                      )}
                    </div>
                  </div>

                  {/* Footer Meta & Actions */}
                  <div className="pt-5 mt-5 border-t border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        {lastRun?.started_at ? new Date(lastRun.started_at).toLocaleTimeString() : 'Never run'}
                      </span>
                      <span>•</span>
                      <span>{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentRole === 'owner' && (
                        <button
                          onClick={(e) => handleDeleteWorkflow(wf.id, e)}
                          title="Delete Workflow"
                          className="p-2 rounded-lg bg-surface-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {currentRole !== 'viewer' && (
                        <button
                          onClick={(e) => handleRunWorkflow(wf.id, e)}
                          disabled={runningId === wf.id}
                          className="px-3 py-1.5 rounded-lg bg-brand-600/90 hover:bg-brand-500 text-white font-medium flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{runningId === wf.id ? 'Starting...' : 'Run'}</span>
                        </button>
                      )}

                      <span className="p-2 text-slate-400 group-hover:text-slate-200 transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
