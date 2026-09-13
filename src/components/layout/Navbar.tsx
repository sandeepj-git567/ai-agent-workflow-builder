import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { IntroVideoModal } from '@/components/IntroVideoModal';
import { 
  Workflow, 
  ShieldCheck, 
  User, 
  Building2, 
  Cpu, 
  Activity,
  Layers,
  ChevronDown,
  Check,
  Play
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const { currentUser, switchUser, allUsers, orgUsage, currentRole } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const orgAUsers = allUsers.filter(u => u.orgId.startsWith('aaaa'));
  const orgBUsers = allUsers.filter(u => u.orgId.startsWith('bbbb'));
  const multiTenantUsers = allUsers.filter(u => u.id.startsWith('ab'));

  return (
    <>
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
                  href="/agent-playground"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    router.pathname === '/agent-playground'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Cpu className="h-4 w-4 text-brand-400" />
                  <span>AI Agent</span>
                </Link>

                <Link
                  href="/knowledge-base"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    router.pathname === '/knowledge-base'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Activity className="h-4 w-4 text-cyan-400" />
                  <span>RAG Knowledge</span>
                </Link>

                <Link
                  href="/prompts"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    router.pathname === '/prompts'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Workflow className="h-4 w-4 text-purple-400" />
                  <span>Prompt Studio</span>
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
                  <span>RBAC & Security</span>
                </Link>
              </nav>
            </div>

            {/* Right Side: 5s Intro Video Button, Quota Gauge & Persona Switcher */}
            <div className="flex items-center space-x-4">
              
              {/* 5s Platform Tour Video Button */}
              <button
                type="button"
                onClick={() => setIntroOpen(true)}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-brand-500/20"
              >
                <Play className="h-3.5 w-3.5 fill-current text-brand-400" />
                <span>5s Intro Video</span>
              </button>

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

              {/* Persona / Custom User Switcher Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-surface-200 border border-white/15 text-left transition-all cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white leading-tight">
                      {currentUser.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded border font-semibold ${getRoleBadge(currentRole)}`}>
                        {currentRole}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 ml-1 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* High-Contrast Glassmorphic Dropdown Popover */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0f172a] border border-white/15 shadow-2xl py-2 z-50 divide-y divide-white/10 text-xs font-sans">
                    
                    {/* Org A */}
                    <div className="py-2">
                      <div className="px-4 py-1 text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase">
                        Organization A (Acme Corp)
                      </div>
                      {orgAUsers.map(u => {
                        const isSelected = u.id === currentUser.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              switchUser(u.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-white/10 transition-colors ${
                              isSelected ? 'bg-indigo-500/20 text-white font-bold' : 'text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{u.name}</span>
                              <span className={`text-[9px] font-mono uppercase px-1 rounded border ${getRoleBadge(u.role)}`}>
                                {u.role}
                              </span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Org B */}
                    <div className="py-2">
                      <div className="px-4 py-1 text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase">
                        Organization B (Beta Labs)
                      </div>
                      {orgBUsers.map(u => {
                        const isSelected = u.id === currentUser.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              switchUser(u.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-white/10 transition-colors ${
                              isSelected ? 'bg-cyan-500/20 text-white font-bold' : 'text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{u.name}</span>
                              <span className={`text-[9px] font-mono uppercase px-1 rounded border ${getRoleBadge(u.role)}`}>
                                {u.role}
                              </span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Multi-Tenant */}
                    {multiTenantUsers.length > 0 && (
                      <div className="py-2">
                        <div className="px-4 py-1 text-[10px] font-mono font-bold tracking-wider text-purple-400 uppercase">
                          Multi-Tenant User
                        </div>
                        {multiTenantUsers.map(u => {
                          const isSelected = u.id === currentUser.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                switchUser(u.id);
                                setDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-white/10 transition-colors ${
                                isSelected ? 'bg-purple-500/20 text-white font-bold' : 'text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{u.name}</span>
                              </div>
                              {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* 5-Second Intro Showcase Video Modal */}
      <IntroVideoModal isOpen={introOpen} onClose={() => setIntroOpen(false)} />
    </>
  );
};
