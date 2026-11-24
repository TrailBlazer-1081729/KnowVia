import React, { useState } from 'react';
import {
  X,
  FileText,
  Database,
  Cpu,
  CheckCircle2,
  Copy,
  Check,
  Search,
  BookOpen,
} from 'lucide-react';
import type { DocumentMetadata, SourceCitation } from '../../types';

interface ContextPanelProps {
  document: DocumentMetadata | null;
  sources: SourceCitation[];
  highlightedCitationId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  document,
  sources,
  highlightedCitationId,
  isOpen,
  onClose,
}) => {
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const copySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const filteredSources = sources.filter(
    (s) =>
      s.snippet.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.section && s.section.toLowerCase().includes(searchFilter.toLowerCase())) ||
      s.page.toString().includes(searchFilter)
  );

  return (
    <aside className="w-80 lg:w-96 border-l border-[#e7e5e4] dark:border-[#27272a] bg-[#f5f5f5] dark:bg-[#0c0a09] flex flex-col h-full overflow-hidden shrink-0 z-30 transition-all">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#e7e5e4] dark:border-[#27272a] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-[#0c0a09] dark:text-[#f5f5f5]" />
          <h3 className="font-display-light text-xl text-[#0c0a09] dark:text-[#f5f5f5]">
            Document Intelligence
          </h3>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-[#777169] dark:text-[#a8a29e] hover:text-[#0c0a09] dark:hover:text-[#f5f5f5] hover:bg-[#f0efed] dark:hover:bg-[#1c1917] transition-colors"
          title="Close Context Panel"
          aria-label="Close Context Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* SECTION 1: Document Details */}
        {document ? (
          <div>
            <div className="text-[11px] font-semibold font-sans-editorial text-[#777169] dark:text-[#a8a29e] uppercase tracking-wider mb-2">
              Ingested Document
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] space-y-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-[#0c0a09] dark:text-[#f5f5f5] shrink-0 mt-0.5" />
                <span className="text-xs font-medium font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5] break-words">
                  {document.filename}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#e7e5e4] dark:border-[#27272a] text-[11px] font-sans-editorial">
                <div>
                  <span className="text-[#a8a29e] block">Size</span>
                  <span className="font-medium text-[#0c0a09] dark:text-[#f5f5f5]">
                    {formatBytes(document.size_bytes)}
                  </span>
                </div>
                <div>
                  <span className="text-[#a8a29e] block">Pages</span>
                  <span className="font-medium text-[#0c0a09] dark:text-[#f5f5f5]">
                    {document.page_count}
                  </span>
                </div>
                <div>
                  <span className="text-[#a8a29e] block">Indexed Chunks</span>
                  <span className="font-medium text-[#0c0a09] dark:text-[#f5f5f5]">
                    {document.indexed_count ?? document.chunk_count}
                  </span>
                </div>
                <div>
                  <span className="text-[#a8a29e] block">Status</span>
                  <span className="inline-flex items-center gap-1 font-medium text-[#16a34a] dark:text-[#22c55e]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{document.status}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[#a8a29e] border border-dashed border-[#e7e5e4] dark:border-[#27272a] rounded-2xl">
            No document ingested yet.
          </div>
        )}

        {/* SECTION 2: Retrieved Grounded Citations */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold font-sans-editorial text-[#777169] dark:text-[#a8a29e] uppercase tracking-wider">
              Grounded Sources ({sources.length})
            </span>
            {sources.length > 0 && (
              <span className="text-[10px] text-[#0c0a09] dark:text-white font-medium font-sans-editorial">Active Turn</span>
            )}
          </div>

          {sources.length > 2 && (
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-[#a8a29e] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter source passages..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-full border border-[#d6d3d1] dark:border-[#3f3f46] bg-white dark:bg-[#1c1917] text-[#0c0a09] dark:text-[#f5f5f5] focus:outline-none focus:border-[#0c0a09]"
              />
            </div>
          )}

          {sources.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#a8a29e] bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] rounded-2xl shadow-xs">
              <BookOpen className="w-5 h-5 mx-auto mb-2 text-[#a8a29e] opacity-50" />
              <p>No citations active.</p>
              <p className="text-[11px] mt-1 text-[#a8a29e]">
                Inquire in Text or Voice mode to retrieve cited excerpts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSources.map((src) => {
                const isHighlighted = highlightedCitationId === src.id;
                return (
                  <div
                    key={src.id}
                    className={`p-4 rounded-2xl border transition-all text-xs bg-white dark:bg-[#1c1917] shadow-xs ${
                      isHighlighted
                        ? 'border-[#0c0a09] dark:border-white ring-2 ring-[#0c0a09]/15'
                        : 'border-[#e7e5e4] dark:border-[#27272a] hover:border-[#a8a29e]'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e7e5e4] dark:border-[#27272a]">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-white font-mono text-[10px] font-semibold">
                          Page {src.page}
                        </span>
                        <span className="font-medium font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5] truncate max-w-[130px]">
                          {src.section || 'Excerpt'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#16a34a] dark:text-[#22c55e] font-mono font-medium">
                          {Math.round(src.relevance_score * 100)}% similarity
                        </span>
                        <button
                          onClick={() => copySnippet(src.snippet, src.id)}
                          className="p-1 rounded-full text-[#a8a29e] hover:text-[#0c0a09] dark:hover:text-white transition-colors"
                          title="Copy cited snippet"
                        >
                          {copiedSnippetId === src.id ? (
                            <Check className="w-3 h-3 text-[#16a34a]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-[#4e4e4e] dark:text-[#d6d3d1] leading-relaxed text-[11px] font-display-light italic">
                      "{src.snippet}"
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: RAG Architecture & Index Stats */}
        <div>
          <div className="text-[11px] font-semibold font-sans-editorial text-[#777169] dark:text-[#a8a29e] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#0c0a09] dark:text-[#f5f5f5]" />
            <span>Architecture & RAG Subsystem</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] space-y-2.5 text-[11px] font-sans-editorial shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#a8a29e]">Retrieval Provider</span>
              <span className="font-mono text-[#16a34a] dark:text-[#22c55e]">Internal RAG Subsystem</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#a8a29e]">Vector Database</span>
              <span className="font-mono text-[#0c0a09] dark:text-[#f5f5f5]">Qdrant</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#a8a29e]">Embedding Model</span>
              <span className="font-mono text-[#0c0a09] dark:text-[#f5f5f5]">
                {document?.embedding_model || 'jina-embeddings-v4'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#a8a29e]">Embedding Dimension</span>
              <span className="font-mono text-[#0c0a09] dark:text-[#f5f5f5]">
                {document?.embedding_dimension ? `${document.embedding_dimension}-dim Dense` : 'Dense Vector'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#a8a29e]">Similarity Metric</span>
              <span className="font-mono text-[#0c0a09] dark:text-[#f5f5f5]">Cosine Distance</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
