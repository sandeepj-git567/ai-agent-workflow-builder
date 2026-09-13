import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  Cpu, 
  Database, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface IntroVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IntroVideoModal: React.FC<IntroVideoModalProps> = ({ isOpen, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setSceneIndex(0);
      return;
    }

    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          const next = prev + 2; // 50 ticks * 100ms = 5000ms = 5s
          
          if (next < 35) {
            setSceneIndex(0);
          } else if (next < 70) {
            setSceneIndex(1);
          } else {
            setSceneIndex(2);
          }

          return next;
        });
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  if (!isOpen) return null;

  const handleRestart = () => {
    setProgress(0);
    setSceneIndex(0);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl glass-panel rounded-3xl border border-white/20 shadow-2xl overflow-hidden text-white space-y-0">
        
        {/* Top Header */}
        <div className="p-4 px-6 bg-surface-200/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" /> 5-Second Platform Tour
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video Canvas Area */}
        <div className="relative h-64 bg-gradient-to-br from-surface-300 via-surface-200 to-black p-8 flex flex-col justify-between overflow-hidden">
          
          {/* Animated Background Mesh */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(99,102,241,0.25),rgba(255,255,255,0))]" />
          
          {/* Scene 1: AI Agent Workflows */}
          {sceneIndex === 0 && (
            <div className="relative z-10 my-auto space-y-3 animate-fadeIn">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Cpu className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  Feature 1 of 3: AI Agent Orchestration
                </span>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  Autonomous Multi-Step AI Pipelines
                </h3>
                <p className="text-xs text-slate-300 max-w-md font-sans">
                  Chain LLM reasoning steps, HTTP tools, conditional branches, and human approval gates into unified agent workflows.
                </p>
              </div>
            </div>
          )}

          {/* Scene 2: RAG Vector Knowledge Base */}
          {sceneIndex === 1 && (
            <div className="relative z-10 my-auto space-y-3 animate-fadeIn">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Database className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  Feature 2 of 3: pgvector RAG Pipeline
                </span>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  Ingest Local Documents & Vector Search
                </h3>
                <p className="text-xs text-slate-300 max-w-md font-sans">
                  Upload PDF, Markdown, or JSON files from local storage. Auto-chunk and perform high-speed cosine vector similarity searches.
                </p>
              </div>
            </div>
          )}

          {/* Scene 3: Enterprise RBAC & Security Guard */}
          {sceneIndex === 2 && (
            <div className="relative z-10 my-auto space-y-3 animate-fadeIn">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Feature 3 of 3: SSRF & RBAC Governance
                </span>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  Multi-Tenant Security & Prompt Protection
                </h3>
                <p className="text-xs text-slate-300 max-w-md font-sans">
                  Strict organization isolation, private IP SSRF guards, XML boundary injection shields, and real-time SSE event subscriptions.
                </p>
              </div>
            </div>
          )}

          {/* 5-Second Progress Bar */}
          <div className="relative z-10 w-full space-y-1 pt-4">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>0s</span>
              <span className="text-brand-300 font-bold">{(progress * 0.05).toFixed(1)}s / 5.0s</span>
              <span>5s</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

        </div>

        {/* Video Control Bar */}
        <div className="p-4 px-6 bg-surface-300 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={handleRestart}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Watch Again"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-lg shadow-brand-500/20 flex items-center gap-1.5"
          >
            <span>Explore Platform</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
