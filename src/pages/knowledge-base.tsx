import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  Database, 
  Layers, 
  UploadCloud,
  FileCheck,
  RefreshCw,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Document, RAGSearchResult } from '@/types';

export default function KnowledgeBasePage() {
  const { currentUser, currentOrgId, currentRole } = useAuth();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  // Ingestion Mode: 'file' | 'text'
  const [ingestMode, setIngestMode] = useState<'file' | 'text'>('file');

  // Local File Selected State
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
    extension: string;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [fileType, setFileType] = useState('pdf');
  const [chunkSize, setChunkSize] = useState(500);

  // Search Tester State
  const [searchQuery, setSearchQuery] = useState('VIP response SLA policy');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RAGSearchResult[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?org_id=${currentOrgId}`, {
        headers: {
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
      });
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [currentOrgId, currentUser.id, currentRole]);

  // Handle Reading Local File Content
  const processLocalFile = (file: File) => {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'text';
    
    // Map extension to file_type
    let detectedType = 'text';
    if (['md', 'markdown'].includes(ext)) detectedType = 'markdown';
    else if (['json'].includes(ext)) detectedType = 'json';
    else if (['csv'].includes(ext)) detectedType = 'csv';
    else if (['pdf'].includes(ext)) detectedType = 'pdf';
    else if (['doc', 'docx'].includes(ext)) detectedType = 'docx';
    else if (['js', 'ts', 'py', 'html', 'css'].includes(ext)) detectedType = 'code';

    setSelectedFile({
      name: file.name,
      size: file.size,
      type: file.type || 'text/plain',
      extension: ext,
    });
    setName(file.name);
    setFileType(detectedType);

    const reader = new FileReader();

    // For binary files like PDF, read as DataURL (base64) so server PDF parser receives intact binary buffer
    if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
      reader.onload = (e) => {
        const base64Data = (e.target?.result as string) || '';
        setContent(base64Data);
      };
      reader.readAsDataURL(file);
    } else {
      // For text-based files, read as UTF-8 text
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        setContent(text);
      };
      reader.readAsText(file);
    }

    reader.onerror = () => {
      alert('Error reading local file from device');
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processLocalFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processLocalFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !content) {
      alert('Document name and file content are required');
      return;
    }

    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers cannot upload documents');
      return;
    }

    setUploading(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
        body: JSON.stringify({
          org_id: currentOrgId,
          name,
          content,
          file_type: fileType,
          chunk_size: Number(chunkSize),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error uploading document');
      }

      setName('');
      setContent('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDocuments();
    } catch (err: any) {
      alert(`Ingestion Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleReprocessDocument = async (docId: string) => {
    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers cannot reprocess documents');
      return;
    }

    setReprocessingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/reprocess`, {
        method: 'POST',
        headers: {
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reprocess document');
      }

      await loadDocuments();
      alert(`Document Reprocessed Successfully! Status: ${data.diagnostics?.finalStatus}, Chunks: ${data.diagnostics?.chunksCreated}`);
    } catch (err: any) {
      alert(`Reprocess Error: ${err.message}`);
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (currentRole === 'viewer') {
      alert('Forbidden: Viewers cannot delete documents');
      return;
    }

    if (!confirm('Are you sure you want to delete this document? All chunks and embeddings will be removed.')) return;

    try {
      await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
      });
      await loadDocuments();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleSearchRAG = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    setSearching(true);
    try {
      const res = await fetch('/api/rag/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-user-id': currentUser.id,
          'x-hasura-role': currentRole,
        },
        body: JSON.stringify({
          org_id: currentOrgId,
          query: searchQuery,
          top_k: 3,
        }),
      });

      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('RAG Search Error:', err);
    } finally {
      setSearching(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" /> RAG Knowledge Base & pgvector Store
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-2">
              Document Intelligence & RAG Pipeline
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Upload PDF documents or paste text. High-fidelity page extraction, quality validation, SHA-256 deduplication, vector embeddings, and tenant-isolated retrieval.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Local File Upload & Ingestion Form */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-cyan-400" />
                <span>Ingest Local Document</span>
              </h2>

              {/* Mode Toggle Tabs */}
              <div className="flex p-0.5 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setIngestMode('file')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${ingestMode === 'file' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  📁 File
                </button>
                <button
                  type="button"
                  onClick={() => setIngestMode('text')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${ingestMode === 'text' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  ✍️ Text
                </button>
              </div>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-4 text-xs">
              
              {/* Local File Picker & Drag and Drop Zone */}
              {ingestMode === 'file' && (
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">Select File from Device:</label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      dragActive 
                        ? 'border-cyan-400 bg-cyan-500/10' 
                        : selectedFile 
                        ? 'border-emerald-500/40 bg-emerald-950/10' 
                        : 'border-white/10 hover:border-cyan-500/50 bg-surface-100 hover:bg-surface-200'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      accept=".txt,.md,.markdown,.json,.csv,.pdf,.doc,.docx,.html,.js,.ts,.py"
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="space-y-2">
                        <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                          <FileCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs truncate max-w-[200px] mx-auto">{selectedFile.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {formatFileSize(selectedFile.size)} • .{selectedFile.extension.toUpperCase()}
                          </p>
                        </div>
                        <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                          Ready for Vector Chunking
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="h-10 w-10 mx-auto rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">Click to browse or drop file here</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">
                            Supports PDF, DOCX, Markdown, Text, JSON, CSV
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-mono">Document Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme_SLA_Policy.pdf"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-100 border border-white/10 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">File Format:</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-100 border border-white/10 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="pdf">PDF Document (.pdf)</option>
                    <option value="markdown">Markdown (.md)</option>
                    <option value="text">Plain Text (.txt)</option>
                    <option value="docx">Word Document (.docx)</option>
                    <option value="json">JSON (.json)</option>
                    <option value="csv">CSV Sheet (.csv)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono">Chunk Window:</label>
                  <select
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-100 border border-white/10 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value={200}>200 chars (Fine)</option>
                    <option value={300}>300 chars (Standard)</option>
                    <option value={500}>500 chars (Medium)</option>
                    <option value={800}>800 chars (Coarse)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 font-mono text-slate-400">
                  <span>File Buffer / Content:</span>
                  <span className="text-cyan-400 text-[10px]">{content.length} chars</span>
                </div>
                <textarea
                  required
                  rows={5}
                  placeholder="File content or base64 binary stream will appear here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-100 border border-white/10 text-white focus:outline-none focus:border-cyan-500 font-mono text-[11px]"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || currentRole === 'viewer'}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Extracting, Chunking & Vectorizing...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Ingest into Vector Store</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Ingested Documents List & RAG Vector Search Tester */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* RAG Vector Search Sandbox */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 border-cyan-500/30">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Search className="h-4 w-4 text-cyan-400" />
              <span>RAG Semantic Search Sandbox</span>
            </h2>

            <form onSubmit={handleSearchRAG} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Query knowledge base using vector similarity..."
                className="flex-1 px-4 py-2 rounded-xl bg-surface-100 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-cyan-500/20"
              >
                {searching ? 'Searching...' : 'Vector Search'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-mono text-cyan-300 font-bold uppercase">
                  TOP VECTOR MATCHES ({searchResults.length}):
                </span>
                {searchResults.map((res, i) => {
                  const isCorrupted = res.content.includes('\uFFFD') || res.metadata?.quality_status === 'failed';
                  const pageNumber = res.metadata?.page_number;
                  const sectionTitle = res.metadata?.section_title;

                  return (
                    <div key={i} className="p-4 rounded-xl bg-surface-200 border border-cyan-500/30 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-cyan-400" />
                          {res.document_name}
                          {pageNumber && (
                            <span className="text-slate-400 font-normal"> — Page {pageNumber}</span>
                          )}
                          {sectionTitle && (
                            <span className="text-slate-400 font-normal"> · {sectionTitle}</span>
                          )}
                        </span>
                        <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                          Relevance: {Math.round(res.score * 100)}%
                        </span>
                      </div>

                      {isCorrupted ? (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                          <span>Preview unavailable because this document requires OCR.</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-200 font-mono bg-black/30 p-3 rounded-lg whitespace-pre-wrap leading-relaxed">
                          {res.content}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ingested Documents List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-400" />
                <span>Ingested Documents ({documents.length})</span>
              </h2>

              <span className="text-xs font-mono text-slate-400">
                Vector Index & Deduplication
              </span>
            </div>

            {loading ? (
              <div className="h-40 bg-surface-200 rounded-2xl animate-pulse" />
            ) : documents.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl text-center text-slate-400 text-sm">
                No documents ingested in this organization yet. Use the local file uploader on the left to add your first PDF or document.
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const status = doc.status;
                  const isFailed = status === 'failed';
                  const pageCount = doc.metadata?.page_count || doc.metadata?.pageCount || 1;
                  const charCount = doc.metadata?.char_count || doc.content?.length || 0;
                  const extractionMethod = doc.metadata?.extraction_method || doc.metadata?.extractionMethod || 'text';
                  const qualityStatus = doc.metadata?.quality_status || (isFailed ? 'failed' : 'good');

                  return (
                    <div
                      key={doc.id}
                      className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                            <h3 className="text-sm font-bold text-white">{doc.name}</h3>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                              {doc.file_type}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                              status === 'processed' 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                : status === 'failed' 
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}>
                              {status === 'failed' ? 'EXTRACTION_FAILED / OCR_REQUIRED' : status.toUpperCase()}
                            </span>

                            {qualityStatus === 'failed' && (
                              <span className="text-[10px] font-mono bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Scanned / OCR Needed
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-300 mt-2 line-clamp-2 font-mono bg-black/20 p-2.5 rounded">
                            {isFailed 
                              ? "This PDF could not be extracted as readable text. It may be scanned or protected. Try OCR processing or upload a text-based PDF."
                              : doc.content
                            }
                          </p>
                        </div>

                        {currentRole !== 'viewer' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReprocessDocument(doc.id)}
                              disabled={reprocessingId === doc.id}
                              className="p-2 rounded-lg bg-surface-100 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/5 transition-colors flex items-center gap-1 text-xs font-mono"
                              title="Reprocess Document"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${reprocessingId === doc.id ? 'animate-spin text-cyan-400' : ''}`} />
                              <span className="hidden sm:inline">Reprocess</span>
                            </button>

                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-2 rounded-lg bg-surface-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 transition-colors"
                              title="Delete Document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Diagnostic & Metadata Footer */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-mono flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                            <Layers className="h-3.5 w-3.5" /> {doc.chunks?.length || 0} Chunks Vectorized
                          </span>
                          <span>• {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}</span>
                          <span>• Method: {extractionMethod}</span>
                          <span>• {charCount} chars</span>
                        </div>
                        <span>Ingested {new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
