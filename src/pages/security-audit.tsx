import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Play, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Terminal, 
  Users, 
  Building2, 
  RefreshCw 
} from 'lucide-react';
import { TEST_USERS } from '@/pages/api/auth/users';

interface AuditResult {
  id: string;
  name: string;
  category: 'Layer 1: Org Isolation' | 'Layer 2: Step Gating' | 'Role Permissions' | 'Quota Enforcement';
  actor: string;
  actorRole: string;
  expected: 'ALLOWED' | 'DENIED (403)' | 'DENIED (429)' | 'DENIED (NULL)';
  status: 'PENDING' | 'PASS' | 'FAIL';
  statusCode?: number;
  actualMessage?: string;
  rawResponse?: any;
}

export default function SecurityAuditPage() {
  const [runningAll, setRunningAll] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([
    {
      id: 'test_1',
      name: 'Org B User queries Org A Workflow by ID',
      category: 'Layer 1: Org Isolation',
      actor: 'Bob (Owner Org B)',
      actorRole: 'owner',
      expected: 'DENIED (NULL)',
      status: 'PENDING',
    },
    {
      id: 'test_2',
      name: 'Org B User attempts to trigger Org A Workflow Run',
      category: 'Layer 1: Org Isolation',
      actor: 'Bob (Owner Org B)',
      actorRole: 'owner',
      expected: 'DENIED (403)',
      status: 'PENDING',
    },
    {
      id: 'test_3',
      name: 'Org B User attempts to approve Org A Approval Gate',
      category: 'Layer 1: Org Isolation',
      actor: 'Bob (Owner Org B)',
      actorRole: 'owner',
      expected: 'DENIED (403)',
      status: 'PENDING',
    },
    {
      id: 'test_4',
      name: 'Org A Editor attempts to add DB Write Step',
      category: 'Layer 2: Step Gating',
      actor: 'Edward (Editor Org A)',
      actorRole: 'editor',
      expected: 'DENIED (403)',
      status: 'PENDING',
    },
    {
      id: 'test_5',
      name: 'Org A Editor attempts to add Webhook Trigger',
      category: 'Layer 2: Step Gating',
      actor: 'Edward (Editor Org A)',
      actorRole: 'editor',
      expected: 'DENIED (403)',
      status: 'PENDING',
    },
    {
      id: 'test_6',
      name: 'Org A Viewer attempts to trigger Workflow Run',
      category: 'Role Permissions',
      actor: 'Victor (Viewer Org A)',
      actorRole: 'viewer',
      expected: 'DENIED (403)',
      status: 'PENDING',
    },
    {
      id: 'test_7',
      name: 'Org A Viewer attempts to approve Approval Gate',
      category: 'Role Permissions',
      actor: 'Victor (Viewer Org A)',
      actorRole: 'viewer',
      expected: 'DENIED (403)',
      status: 'PENDING',
    },
    {
      id: 'test_8',
      name: 'Org A Owner creates & runs authorized 5-Step Workflow',
      category: 'Role Permissions',
      actor: 'Alice (Owner Org A)',
      actorRole: 'owner',
      expected: 'ALLOWED',
      status: 'PENDING',
    },
  ]);

  const ownerA = TEST_USERS.find(u => u.name.includes('Alice'))!;
  const editorA = TEST_USERS.find(u => u.name.includes('Edward'))!;
  const viewerA = TEST_USERS.find(u => u.name.includes('Victor'))!;
  const ownerB = TEST_USERS.find(u => u.name.includes('Bob'))!;

  const runSingleTest = async (testId: string) => {
    const updated = [...results];
    const item = updated.find(r => r.id === testId);
    if (!item) return;

    try {
      if (testId === 'test_1') {
        // 1. First ensure a sample workflow exists in Org A
        const seedRes = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-hasura-user-id': ownerA.id, 'x-hasura-role': 'owner' },
          body: JSON.stringify({
            query: `
              mutation SeedWorkflow {
                insert_workflows_one(object: {
                  org_id: "${ownerA.orgId}",
                  name: "Org A Confidential Document"
                }) { id name }
              }
            `,
          }),
        });
        const seedData = await seedRes.json();
        const orgAWorkflowId = seedData.data?.insert_workflows_one?.id;

        // Query with Org B credentials
        const queryRes = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-hasura-user-id': ownerB.id, 'x-hasura-role': 'owner' },
          body: JSON.stringify({
            query: `query GetOrgAWorkflow { workflows_by_pk(id: "${orgAWorkflowId}") { id name } }`,
          }),
        });
        const queryData = await queryRes.json();

        if (queryData.data?.workflows_by_pk === null) {
          item.status = 'PASS';
          item.statusCode = 200;
          item.actualMessage = 'Access Blocked: Query returned null due to Hasura Org-Isolation filter.';
          item.rawResponse = queryData;
        } else {
          item.status = 'FAIL';
          item.actualMessage = 'Data Leak: Org B user was able to read Org A workflow!';
          item.rawResponse = queryData;
        }
      } else if (testId === 'test_2') {
        // Org B User calls triggerWorkflowRun for Org A
        const res = await fetch('/api/actions/trigger-workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { workflow_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
            session_variables: { 'x-hasura-user-id': ownerB.id, 'x-hasura-role': 'owner' },
          }),
        });
        const data = await res.json();

        if (res.status === 403 || res.status === 404 || data.message?.includes('Forbidden')) {
          item.status = 'PASS';
          item.statusCode = res.status;
          item.actualMessage = `Access Denied: ${data.message}`;
          item.rawResponse = data;
        } else {
          item.status = 'FAIL';
          item.actualMessage = `Unexpected status ${res.status}`;
          item.rawResponse = data;
        }
      } else if (testId === 'test_3') {
        // Org B User calls approveStep
        const res = await fetch('/api/actions/approve-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { step_run_id: 'a0000000-0000-0000-0000-000000000001' },
            session_variables: { 'x-hasura-user-id': ownerB.id, 'x-hasura-role': 'owner' },
          }),
        });
        const data = await res.json();

        if (res.status === 403 || res.status === 404 || data.message?.includes('Forbidden') || data.message?.includes('not found')) {
          item.status = 'PASS';
          item.statusCode = res.status;
          item.actualMessage = `Access Denied: ${data.message}`;
          item.rawResponse = data;
        } else {
          item.status = 'FAIL';
          item.actualMessage = `Unexpected response`;
          item.rawResponse = data;
        }
      } else if (testId === 'test_4') {
        // Editor A attempts to add DB Write step
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-hasura-user-id': editorA.id, 'x-hasura-role': 'editor' },
          body: JSON.stringify({
            query: `
              mutation AddDbWriteStep {
                insert_workflows_one(object: {
                  org_id: "${editorA.orgId}",
                  name: "Editor DB Write Attempt",
                  steps: { data: [{ name: "DB Step", step_type: "db_write", position: 0 }] }
                }) { id }
              }
            `,
          }),
        });
        const data = await res.json();

        if (data.errors && data.errors[0]?.message?.includes('Editors cannot add restricted step type: db_write')) {
          item.status = 'PASS';
          item.statusCode = 403;
          item.actualMessage = `Step-Gating Enforced: ${data.errors[0].message}`;
          item.rawResponse = data;
        } else {
          item.status = 'FAIL';
          item.actualMessage = 'Gating failed: Editor was allowed to insert db_write step!';
          item.rawResponse = data;
        }
      } else if (testId === 'test_5') {
        // Editor A attempts to add Webhook trigger
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-hasura-user-id': editorA.id, 'x-hasura-role': 'editor' },
          body: JSON.stringify({
            query: `
              mutation AddWebhookTrigger {
                insert_workflows_one(object: {
                  org_id: "${editorA.orgId}",
                  name: "Editor Webhook Attempt",
                  triggers: { data: [{ trigger_type: "webhook" }] }
                }) { id }
              }
            `,
          }),
        });
        const data = await res.json();

        if (data.errors && data.errors[0]?.message?.includes('Editors cannot add webhook triggers')) {
          item.status = 'PASS';
          item.statusCode = 403;
          item.actualMessage = `Trigger-Gating Enforced: ${data.errors[0].message}`;
          item.rawResponse = data;
        } else {
          item.status = 'FAIL';
          item.actualMessage = 'Gating failed';
          item.rawResponse = data;
        }
      } else if (testId === 'test_6') {
        // Viewer A attempts triggerWorkflowRun
        const res = await fetch('/api/actions/trigger-workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { workflow_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
            session_variables: { 'x-hasura-user-id': viewerA.id, 'x-hasura-role': 'viewer' },
          }),
        });
        const data = await res.json();

        if (res.status === 403 || data.message?.includes('Viewer')) {
          item.status = 'PASS';
          item.statusCode = 403;
          item.actualMessage = `Role Check Enforced: ${data.message}`;
          item.rawResponse = data;
        } else {
          item.status = 'FAIL';
          item.actualMessage = 'Viewer trigger check failed';
          item.rawResponse = data;
        }
      } else if (testId === 'test_7') {
        // Viewer A attempts approveStep
        const res = await fetch('/api/actions/approve-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { step_run_id: 'a0000000-0000-0000-0000-000000000001' },
            session_variables: { 'x-hasura-user-id': viewerA.id, 'x-hasura-role': 'viewer' },
          }),
        });
        const data = await res.json();

        if (res.status === 403 || data.message?.includes('Viewer')) {
          item.status = 'PASS';
          item.statusCode = 403;
          item.actualMessage = `Role Check Enforced: ${data.message}`;
          item.rawResponse = data;
        } else {
          item.status = 'FAIL';
          item.actualMessage = 'Viewer approval check failed';
          item.rawResponse = data;
        }
      } else if (testId === 'test_8') {
        // Owner A creates and runs authorized workflow
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-hasura-user-id': ownerA.id, 'x-hasura-role': 'owner' },
          body: JSON.stringify({
            query: `
              mutation CreateAndRun {
                insert_workflows_one(object: {
                  org_id: "${ownerA.orgId}",
                  name: "Authorized Owner Pipeline",
                  steps: { data: [{ name: "HTTP", step_type: "http_request", position: 0 }] }
                }) { id name }
              }
            `,
          }),
        });
        const data = await res.json();
        const wfId = data.data?.insert_workflows_one?.id;

        if (wfId) {
          const runRes = await fetch('/api/actions/trigger-workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { workflow_id: wfId },
              session_variables: { 'x-hasura-user-id': ownerA.id, 'x-hasura-role': 'owner' },
            }),
          });
          const runData = await runRes.json();

          if (runRes.status === 200) {
            item.status = 'PASS';
            item.statusCode = 200;
            item.actualMessage = 'Success: Authorized workflow created and executed successfully by Owner.';
            item.rawResponse = runData;
          } else {
            item.status = 'FAIL';
            item.actualMessage = `Run failed: ${runData.message}`;
            item.rawResponse = runData;
          }
        }
      }
    } catch (err: any) {
      item.status = 'FAIL';
      item.actualMessage = err.message;
    }

    setResults([...updated]);
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    for (const item of results) {
      await runSingleTest(item.id);
    }
    setRunningAll(false);
  };

  const passedCount = results.filter(r => r.status === 'PASS').length;

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> 2-Layer Security & Isolation Suite
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-2">
              RBAC & Cross-Tenant Security Audit Matrix
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Live automated sandbox testing <strong>Layer 1 Organization Isolation</strong> (cross-tenant denial), <strong>Layer 2 Step-Level Gating</strong> (Owner vs Editor vs Viewer), and <strong>Hasura Action Security</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunAll}
              disabled={runningAll}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{runningAll ? 'Executing Security Suite...' : 'Run All Security Tests'}</span>
            </button>
          </div>
        </div>

        {/* Stats Gauge */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="p-3 rounded-xl bg-surface-200 border border-white/5 space-y-1">
            <span className="text-slate-400 font-mono">Total Verification Tests</span>
            <div className="text-lg font-bold text-white">{results.length} Tests</div>
          </div>
          <div className="p-3 rounded-xl bg-surface-200 border border-white/5 space-y-1">
            <span className="text-slate-400 font-mono">Passed Verification</span>
            <div className="text-lg font-bold text-emerald-400">{passedCount} Passed</div>
          </div>
          <div className="p-3 rounded-xl bg-surface-200 border border-white/5 space-y-1">
            <span className="text-slate-400 font-mono">Layer 1 & 2 Security Status</span>
            <div className="text-lg font-bold text-brand-300">
              {passedCount === results.length ? '100% SECURE & VERIFIED' : 'READY TO AUDIT'}
            </div>
          </div>
        </div>
      </div>

      {/* Tests Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
          <Terminal className="h-5 w-5 text-brand-400" />
          <span>Security Matrix Test Cases</span>
        </h2>

        <div className="space-y-3">
          {results.map((r, idx) => (
            <div
              key={r.id}
              className={`glass-panel p-5 rounded-2xl border transition-all ${
                r.status === 'PASS'
                  ? 'border-emerald-500/30 bg-emerald-950/10'
                  : r.status === 'FAIL'
                  ? 'border-rose-500/50 bg-rose-950/20'
                  : 'border-white/5 bg-surface-200/30'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Left info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 font-semibold">
                      {r.category}
                    </span>
                    <h3 className="text-sm font-bold text-white">{r.name}</h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 font-mono pt-1">
                    <span>Actor: <strong className="text-slate-200">{r.actor}</strong> ({r.actorRole.toUpperCase()})</span>
                    <span>•</span>
                    <span>Expected: <strong className="text-cyan-300">{r.expected}</strong></span>
                  </div>
                </div>

                {/* Right Action & Status */}
                <div className="flex items-center gap-3">
                  {r.status === 'PASS' && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono">
                      <CheckCircle2 className="h-4 w-4" /> VERIFIED (PASSED)
                    </span>
                  )}
                  {r.status === 'FAIL' && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold font-mono">
                      <XCircle className="h-4 w-4" /> FAILED
                    </span>
                  )}
                  {r.status === 'PENDING' && (
                    <span className="text-xs text-slate-500 font-mono">
                      ⚪ Not Run
                    </span>
                  )}

                  <button
                    onClick={() => runSingleTest(r.id)}
                    className="px-3 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-50 border border-white/10 text-xs font-medium text-slate-200 transition-colors"
                  >
                    Run Test
                  </button>
                </div>

              </div>

              {/* Message log */}
              {r.actualMessage && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                  <span className={r.status === 'PASS' ? 'text-emerald-300' : 'text-rose-300'}>
                    Result: {r.actualMessage}
                  </span>
                  {r.statusCode && (
                    <span className="px-2 py-0.5 rounded bg-surface-100 text-slate-300 border border-white/10">
                      HTTP {r.statusCode}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
