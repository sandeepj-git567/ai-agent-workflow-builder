import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { fetchGraphQL } from '@/lib/graphqlClient';
import { 
  Workflow, 
  WorkflowStep, 
  WorkflowRun, 
  StepRun, 
  StepType, 
  TriggerType 
} from '@/types';
import { 
  ArrowLeft, 
  Play, 
  Save, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  Clock, 
  PauseCircle, 
  Radio, 
  XCircle, 
  Bot, 
  Globe, 
  GitBranch, 
  ShieldCheck, 
  Database, 
  Bell, 
  Lock, 
  Copy, 
  Check, 
  Terminal, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';

export default function WorkflowDetailPage() {
  const router = useRouter();
  const { id: rawId, run: queryRunId } = router.query;
  const workflowId = Array.isArray(rawId) ? rawId[0] : rawId;

  const { currentUser, currentOrgId, currentRole, refreshOrgUsage } = useAuth();

  const isNew = workflowId === 'new';

  const [activeTab, setActiveTab] = useState<'monitor' | 'builder'>('monitor');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Builder Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<Array<Omit<WorkflowStep, 'id' | 'created_at' | 'updated_at'>>>([
    {
      workflow_id: '',
      name: 'Step 1: LLM Sentiment Analysis',
      step_type: 'llm_call',
      position: 0,
      config: {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        prompt: 'Analyze feedback: "The application is exceptionally fast and secure." Classify as positive, negative, or neutral.',
      },
    },
    {
      workflow_id: '',
      name: 'Step 2: External HTTP API Call',
      step_type: 'http_request',
      position: 1,
      config: {
        method: 'GET',
        url: 'https://httpbin.org/json',
      },
    },
    {
      workflow_id: '',
      name: 'Step 3: Evaluate Sentiment Branch',
      step_type: 'conditional_branch',
      position: 2,
      config: {
        operator: 'contains',
        value: 'positive',
        true_branch: 'VIP_CUSTOMER_FLOW',
        false_branch: 'SUPPORT_TICKET_FLOW',
      },
    },
    {
      workflow_id: '',
      name: 'Step 4: Approval Gate',
      step_type: 'approval_gate',
      position: 3,
      config: {
        message: 'Review classification before updating CRM record.',
      },
    },
    {
      workflow_id: '',
      name: 'Step 5: Write to Database',
      step_type: 'db_write',
      position: 4,
      config: {
        key: 'customer_intelligence_record',
        payload: {
          sentiment: '{{steps.Step 1: LLM Sentiment Analysis.output.sentiment}}',
          branch: '{{steps.Step 3: Evaluate Sentiment Branch.output.branchSelected}}',
        },
      },
    },
  ]);

  const [webhookEnabled, setWebhookEnabled] = useState(true);

  // Monitor State (Live Run)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null);
  const [stepRuns, setStepRuns] = useState<StepRun[]>([]);
  const [approving, setApproving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Load Workflow Data
  const loadWorkflow = async () => {
    if (isNew) {
      setLoading(false);
      setActiveTab('builder');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraphQL({
        query: `
          query GetWorkflowDetail($id: uuid!) {
            workflows_by_pk(id: $id) {
              id
              org_id
              name
              description
              status
              created_by
              created_at
              steps(order_by: { position: asc }) {
                id
                name
                step_type
                position
                config
              }
              triggers {
                id
                trigger_type
                config
                enabled
              }
              runs(order_by: { created_at: desc }, limit: 10) {
                id
                status
                trigger_type
                started_at
                completed_at
                error
                step_runs {
                  id
                  workflow_step_id
                  status
                  input
                  output
                  error
                  attempt_count
                  approved_by
                  approved_at
                  started_at
                  completed_at
                }
              }
            }
          }
        `,
        variables: { id: workflowId },
        userId: currentUser.id,
        role: currentRole,
      });

      const wf = data?.workflows_by_pk;
      if (!wf) {
        setError('403: Forbidden - Access Denied or Workflow Not Found in this Organization');
        setWorkflow(null);
        setLoading(false);
        return;
      }

      setWorkflow(wf);
      setName(wf.name);
      setDescription(wf.description || '');
      if (wf.steps && wf.steps.length > 0) {
        setSteps(wf.steps);
      }
      const hasWebhook = wf.triggers?.some((t: any) => t.trigger_type === 'webhook' && t.enabled);
      setWebhookEnabled(hasWebhook !== undefined ? hasWebhook : true);

      // Select initial run to monitor
      const runToSelect = queryRunId ? String(queryRunId) : wf.runs?.[0]?.id;
      if (runToSelect) {
        setSelectedRunId(runToSelect);
        const r = wf.runs?.find((run: any) => run.id === runToSelect);
        if (r) {
          setCurrentRun(r);
          setStepRuns(r.step_runs || []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workflowId) {
      loadWorkflow();
    }
  }, [workflowId, currentOrgId, currentUser.id, currentRole]);

  // Real-Time GraphQL Subscription (via Server-Sent Events)
  useEffect(() => {
    if (!selectedRunId) return;

    const eventSource = new EventSource(`/api/graphql/stream?workflow_run_id=${selectedRunId}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'workflow_run') {
          setCurrentRun(payload.data);
        } else if (payload.type === 'step_runs') {
          setStepRuns(payload.data);
        }
      } catch (err) {
        console.error('[SSE Error]:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [selectedRunId]);

  // Save / Update Workflow
  const handleSaveWorkflow = async () => {
    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers cannot save workflows');
      return;
    }

    setSaving(true);
    try {
      const triggersData = [
        { trigger_type: 'manual', config: {}, enabled: true },
      ];
      if (webhookEnabled) {
        triggersData.push({ trigger_type: 'webhook', config: {}, enabled: true });
      }

      const formattedSteps = steps.map((s, idx) => ({
        name: s.name,
        step_type: s.step_type,
        position: idx,
        config: s.config,
      }));

      if (isNew) {
        const res = await fetchGraphQL({
          query: `
            mutation InsertWorkflow($object: workflows_insert_input!) {
              insert_workflows_one(object: $object) {
                id
                name
              }
            }
          `,
          variables: {
            object: {
              org_id: currentOrgId,
              name,
              description,
              steps: { data: formattedSteps },
              triggers: { data: triggersData },
            },
          },
          userId: currentUser.id,
          role: currentRole,
        });

        const newId = res?.insert_workflows_one?.id;
        if (newId) {
          router.push(`/workflows/${newId}`);
        }
      } else {
        await fetchGraphQL({
          query: `
            mutation UpdateWorkflow($id: uuid!, $updates: workflows_set_input!) {
              update_workflows_by_pk(id: $id, updates: $updates) {
                id
                name
              }
            }
          `,
          variables: {
            id: workflowId,
            updates: {
              name,
              description,
              steps: { data: formattedSteps },
              triggers: { data: triggersData },
            },
          },
          userId: currentUser.id,
          role: currentRole,
        });

        alert('Workflow saved successfully!');
        await loadWorkflow();
      }
    } catch (err: any) {
      alert(`Error saving workflow: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Run Workflow Manually
  const handleTriggerRun = async () => {
    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers are not authorized to trigger workflows');
      return;
    }

    setRunning(true);
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
      const newRunId = res?.triggerWorkflowRun?.run_id;
      if (newRunId) {
        setSelectedRunId(newRunId);
        setActiveTab('monitor');
      }
    } catch (err: any) {
      alert(`Execution Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  // Approve Approval Gate Step
  const handleApproveStep = async (stepRunId: string) => {
    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers cannot approve approval gates');
      return;
    }

    setApproving(true);
    try {
      await fetchGraphQL({
        query: `
          mutation Approve($step_run_id: uuid!) {
            approveStep(step_run_id: $step_run_id) {
              step_run_id
              status
              message
            }
          }
        `,
        variables: { step_run_id: stepRunId },
        userId: currentUser.id,
        role: currentRole,
      });

      await refreshOrgUsage();
    } catch (err: any) {
      alert(`Approval Error: ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  // Step Management in Builder
  const addStep = (stepType: StepType) => {
    if (currentRole === 'editor' && (stepType === 'db_write' || stepType === 'notify')) {
      alert(`Forbidden: Only Owners can add '${stepType}' steps.`);
      return;
    }

    let defaultConfig: Record<string, any> = {};
    if (stepType === 'llm_call') {
      defaultConfig = { provider: 'groq', model: 'llama-3.1-8b-instant', prompt: 'Analyze input text...' };
    } else if (stepType === 'http_request') {
      defaultConfig = { method: 'GET', url: 'https://httpbin.org/json' };
    } else if (stepType === 'conditional_branch') {
      defaultConfig = { operator: 'contains', value: 'positive', true_branch: 'SUCCESS_ROUTE', false_branch: 'FALLBACK_ROUTE' };
    } else if (stepType === 'approval_gate') {
      defaultConfig = { message: 'Require team lead approval before proceeding.' };
    } else if (stepType === 'db_write') {
      defaultConfig = { key: 'workflow_output', payload: { status: 'completed' } };
    } else if (stepType === 'notify') {
      defaultConfig = { channel: 'in_app', message: 'Workflow step completed.' };
    }

    setSteps([
      ...steps,
      {
        workflow_id: workflowId || '',
        name: `Step ${steps.length + 1}: ${stepType.replace('_', ' ').toUpperCase()}`,
        step_type: stepType,
        position: steps.length,
        config: defaultConfig,
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    setSteps(newSteps);
  };

  const updateStepConfig = (index: number, key: string, val: any) => {
    const newSteps = [...steps];
    newSteps[index] = {
      ...newSteps[index],
      config: {
        ...newSteps[index].config,
        [key]: val,
      },
    };
    setSteps(newSteps);
  };

  const updateStepName = (index: number, val: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], name: val };
    setSteps(newSteps);
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/${workflowId}` : `/api/webhook/${workflowId}`;

  const copyWebhookCommand = () => {
    const curl = `curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d '{"customer":"Enterprise User", "sentiment":"positive"}'`;
    navigator.clipboard.writeText(curl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  // Helper status renderers
  const getStepIcon = (type: StepType) => {
    switch (type) {
      case 'llm_call': return <Bot className="h-4 w-4 text-indigo-400" />;
      case 'http_request': return <Globe className="h-4 w-4 text-cyan-400" />;
      case 'conditional_branch': return <GitBranch className="h-4 w-4 text-amber-400" />;
      case 'approval_gate': return <ShieldCheck className="h-4 w-4 text-purple-400" />;
      case 'db_write': return <Database className="h-4 w-4 text-emerald-400" />;
      case 'notify': return <Bell className="h-4 w-4 text-rose-400" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-surface-100 rounded-lg animate-pulse" />
        <div className="h-96 bg-surface-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-12 rounded-2xl text-center space-y-4 max-w-xl mx-auto mt-12 border-rose-500/30">
        <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied / Org Isolation</h2>
        <p className="text-sm text-slate-300">{error}</p>
        <p className="text-xs text-slate-400">
          This proves that <strong>Layer 1 Organization Isolation</strong> is strictly enforced in Hasura & Backend. Users from other organizations cannot access this workflow.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-100 hover:bg-surface-50 text-white text-sm font-medium border border-white/10"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  // Find if currently paused at an approval gate
  const pausedStepRun = stepRuns.find((sr) => sr.status === 'paused');

  return (
    <div className="space-y-6 pb-16">
      
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-surface-200 hover:bg-surface-100 text-slate-400 hover:text-white border border-white/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              {isNew ? 'Create New AI Workflow' : name || 'Workflow Details'}
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Workflow ID: {workflowId}
            </p>
          </div>
        </div>

        {/* Tab Toggle & Actions */}
        <div className="flex items-center gap-3">
          {!isNew && (
            <div className="flex rounded-xl bg-surface-200 p-1 border border-white/10">
              <button
                onClick={() => setActiveTab('monitor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'monitor'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Execution Monitor
              </button>
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'builder'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Workflow Builder
              </button>
            </div>
          )}

          {!isNew && currentRole !== 'viewer' && (
            <button
              onClick={handleTriggerRun}
              disabled={running}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{running ? 'Executing...' : 'Run Workflow'}</span>
            </button>
          )}

          {activeTab === 'builder' && currentRole !== 'viewer' && (
            <button
              onClick={handleSaveWorkflow}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-brand-500/20"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE EXECUTION MONITOR & REAL-TIME SUBSCRIPTION                    */}
      {/* ========================================================================= */}
      {activeTab === 'monitor' && !isNew && (
        <div className="space-y-6">
          
          {/* Pause / Approval Banner (Live Attention Gate) */}
          {currentRun?.status === 'paused' && pausedStepRun && (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-500/50 shadow-xl glow-indigo space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                    <PauseCircle className="h-6 w-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-purple-500/30 text-purple-200 border border-purple-400/40 font-bold">
                      Paused — Awaiting Approval Gate
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">
                      Execution halted at {pausedStepRun.step?.name || 'Approval Gate'}
                    </h3>
                    <p className="text-xs text-purple-200/80 mt-0.5">
                      {pausedStepRun.input?.message || 'Human verification required before proceeding with subsequent steps.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {currentRole !== 'viewer' ? (
                    <button
                      onClick={() => handleApproveStep(pausedStepRun.id)}
                      disabled={approving}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/30 hover:scale-105 flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{approving ? 'Approving...' : 'Approve & Resume Execution'}</span>
                    </button>
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-purple-900/50 border border-purple-400/30 text-purple-300 text-xs font-mono">
                      Viewers cannot approve
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Run Summary Bar */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Run Status</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {currentRun?.status === 'completed' && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                    </span>
                  )}
                  {currentRun?.status === 'running' && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                      <Radio className="h-3.5 w-3.5" /> Executing
                    </span>
                  )}
                  {currentRun?.status === 'paused' && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      <PauseCircle className="h-3.5 w-3.5" /> Paused (Approval)
                    </span>
                  )}
                  {currentRun?.status === 'failed' && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      <XCircle className="h-3.5 w-3.5" /> Failed
                    </span>
                  )}
                  {!currentRun && (
                    <span className="text-xs text-slate-500">No active run selected</span>
                  )}
                </div>
              </div>

              {currentRun && (
                <div className="border-l border-white/10 pl-4 space-y-0.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Trigger</span>
                  <div className="text-xs font-mono font-medium text-slate-200 uppercase">
                    {currentRun.trigger_type}
                  </div>
                </div>
              )}

              {currentRun?.started_at && (
                <div className="border-l border-white/10 pl-4 space-y-0.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Started</span>
                  <div className="text-xs font-mono text-slate-200">
                    {new Date(currentRun.started_at).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>

            {/* Run Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Run History:</span>
              <select
                value={selectedRunId || ''}
                onChange={(e) => {
                  setSelectedRunId(e.target.value);
                  const r = workflow?.runs?.find((run: any) => run.id === e.target.value);
                  if (r) {
                    setCurrentRun(r);
                    setStepRuns(r.step_runs || []);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-xs text-slate-200 font-mono"
              >
                {workflow?.runs?.map((r: any, idx: number) => (
                  <option key={r.id} value={r.id}>
                    #{workflow.runs!.length - idx} — {r.status.toUpperCase()} ({new Date(r.started_at || r.created_at).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sequential Step Execution Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider font-mono">
              Live Step Execution Pipeline
            </h3>

            {steps.map((step, idx) => {
              const stepRun = stepRuns.find((sr) => sr.workflow_step_id === (step as any).id) || stepRuns[idx];
              const status = stepRun?.status || 'pending';

              return (
                <div
                  key={idx}
                  className={`glass-panel p-5 rounded-2xl border transition-all ${
                    status === 'running'
                      ? 'border-amber-500/50 glow-amber bg-amber-950/20'
                      : status === 'paused'
                      ? 'border-purple-500/50 glow-indigo bg-purple-950/20'
                      : status === 'completed'
                      ? 'border-emerald-500/30 bg-surface-200/50'
                      : status === 'failed'
                      ? 'border-rose-500/40 bg-rose-950/20'
                      : 'border-white/5 bg-surface-200/20 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    
                    {/* Left: Step Info */}
                    <div className="flex items-start space-x-3">
                      <div className="h-8 w-8 rounded-xl bg-surface-100 border border-white/10 flex items-center justify-center shrink-0">
                        {getStepIcon(step.step_type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400">
                            #{idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-white">
                            {step.name}
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 uppercase">
                            {step.step_type}
                          </span>
                        </div>

                        {/* Status Label */}
                        <div className="flex items-center gap-2 mt-2">
                          {status === 'completed' && (
                            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                            </span>
                          )}
                          {status === 'running' && (
                            <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold animate-pulse">
                              <Radio className="h-3.5 w-3.5" /> Running...
                            </span>
                          )}
                          {status === 'paused' && (
                            <span className="flex items-center gap-1 text-xs text-purple-400 font-semibold">
                              <PauseCircle className="h-3.5 w-3.5" /> Paused (Awaiting Approval)
                            </span>
                          )}
                          {status === 'failed' && (
                            <span className="flex items-center gap-1 text-xs text-rose-400 font-semibold">
                              <XCircle className="h-3.5 w-3.5" /> Failed
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="text-xs text-slate-500 font-mono">
                              ⚪ Pending
                            </span>
                          )}

                          {stepRun?.attempt_count && stepRun.attempt_count > 1 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                              Retry #{stepRun.attempt_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Step Action if Paused */}
                    {status === 'paused' && currentRole !== 'viewer' && (
                      <button
                        onClick={() => handleApproveStep(stepRun.id)}
                        disabled={approving}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve Step</span>
                      </button>
                    )}
                  </div>

                  {/* Output Inspection Drawer */}
                  {stepRun?.output && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        Execution Output:
                      </span>
                      <pre className="p-3 rounded-xl bg-background border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto max-h-48">
                        {JSON.stringify(stepRun.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {stepRun?.error && (
                    <div className="mt-4 pt-4 border-t border-rose-500/20">
                      <span className="text-[10px] font-mono uppercase text-rose-400 block mb-1">
                        Error Details:
                      </span>
                      <pre className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs font-mono text-rose-300 overflow-x-auto">
                        {stepRun.error}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Webhook External Trigger Helper Box */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-brand-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Inbound Webhook Trigger Endpoint
                </h4>
              </div>
              <button
                onClick={copyWebhookCommand}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-100 hover:bg-surface-50 border border-white/10 text-xs text-slate-300 transition-colors"
              >
                {copiedWebhook ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedWebhook ? 'Copied curl command!' : 'Copy curl'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Trigger this workflow externally without clicking the UI Run button:
            </p>
            <pre className="p-3 rounded-xl bg-background border border-white/10 text-xs font-mono text-cyan-300 overflow-x-auto">
              curl -X POST {webhookUrl} -H &quot;Content-Type: application/json&quot; -d &apos;{JSON.stringify({ event: 'new_ticket', feedback: 'amazing product' })}&apos;
            </pre>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WORKFLOW BUILDER & STEP CONFIGURATION                              */}
      {/* ========================================================================= */}
      {(activeTab === 'builder' || isNew) && (
        <div className="space-y-6">
          
          {/* Metadata Section */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Workflow Settings
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AI Customer Sentiment Pipeline"
                  disabled={currentRole === 'viewer'}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/10 text-white text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this chained AI workflow automates..."
                  rows={2}
                  disabled={currentRole === 'viewer'}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/10 text-white text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="webhookTrigger"
                  checked={webhookEnabled}
                  onChange={(e) => setWebhookEnabled(e.target.checked)}
                  disabled={currentRole === 'editor' || currentRole === 'viewer'}
                  className="rounded bg-surface-100 border-white/20 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="webhookTrigger" className="text-xs text-slate-300">
                  Enable Inbound Webhook Trigger ({currentRole === 'editor' ? 'Owner Only' : 'Allows external HTTP triggers'})
                </label>
              </div>
            </div>
          </div>

          {/* Ordered Steps Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Workflow Steps ({steps.length})
              </h3>
            </div>

            {steps.map((step, idx) => (
              <div key={idx} className="glass-panel p-5 rounded-2xl space-y-4 border border-white/10">
                
                {/* Step Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="h-8 w-8 rounded-xl bg-surface-100 border border-white/10 flex items-center justify-center shrink-0">
                      {getStepIcon(step.step_type)}
                    </div>
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => updateStepName(idx, e.target.value)}
                      disabled={currentRole === 'viewer'}
                      className="font-bold text-sm text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-500 focus:outline-none px-1 py-0.5 flex-1"
                    />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase">
                      {step.step_type}
                    </span>
                  </div>

                  {/* Reorder / Delete Actions */}
                  {currentRole !== 'viewer' && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => moveStep(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveStep(idx, 'down')}
                        disabled={idx === steps.length - 1}
                        className="p-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeStep(idx)}
                        className="p-1.5 rounded-lg bg-surface-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Step Specific Config Form */}
                <div className="pt-2 border-t border-white/5 space-y-3">
                  
                  {/* LLM Step Form */}
                  {step.step_type === 'llm_call' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1">
                          Prompt Template (Supports variables like {'{{steps.Step_1.output}}'} or {'{{input.feedback}}'})
                        </label>
                        <textarea
                          value={step.config?.prompt || ''}
                          onChange={(e) => updateStepConfig(idx, 'prompt', e.target.value)}
                          rows={3}
                          disabled={currentRole === 'viewer'}
                          className="w-full px-3 py-2 rounded-xl bg-background border border-white/10 text-xs font-mono text-slate-200 focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">LLM Provider</label>
                          <select
                            value={step.config?.provider || 'groq'}
                            onChange={(e) => updateStepConfig(idx, 'provider', e.target.value)}
                            disabled={currentRole === 'viewer'}
                            className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200"
                          >
                            <option value="groq">Groq (Llama 3.1 8B Instant)</option>
                            <option value="openai">OpenAI (GPT-4o mini)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">Model Name</label>
                          <input
                            type="text"
                            value={step.config?.model || 'llama-3.1-8b-instant'}
                            onChange={(e) => updateStepConfig(idx, 'model', e.target.value)}
                            disabled={currentRole === 'viewer'}
                            className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* HTTP Step Form */}
                  {step.step_type === 'http_request' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-1">
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">Method</label>
                          <select
                            value={step.config?.method || 'GET'}
                            onChange={(e) => updateStepConfig(idx, 'method', e.target.value)}
                            disabled={currentRole === 'viewer'}
                            className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">API URL</label>
                          <input
                            type="text"
                            value={step.config?.url || ''}
                            onChange={(e) => updateStepConfig(idx, 'url', e.target.value)}
                            disabled={currentRole === 'viewer'}
                            className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Conditional Branch Form */}
                  {step.step_type === 'conditional_branch' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">Operator</label>
                        <select
                          value={step.config?.operator || 'contains'}
                          onChange={(e) => updateStepConfig(idx, 'operator', e.target.value)}
                          disabled={currentRole === 'viewer'}
                          className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200"
                        >
                          <option value="contains">contains</option>
                          <option value="equals">equals</option>
                          <option value="greater_than">greater_than</option>
                          <option value="less_than">less_than</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Value</label>
                        <input
                          type="text"
                          value={step.config?.value || 'positive'}
                          onChange={(e) => updateStepConfig(idx, 'value', e.target.value)}
                          disabled={currentRole === 'viewer'}
                          className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">True Branch Name</label>
                        <input
                          type="text"
                          value={step.config?.true_branch || 'positive_route'}
                          onChange={(e) => updateStepConfig(idx, 'true_branch', e.target.value)}
                          disabled={currentRole === 'viewer'}
                          className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">False Branch Name</label>
                        <input
                          type="text"
                          value={step.config?.false_branch || 'negative_route'}
                          onChange={(e) => updateStepConfig(idx, 'false_branch', e.target.value)}
                          disabled={currentRole === 'viewer'}
                          className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-rose-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Approval Gate Form */}
                  {step.step_type === 'approval_gate' && (
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Approval Gate Instructions / Prompt
                      </label>
                      <input
                        type="text"
                        value={step.config?.message || ''}
                        onChange={(e) => updateStepConfig(idx, 'message', e.target.value)}
                        placeholder="e.g. Please review sentiment before publishing"
                        disabled={currentRole === 'viewer'}
                        className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200"
                      />
                    </div>
                  )}

                  {/* DB Write Form (Owner Only) */}
                  {step.step_type === 'db_write' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-mono text-slate-400">Database Record Key</label>
                        <span className="text-[9px] font-mono px-1.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">OWNER ONLY</span>
                      </div>
                      <input
                        type="text"
                        value={step.config?.key || 'workflow_output'}
                        onChange={(e) => updateStepConfig(idx, 'key', e.target.value)}
                        disabled={currentRole !== 'owner'}
                        className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200 disabled:opacity-50"
                      />
                    </div>
                  )}

                  {/* Notify Form (Owner Only) */}
                  {step.step_type === 'notify' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-mono text-slate-400">Notification Message</label>
                        <span className="text-[9px] font-mono px-1.5 rounded bg-rose-500/20 text-rose-300 font-bold">OWNER ONLY</span>
                      </div>
                      <input
                        type="text"
                        value={step.config?.message || ''}
                        onChange={(e) => updateStepConfig(idx, 'message', e.target.value)}
                        placeholder="Alert message template..."
                        disabled={currentRole !== 'owner'}
                        className="w-full px-3 py-1.5 rounded-lg bg-background border border-white/10 text-xs font-mono text-slate-200 disabled:opacity-50"
                      />
                    </div>
                  )}

                </div>
              </div>
            ))}

            {/* Add Step Buttons */}
            {currentRole !== 'viewer' && (
              <div className="glass-panel p-4 rounded-2xl space-y-3">
                <span className="text-xs font-mono text-slate-400 uppercase block font-semibold">
                  + Add Next Step
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  <button
                    onClick={() => addStep('llm_call')}
                    className="p-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-xs font-medium text-slate-200 flex flex-col items-center gap-1.5 transition-all hover:scale-105"
                  >
                    <Bot className="h-4 w-4 text-indigo-400" />
                    <span>LLM Call</span>
                  </button>

                  <button
                    onClick={() => addStep('http_request')}
                    className="p-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-xs font-medium text-slate-200 flex flex-col items-center gap-1.5 transition-all hover:scale-105"
                  >
                    <Globe className="h-4 w-4 text-cyan-400" />
                    <span>HTTP Request</span>
                  </button>

                  <button
                    onClick={() => addStep('conditional_branch')}
                    className="p-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-xs font-medium text-slate-200 flex flex-col items-center gap-1.5 transition-all hover:scale-105"
                  >
                    <GitBranch className="h-4 w-4 text-amber-400" />
                    <span>Branch</span>
                  </button>

                  <button
                    onClick={() => addStep('approval_gate')}
                    className="p-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-xs font-medium text-slate-200 flex flex-col items-center gap-1.5 transition-all hover:scale-105"
                  >
                    <ShieldCheck className="h-4 w-4 text-purple-400" />
                    <span>Approval Gate</span>
                  </button>

                  <button
                    onClick={() => addStep('db_write')}
                    disabled={currentRole !== 'owner'}
                    className="p-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-xs font-medium text-slate-200 flex flex-col items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-40"
                    title={currentRole !== 'owner' ? 'Owner role required' : ''}
                  >
                    <Database className="h-4 w-4 text-emerald-400" />
                    <span className="flex items-center gap-1">DB Write {currentRole !== 'owner' && <Lock className="h-3 w-3" />}</span>
                  </button>

                  <button
                    onClick={() => addStep('notify')}
                    disabled={currentRole !== 'owner'}
                    className="p-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-white/10 text-xs font-medium text-slate-200 flex flex-col items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-40"
                    title={currentRole !== 'owner' ? 'Owner role required' : ''}
                  >
                    <Bell className="h-4 w-4 text-rose-400" />
                    <span className="flex items-center gap-1">Notify {currentRole !== 'owner' && <Lock className="h-3 w-3" />}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Save Action */}
            {currentRole !== 'viewer' && (
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveWorkflow}
                  disabled={saving}
                  className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
                </button>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
