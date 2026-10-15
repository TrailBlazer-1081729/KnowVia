import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { DocumentMetadata, IngestionStage } from '../../types';

interface UploadDropZoneProps {
  onFileSelected: (file: File) => Promise<void>;
  onStartIngestion: () => Promise<void>;
  onReset: () => void;
  selectedFile: File | null;
  currentDocument: DocumentMetadata | null;
  isUploading: boolean;
  isIngesting: boolean;
  errorMessage: string | null;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const STAGE_LABELS: Record<IngestionStage, { label: string; detail: string }> = {
  uploaded: {
    label: 'Document Uploaded',
    detail: 'Validated PDF format and stored document locally',
  },
  extracting_text: {
    label: 'Extracting Structure',
    detail: 'Parsing raw page streams, metadata, and tables',
  },
  chunking: {
    label: 'Chunking Passages',
    detail: 'Partitioning document into semantic context windows',
  },
  generating_embeddings: {
    label: 'Computing Embeddings',
    detail: 'Projecting text passages into high-dimensional vector space',
  },
  building_index: {
    label: 'Building Retrieval Index',
    detail: 'Constructing vector search graph for instant retrieval',
  },
  completed: {
    label: 'Ingestion Complete',
    detail: 'Document is verified and ready for research queries',
  },
  failed: {
    label: 'Ingestion Failed',
    detail: 'An error occurred during vector indexing',
  },
};

export const UploadDropZone: React.FC<UploadDropZoneProps> = ({
  onFileSelected,
  onStartIngestion,
  onReset,
  selectedFile,
  currentDocument,
  isUploading,
  isIngesting,
  errorMessage,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await onFileSelected(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await onFileSelected(file);
    }
  };

  const triggerIngestionWithConfetti = async () => {
    await onStartIngestion();
  };

  React.useEffect(() => {
    if (currentDocument?.status === 'ready') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#cc785c', '#5db8a6', '#e8a55a'],
        });
      } catch {
        // Safe fallback
      }
    }
  }, [currentDocument?.status]);

  const currentStage = currentDocument?.stage || 'uploaded';
  const progressPercent = Math.round((currentDocument?.progress || 0) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 flex flex-col items-center">
      {/* Editorial Headline and Workflow Overview */}
      <div className="text-center max-w-2xl mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#efe9de] dark:bg-[#22201d] text-[#cc785c] text-xs font-semibold uppercase tracking-wider mb-4 border border-[#e6dfd8] dark:border-[#2d2a25]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Research & Conversation Intelligence</span>
        </div>

        <h1 className="font-serif-display text-4xl md:text-5xl font-normal text-[#141413] dark:text-[#faf9f5] leading-tight tracking-tight">
          Ground your research in verifiable evidence.
        </h1>

        <p className="mt-4 font-sans-body text-base text-[#6c6a64] dark:text-[#9e998f] leading-relaxed">
          Upload any academic paper, financial dossier, or technical manual. Ingest it into our high-precision RAG vector store, then query via scholarly text or realtime audio-to-audio voice.
        </p>
      </div>

      {/* Main Upload / State Container */}
      <div className="w-full max-w-2xl">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          id="pdf-upload-input"
        />

        {/* STATE 1: IDLE / NO FILE SELECTED */}
        {!selectedFile && !currentDocument && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-10 md:p-14 text-center transition-all duration-200 ${
              isDragOver
                ? 'border-[#cc785c] bg-[#efe9de]/50 dark:bg-[#22201d]/50 scale-[1.01]'
                : 'border-[#e6dfd8] dark:border-[#2d2a25] bg-[#faf9f5] dark:bg-[#181715] hover:border-[#cc785c]/60 hover:bg-[#efe9de]/30 dark:hover:bg-[#1f1e1b]'
            }`}
          >
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#efe9de] dark:bg-[#22201d] text-[#cc785c] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="font-serif-display text-2xl font-normal text-[#141413] dark:text-[#faf9f5]">
              Drop your PDF research paper here
            </h3>

            <p className="mt-2 text-sm text-[#6c6a64] dark:text-[#9e998f]">
              Drag and drop your file, or <span className="text-[#cc785c] font-medium underline underline-offset-2">browse files</span> from your computer
            </p>

            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[#8e8b82] dark:text-[#7a766e]">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> PDF documents only
              </span>
              <span>•</span>
              <span>Max file size: 50MB</span>
            </div>
          </div>
        )}

        {/* STATE 2: FILE SELECTED OR INGESTING */}
        {(selectedFile || currentDocument) && (
          <div className="bg-[#efe9de] dark:bg-[#1c1b18] border border-[#e6dfd8] dark:border-[#2d2a25] rounded-2xl p-6 md:p-8 shadow-sm">
            {/* File Overview Card */}
            <div className="flex items-start justify-between gap-4 pb-6 border-b border-[#e6dfd8] dark:border-[#2d2a25]">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#cc785c]/10 text-[#cc785c] flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-[#141413] dark:text-[#faf9f5] truncate">
                    {selectedFile?.name || currentDocument?.filename}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#6c6a64] dark:text-[#9e998f]">
                    <span>
                      {selectedFile ? formatBytes(selectedFile.size) : currentDocument ? formatBytes(currentDocument.size_bytes) : ''}
                    </span>
                    {currentDocument?.page_count ? (
                      <>
                        <span>•</span>
                        <span>{currentDocument.page_count} pages detected</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {!isIngesting && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#faf9f5] dark:bg-[#252320] border border-[#e6dfd8] dark:border-[#2d2a25] text-[#3d3d3a] dark:text-[#cfcbc2] hover:bg-[#efe9de] transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    onClick={onReset}
                    className="p-1.5 text-xs rounded-md text-[#6c6a64] hover:text-[#c64545] hover:bg-[#f5f0e8] dark:hover:bg-[#252320] transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mt-5 p-4 rounded-xl bg-[#c64545]/10 border border-[#c64545]/20 flex items-start gap-3 text-xs text-[#c64545]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Ingestion Issue</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
                <button
                  onClick={onStartIngestion}
                  className="px-2.5 py-1 rounded bg-[#c64545] text-white font-medium hover:bg-[#a53636] transition-colors shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Active Ingestion Progress Tracker */}
            {(isIngesting || currentDocument?.status === 'ingesting') && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-[#141413] dark:text-[#faf9f5] flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#cc785c] animate-spin" />
                    <span>{STAGE_LABELS[currentStage]?.label || 'Processing document...'}</span>
                  </span>
                  <span className="text-[#cc785c] font-mono font-semibold">{progressPercent}%</span>
                </div>

                <div className="w-full h-2 rounded-full bg-[#e6dfd8] dark:bg-[#2d2a25] overflow-hidden">
                  <div
                    className="h-full bg-[#cc785c] transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>

                <p className="text-xs text-[#6c6a64] dark:text-[#9e998f] italic">
                  {STAGE_LABELS[currentStage]?.detail}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                  <div className={`flex items-center gap-2 ${currentDocument?.progress && currentDocument.progress >= 0.25 ? 'text-[#5db872]' : 'text-[#8e8b82]'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>1. Text & Structure</span>
                  </div>
                  <div className={`flex items-center gap-2 ${currentDocument?.progress && currentDocument.progress >= 0.50 ? 'text-[#5db872]' : 'text-[#8e8b82]'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>2. Semantic Chunking</span>
                  </div>
                  <div className={`flex items-center gap-2 ${currentDocument?.progress && currentDocument.progress >= 0.75 ? 'text-[#5db872]' : 'text-[#8e8b82]'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>3. Dense Embeddings</span>
                  </div>
                  <div className={`flex items-center gap-2 ${currentDocument?.progress && currentDocument.progress >= 0.95 ? 'text-[#5db872]' : 'text-[#8e8b82]'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>4. Vector Index Ready</span>
                  </div>
                </div>
              </div>
            )}

            {/* Ingestion Ready State */}
            {currentDocument?.status === 'ready' && (
              <div className="mt-6 p-4 rounded-xl bg-[#5db872]/10 border border-[#5db872]/20 text-xs text-[#141413] dark:text-[#faf9f5]">
                <div className="flex items-center gap-2 font-semibold text-[#5db872] mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Document Genuinely Ingested & Verified</span>
                </div>
                <p className="text-[#6c6a64] dark:text-[#9e998f]">
                  Indexed into {currentDocument.chunk_count} contextual passages. Ready for inquiry via Text or Voice Conversation.
                </p>
              </div>
            )}

            {/* Bottom Ingestion Controls */}
            {currentDocument?.status !== 'ingesting' && currentDocument?.status !== 'ready' && (
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={onReset}
                  className="px-4 py-2.5 rounded-lg border border-[#e6dfd8] dark:border-[#2d2a25] bg-[#faf9f5] dark:bg-[#181715] text-xs font-medium text-[#3d3d3a] dark:text-[#cfcbc2] hover:bg-[#efe9de] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={triggerIngestionWithConfetti}
                  disabled={isUploading || isIngesting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] disabled:opacity-50 text-white font-medium text-xs shadow-sm transition-all active:scale-[0.98]"
                >
                  <span>Start RAG Ingestion</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trust & Architecture Footnotes */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        <div className="p-4 rounded-xl bg-[#efe9de]/50 dark:bg-[#1c1b18]/50 border border-[#e6dfd8] dark:border-[#2d2a25] text-center">
          <ShieldCheck className="w-5 h-5 mx-auto text-[#5db8a6] mb-2" />
          <h4 className="text-xs font-semibold text-[#141413] dark:text-[#faf9f5]">Verifiable Citations</h4>
          <p className="text-[11px] text-[#6c6a64] dark:text-[#9e998f] mt-1">Every answer quotes exact page and section coordinates.</p>
        </div>
        <div className="p-4 rounded-xl bg-[#efe9de]/50 dark:bg-[#1c1b18]/50 border border-[#e6dfd8] dark:border-[#2d2a25] text-center">
          <Layers className="w-5 h-5 mx-auto text-[#cc785c] mb-2" />
          <h4 className="text-xs font-semibold text-[#141413] dark:text-[#faf9f5]">Future MCP Ready</h4>
          <p className="text-[11px] text-[#6c6a64] dark:text-[#9e998f] mt-1">Ingestion and Query MCP adapters are plug-and-play.</p>
        </div>
        <div className="p-4 rounded-xl bg-[#efe9de]/50 dark:bg-[#1c1b18]/50 border border-[#e6dfd8] dark:border-[#2d2a25] text-center">
          <Sparkles className="w-5 h-5 mx-auto text-[#e8a55a] mb-2" />
          <h4 className="text-xs font-semibold text-[#141413] dark:text-[#faf9f5]">Audio-to-Audio Voice</h4>
          <p className="text-[11px] text-[#6c6a64] dark:text-[#9e998f] mt-1">Realtime conversation with authentic frequency visualization.</p>
        </div>
      </div>
    </div>
  );
};
