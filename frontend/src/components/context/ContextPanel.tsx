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
    <aside className="w-80 lg:w-96 border-l border-[#e6dfd8] dark:border-[#2d2a25] bg-[#faf9f5] dark:bg-[#121211] flex flex-col h-full overflow-hidden shrink-0 z-30 transition-all">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#e6dfd8] dark:border-[#2d2a25] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#cc785c]" />
          <h3 className="font-serif-display text-base font-medium text-[#141413] dark:text-[#faf9f5]">
            Document Intelligence
          </h3>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-[#6c6a64] dark:text-[#9e998f] hover:text-[#141413] dark:hover:text-[#faf9f5] hover:bg-[#efe9de] dark:hover:bg-[#22201d] transition-colors"
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
            <div className="text-[11px] font-semibold text-[#6c6a64] dark:text-[#9e998f] uppercase tracking-wider mb-2">
              Ingested Document
            </div>

            <div className="p-3.5 rounded-xl bg-[#efe9de] dark:bg-[#1c1b18] border border-[#e6dfd8] dark:border-[#2d2a25] space-y-2.5">
              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-[#cc785c] shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-[#141413] dark:text-[#faf9f5] break-words">
                  {document.filename}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e6dfd8] dark:border-[#2d2a25] text-[11px]">
                <div>
                  <span className="text-[#8e8b82] dark:text-[#7a766e] block">Size</span>
                  <span className="font-medium text-[#141413] dark:text-[#faf9f5]">
                    {formatBytes(document.size_bytes)}
                  </span>
                </div>
                <div>
                  <span className="text-[#8e8b82] dark:text-[#7a766e] block">Pages</span>
                  <span className="font-medium text-[#141413] dark:text-[#faf9f5]">
                    {document.page_count}
                  </span>
                </div>
                <div>
                  <span className="text-[#8e8b82] dark:text-[#7a766e] block">Indexed Chunks</span>
                  <span className="font-medium text-[#141413] dark:text-[#faf9f5]">
                    {document.chunk_count || document.page_count * 4}
                  </span>
                </div>
                <div>
                  <span className="text-[#8e8b82] dark:text-[#7a766e] block">Status</span>
                  <span className="inline-flex items-center gap-1 font-medium text-[#5db872]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{document.status}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[#8e8b82] dark:text-[#7a766e] border border-dashed border-[#e6dfd8] dark:border-[#2d2a25] rounded-xl">
            No document ingested yet.
          </div>
        )}

        {/* SECTION 2: Retrieved Grounded Citations */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#6c6a64] dark:text-[#9e998f] uppercase tracking-wider">
              Grounded Sources ({sources.length})
            </span>
            {sources.length > 0 && (
              <span className="text-[10px] text-[#cc785c] font-medium">Active Turn</span>
            )}
          </div>

          {sources.length > 2 && (
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-[#8e8b82] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter source passages..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#e6dfd8] dark:border-[#2d2a25] bg-[#efe9de]/50 dark:bg-[#1c1b18] text-[#141413] dark:text-[#faf9f5] focus:outline-none focus:border-[#cc785c]"
              />
            </div>
          )}

          {sources.length === 0 ? (
            <div className="p-5 text-center text-xs text-[#8e8b82] dark:text-[#7a766e] bg-[#efe9de]/40 dark:bg-[#1c1b18]/40 border border-[#e6dfd8] dark:border-[#2d2a25] rounded-xl">
              <BookOpen className="w-5 h-5 mx-auto mb-2 text-[#8e8b82] opacity-60" />
              <p>No citations active.</p>
              <p className="text-[11px] mt-1 text-[#8e8b82]">
                Ask a question in Text or Voice mode to retrieve cited excerpts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSources.map((src) => {
                const isHighlighted = highlightedCitationId === src.id;
                return (
                  <div
                    key={src.id}
                    className={`p-3.5 rounded-xl border transition-all text-xs ${
                      isHighlighted
                        ? 'border-[#cc785c] bg-[#efe9de] dark:bg-[#22201d] ring-2 ring-[#cc785c]/20'
                        : 'border-[#e6dfd8] dark:border-[#2d2a25] bg-[#efe9de]/60 dark:bg-[#1c1b18] hover:border-[#cc785c]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e6dfd8] dark:border-[#2d2a25]">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-[#cc785c] text-white font-mono text-[10px] font-semibold">
                          Page {src.page}
                        </span>
                        <span className="font-medium text-[#141413] dark:text-[#faf9f5] truncate max-w-[130px]">
                          {src.section || 'Excerpt'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#5db872] font-mono font-medium">
                          {Math.round(src.relevance_score * 100)}% match
                        </span>
                        <button
                          onClick={() => copySnippet(src.snippet, src.id)}
                          className="p-1 rounded text-[#8e8b82] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors"
                          title="Copy cited snippet"
                        >
                          {copiedSnippetId === src.id ? (
                            <Check className="w-3 h-3 text-[#5db872]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-[#3d3d3a] dark:text-[#cfcbc2] leading-relaxed text-[11px] font-serif-display italic">
                      "{src.snippet}"
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: MCP Architecture & Index Stats */}
        <div>
          <div className="text-[11px] font-semibold text-[#6c6a64] dark:text-[#9e998f] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#5db8a6]" />
            <span>Architecture & Tool Calling</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#efe9de] dark:bg-[#1c1b18] border border-[#e6dfd8] dark:border-[#2d2a25] space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#8e8b82] dark:text-[#7a766e]">Ingestion MCP</span>
              <span className="font-mono text-[#5db872]">Ready (Registered)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8e8b82] dark:text-[#7a766e]">Query MCP</span>
              <span className="font-mono text-[#5db872]">Ready (Registered)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8e8b82] dark:text-[#7a766e]">Embedding Vector</span>
              <span className="font-mono text-[#141413] dark:text-[#faf9f5]">768-dim Dense</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8e8b82] dark:text-[#7a766e]">Similarity Metric</span>
              <span className="font-mono text-[#141413] dark:text-[#faf9f5]">Cosine Distance</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
