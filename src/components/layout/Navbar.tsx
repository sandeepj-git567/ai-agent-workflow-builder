import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { 
  Workflow, 
  ShieldCheck, 
  User, 
  Building2, 
  Cpu, 
  Activity,
  Layers,
  ChevronDown
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const { currentUser, switchUser, allUsers, orgUsage, currentRole } = useAuth();

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'editor':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'viewer':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const used = orgUsage?.calls_used ?? 0;
  const allowed = orgUsage?.calls_allowed ?? 100;
  const percent = Math.min(100, Math.round((used / allowed) * 100));

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-surface-300/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <Cpu className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  AgentFlow
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    NHOST + HASURA
                  </span>
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center space-x-1">
              <Link
                href="/"
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  router.pathname === '/' || router.pathname.startsWith('/workflows')
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Layers className="h-4 w-4" />
                <span>Workflows</span>
              </Link>
              <Link
                href="/security-audit"
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  router.pathname === '/security-audit'
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>RBAC & Security Sandbox</span>
              </Link>
            </nav>
          </div>

          {/* Right Side: Quota Gauge & User Switcher */}
          <div className="flex items-center space-x-4">
            
            {/* Quota Widget */}
            <div className="hidden lg:flex items-center space-x-3 px-3 py-1.5 rounded-lg bg-surface-200 border border-white/10">
              <Activity className="h-4 w-4 text-brand-400" />
              <div className="text-xs">
                <div className="flex items-center justify-between text-slate-300 gap-3 font-mono">
                  <span>Quota:</span>
                  <span className="font-semibold text-white">
                    {used} / {allowed} calls
                  </span>
                </div>
                <div className="w-28 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      percent > 80 ? 'bg-rose-500' : percent > 50 ? 'bg-amber-500' : 'bg-brand-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Organization Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-200 border border-white/10 text-xs">
              <Building2 className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-200">{currentUser.orgName}</span>
            </div>

            {/* Persona / User Switcher */}
            <div className="relative flex items-center">
              <div className="flex items-center space-x-2 pl-3 pr-2 py-1.5 rounded-lg bg-surface-100 border border-white/15">
                <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-slate-300" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-mono uppercase px-1 py-0.2 rounded border font-semibold ${getRoleBadge(currentRole)}`}>
                      {currentRole}
                    </span>
                  </div>
                </div>
                
                {/* Select Dropdown */}
                <select
                  value={currentUser.id}
                  onChange={(e) => switchUser(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Switch Persona / Account"
                >
                  <optgroup label="Organization A (Acme Corp)">
                    {allUsers.filter(u => u.orgId.startsWith('aaaa')).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Organization B (Beta Labs)">
                    {allUsers.filter(u => u.orgId.startsWith('bbbb')).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Multi-Tenant User">
                    {allUsers.filter(u => u.id.startsWith('ab')).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
              </div>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
