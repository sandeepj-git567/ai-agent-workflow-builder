import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  FileText, 
  UploadCloud, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  RefreshCw, 
  FileCheck,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Document } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  sourceDetails?: Array<{
    documentId: string;
    documentName: string;
    pageNumber?: number;
    sectionTitle?: string;
    content: string;
    relevanceScore: number;
  }>;
}

export default function RagSysChatPage() {
  const { currentUser, currentOrgId, currentRole } = useAuth();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Chat State
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState('');
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/documents?org_id=${currentOrgId}`, {
        headers: {
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
      });
      const data = await res.json();
      const docsList: Document[] = data.documents || [];
      setDocuments(docsList);

      // Auto select first document if none selected
      if (docsList.length > 0 && !selectedDoc) {
        setSelectedDoc(docsList[0]);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [currentOrgId, currentUser.id, currentRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, asking]);

  const handleUploadFile = async (file: File) => {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'txt', 'md', 'docx', 'json', 'csv'].includes(ext)) {
      setUploadError('Supported formats: PDF, DOCX, TXT, MD, JSON, CSV');
      return;
    }

    setUploadError('');
    setSelectedFile(file);
    setUploading(true);

    try {
      const reader = new FileReader();
      
      const fileContent = await new Promise<string>((resolve, reject) => {
        if (ext === 'pdf' || ext === 'docx') {
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.readAsDataURL(file);
        } else {
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.readAsText(file);
        }
        reader.onerror = (err) => reject(err);
      });

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
        body: JSON.stringify({
          org_id: currentOrgId,
          name: file.name,
          content: fileContent,
          file_type: ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'text',
          chunk_size: 500,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      await loadDocuments();
      setSelectedDoc(data.document);
      setMessages([
        {
          role: 'assistant',
          content: `Your PDF document "${file.name}" has been extracted, chunked, and vectorized successfully. Ask me anything about the document.`,
        },
      ]);
    } catch (err: any) {
      setUploadError(err.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleAskQuestion = async (customQuery?: string) => {
    const q = (customQuery || question).trim();
    if (!q || asking) return;

    if (!selectedDoc && documents.length === 0) {
      setChatError('Please upload a PDF document first.');
      return;
    }

    setChatError('');
    setQuestion('');
    setAsking(true);

    setMessages((prev) => [...prev, { role: 'user', content: q }]);

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
        body: JSON.stringify({
          org_id: currentOrgId,
          document_id: selectedDoc?.id,
          question: q,
          top_k: 3,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error asking question');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          sourceDetails: data.source_details || [],
        },
      ]);
    } catch (err: any) {
      setChatError(err.message || 'Failed to generate answer');
    } finally {
      setAsking(false);
    }
  };

  const toggleSourceExpand = (index: number) => {
    setExpandedSources((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> RagSys AI-Powered PDF Assistant
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-2">
              Chat With Your Documents
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Strict document-grounded question answering system based on RagSys. Uses vectorized PDF context with exact source attribution citations.
            </p>
          </div>

          {/* Document Dropdown Selector */}
          {documents.length > 0 && (
            <div className="flex items-center gap-2 bg-surface-100 p-2 rounded-xl border border-white/10 shrink-0">
              <FileText className="h-4 w-4 text-cyan-400" />
              <select
                value={selectedDoc?.id || ''}
                onChange={(e) => {
                  const doc = documents.find((d) => d.id === e.target.value);
                  if (doc) setSelectedDoc(doc);
                }}
                className="bg-transparent text-white text-xs font-mono focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.name} ({d.file_type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      {!selectedDoc && documents.length === 0 ? (
        
        /* Hero Upload Box when no documents exist */
        <div className="glass-panel p-8 sm:p-12 rounded-2xl text-center space-y-6 max-w-2xl mx-auto">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <UploadCloud className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">Upload Your PDF Document</h2>
            <p className="text-xs text-slate-400 mt-1">
              RagSys extracts text, chunks content, creates vector embeddings, and answers your questions using strict grounded reasoning.
            </p>
          </div>

          <label
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]);
            }}
            className={`border-2 border-dashed rounded-2xl p-8 cursor-pointer block transition-all ${
              dragActive
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-white/10 hover:border-cyan-500/50 bg-surface-100 hover:bg-surface-200'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.docx,.json,.csv"
              onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
              className="hidden"
            />
            
            <div className="space-y-2">
              <span className="text-2xl">📄</span>
              <p className="font-semibold text-white text-sm">
                {uploading ? 'Processing & Vectorizing PDF...' : 'Click to browse or drop PDF here'}
              </p>
              <p className="text-xs text-slate-400 font-mono">Supports PDF, DOCX, Markdown, Text</p>
            </div>
          </label>

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 justify-center">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      ) : (
        
        /* Active Document Chat Interface */
        <div className="glass-panel rounded-2xl border border-cyan-500/30 overflow-hidden flex flex-col min-h-[600px]">
          
          {/* Active Document Header Bar */}
          <div className="p-4 bg-surface-100 border-b border-white/10 flex items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-500/30">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{selectedDoc?.name}</h3>
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Document Ready • {selectedDoc?.chunks?.length || 1} Chunks Vectorized
                </span>
              </div>
            </div>

            <label className="px-3 py-1.5 rounded-xl bg-surface-200 hover:bg-surface-100 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5">
              <span>Change PDF</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.docx"
                onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[500px]">
            {messages.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="h-12 w-12 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Ask anything about &quot;{selectedDoc?.name}&quot;</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    RagSys answers questions strictly using your document&apos;s text context. Try one of the suggested prompts below:
                  </p>
                </div>

                {/* Sample Prompt Chips */}
                <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto pt-2">
                  {[
                    "Summarize the key policy rules in this document",
                    "What are the main requirements mentioned?",
                    "What is the SLA response time guideline?",
                  ].map((sample, i) => (
                    <button
                      key={i}
                      onClick={() => handleAskQuestion(sample)}
                      className="px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 text-xs font-mono transition-all text-left"
                    >
                      💡 {sample}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 text-xs ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-xl bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0">
                      AI
                    </div>
                  )}

                  <div className={`space-y-2 max-w-2xl ${
                    msg.role === 'user'
                      ? 'bg-cyan-600 text-white rounded-2xl rounded-tr-none p-4'
                      : 'glass-panel text-slate-200 rounded-2xl rounded-tl-none p-4 border-white/10'
                  }`}>
                    <p className="font-mono leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                    {/* Sources Section */}
                    {msg.sourceDetails && msg.sourceDetails.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <button
                          onClick={() => toggleSourceExpand(idx)}
                          className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 font-bold hover:underline"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>📚 Sources ({msg.sourceDetails.length} Chunks Cited)</span>
                          {expandedSources[idx] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>

                        {expandedSources[idx] && (
                          <div className="space-y-2 pt-1">
                            {msg.sourceDetails.map((src, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-3 rounded-xl bg-black/30 border border-cyan-500/20 text-[11px] font-mono space-y-1"
                              >
                                <div className="flex items-center justify-between text-cyan-300 font-bold">
                                  <span>
                                    Source #{sIdx + 1}: {src.documentName}
                                    {src.pageNumber && ` (Page ${src.pageNumber})`}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                                    Relevance: {src.relevanceScore}%
                                  </span>
                                </div>
                                <p className="text-slate-300 bg-surface-200/50 p-2 rounded leading-relaxed">
                                  {src.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="h-8 w-8 rounded-xl bg-surface-100 text-slate-300 font-bold flex items-center justify-center shrink-0 border border-white/10">
                      You
                    </div>
                  )}
                </div>
              ))
            )}

            {asking && (
              <div className="flex gap-3 text-xs justify-start">
                <div className="h-8 w-8 rounded-xl bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0">
                  AI
                </div>
                <div className="glass-panel p-4 rounded-2xl rounded-tl-none border-white/10 flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span className="font-mono text-slate-400">RagSys is searching vector store & generating grounded answer...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {chatError && (
            <div className="mx-4 mb-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span>{chatError}</span>
            </div>
          )}

          {/* Question Input Box */}
          <div className="p-4 bg-surface-100 border-t border-white/10 space-y-2">
            <div className="flex gap-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your PDF..."
                rows={2}
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-200 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-500 resize-none"
              />
              <button
                onClick={() => handleAskQuestion()}
                disabled={!question.trim() || asking}
                className="px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[10px] text-slate-400 font-mono text-center">
              Answers are strictly generated using information from your uploaded document.
            </p>
          </div>

        </div>
      )}

    </div>
  );
}
