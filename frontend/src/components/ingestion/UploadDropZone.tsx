import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  X,
  Volume2,
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
          particleCount: 40,
          spread: 55,
          origin: { y: 0.7 },
          colors: ['#292524', '#a7e5d3', '#f4c5a8', '#c8b8e0'],
        });
      } catch {
        // Safe fallback
      }
    }
  }, [currentDocument?.status]);

  const currentStage = currentDocument?.stage || 'uploaded';
  const progressPercent = Math.round((currentDocument?.progress || 0) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16 flex flex-col items-center relative">
      {/* ElevenLabs Atmospheric Gradient Orb Bloom behind headline */}
      <div className="absolute top-4 w-96 h-96 rounded-full gradient-orb-mint-peach pointer-events-none blur-2xl opacity-70 -z-10" />

      {/* Editorial Headline and Workflow Overview */}
      <div className="text-center max-w-2xl mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-[#f5f5f5] text-[11px] font-sans-editorial font-semibold uppercase tracking-wider mb-5 border border-[#e7e5e4] dark:border-[#27272a]">
          <Volume2 className="w-3.5 h-3.5" />
          <span>ElevenLabs Document Intelligence</span>
        </div>

        {/* Waldenburg Light weight 300 editorial display headline */}
        <h1 className="font-display-light text-4xl sm:text-5xl md:text-6xl text-[#0c0a09] dark:text-[#f5f5f5] leading-[1.08] tracking-tight">
          Ground your research in verifiable evidence.
        </h1>

        <p className="mt-5 font-sans-editorial text-base text-[#4e4e4e] dark:text-[#a8a29e] leading-relaxed max-w-xl mx-auto">
          Upload any paper, whitepaper, or transcript. Ingest it into our dense vector retrieval pipeline, then inquire through scholarly text or realtime audio-to-audio voice.
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
            className={`relative group cursor-pointer border border-dashed rounded-3xl p-10 md:p-14 text-center transition-all duration-200 bg-white dark:bg-[#1c1917] shadow-xs ${
              isDragOver
                ? 'border-[#0c0a09] dark:border-white scale-[1.01]'
                : 'border-[#d6d3d1] dark:border-[#3f3f46] hover:border-[#0c0a09] dark:hover:border-white'
            }`}
          >
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-[#f5f5f5] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>

            <h3 className="font-display-light text-2xl md:text-3xl text-[#0c0a09] dark:text-[#f5f5f5]">
              Drop your PDF research paper here
            </h3>

            <p className="mt-2 text-sm font-sans-editorial text-[#777169] dark:text-[#a8a29e]">
              Drag and drop your file, or <span className="text-[#0c0a09] dark:text-white font-medium underline underline-offset-4">browse files</span> from your computer
            </p>

            <div className="mt-6 flex items-center justify-center gap-6 text-xs font-sans-editorial text-[#a8a29e]">
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
          <div className="bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] rounded-3xl p-6 md:p-8 shadow-xs">
            {/* File Overview Card */}
            <div className="flex items-start justify-between gap-4 pb-6 border-b border-[#e7e5e4] dark:border-[#27272a]">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-[#f5f5f5] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-medium font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5] truncate">
                    {selectedFile?.name || currentDocument?.filename}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#777169] dark:text-[#a8a29e]">
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
                    className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-[#f5f5f5] hover:bg-[#e7e5e4] transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    onClick={onReset}
                    className="p-1.5 text-xs rounded-full text-[#777169] hover:text-[#dc2626] hover:bg-[#f0efed] dark:hover:bg-[#292524] transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mt-5 p-4 rounded-2xl bg-[#dc2626]/10 border border-[#dc2626]/20 flex items-start gap-3 text-xs text-[#dc2626]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Ingestion Issue</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
                <button
                  onClick={onStartIngestion}
                  className="px-3 py-1 rounded-full bg-[#dc2626] text-white font-medium hover:bg-[#b91c1c] transition-colors shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Active Ingestion Progress Tracker */}
            {(isIngesting || currentDocument?.status === 'ingesting') && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-medium font-sans-editorial">
                  <span className="text-[#0c0a09] dark:text-[#f5f5f5] flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#292524] dark:text-[#f5f5f5] animate-spin" />
                    <span>{STAGE_LABELS[currentStage]?.label || 'Processing document...'}</span>
                  </span>
                  <span className="text-[#0c0a09] dark:text-white font-mono font-semibold">{progressPercent}%</span>
                </div>

                {/* Minimalist Ink Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-[#f0efed] dark:bg-[#27272a] overflow-hidden">
                  <div
                    className="h-full bg-[#292524] dark:bg-[#f5f5f5] transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>

                <p className="text-xs text-[#777169] dark:text-[#a8a29e] font-sans-editorial">
                  {STAGE_LABELS[currentStage]?.detail}
                </p>

                {/* Sub-stage checklist */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-sans-editorial">
                  <div className={`flex items-center gap-2 ${currentDocument?.progress && currentDocument.progress >= 0.25 ? 'text-[#16a34a] dark:text-[#22c55e]' : 'text-[#a8a29e]'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>1. Text & Structure</span>
                  </div>
                  <div className={`flex items-center gap-2 ${currentDocument?.progress && currentDocument.progress >= 0.50 ? 'text-[#16a34a] dark:text-[#22c55e]' : 'text-[#a8a29e]'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>2. Semantic Chunking</span>
                  </div>
                  <div className={`flex items-center gap-2 ${currentDocument?.progress && currentDocument.progress >= 0.75 ? 'text-[#16a34a] dark:text-[#22c55e]' : 'text-[#a8a29e]'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>3. Dense Embeddings</span>
                  </div>
                  <div className={`flex items-center gap-2 ${currentDocument?.progress && currentDocument.progress >= 0.95 ? 'text-[#16a34a] dark:text-[#22c55e]' : 'text-[#a8a29e]'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>4. Vector Index Ready</span>
                  </div>
                </div>
              </div>
            )}

            {/* Ingestion Ready State */}
            {currentDocument?.status === 'ready' && (
              <div className="mt-6 p-4 rounded-2xl bg-[#16a34a]/10 border border-[#16a34a]/20 text-xs text-[#0c0a09] dark:text-[#f5f5f5]">
                <div className="flex items-center gap-2 font-semibold text-[#16a34a] dark:text-[#22c55e] mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Document Verified & Ingested</span>
                </div>
                <p className="text-[#4e4e4e] dark:text-[#a8a29e]">
                  Indexed into {currentDocument.chunk_count} contextual passages. Ready for inquiry via Text or Voice Conversation.
                </p>
              </div>
            )}

            {/* Bottom Ingestion Controls: ElevenLabs Ink Pill */}
            {currentDocument?.status !== 'ingesting' && currentDocument?.status !== 'ready' && (
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={onReset}
                  className="px-4 py-2 rounded-full border border-[#d6d3d1] dark:border-[#3f3f46] text-xs font-medium text-[#4e4e4e] dark:text-[#d6d3d1] hover:bg-[#f0efed] dark:hover:bg-[#292524] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={triggerIngestionWithConfetti}
                  disabled={isUploading || isIngesting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#292524] hover:bg-[#0c0a09] dark:bg-[#f5f5f5] dark:text-[#0c0a09] dark:hover:bg-white text-white font-medium text-xs shadow-xs transition-all active:scale-[0.98]"
                >
                  <span>Start RAG Ingestion</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Atmospheric Feature Cards Grid */}
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl w-full">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] shadow-xs text-center">
          <div className="w-8 h-8 rounded-full bg-[#f0efed] dark:bg-[#292524] mx-auto flex items-center justify-center text-[#292524] dark:text-[#f5f5f5] mb-3">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-semibold font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5]">Verifiable Citations</h4>
          <p className="text-[11px] text-[#777169] dark:text-[#a8a29e] mt-1 font-sans-editorial">Every answer quotes exact page and section coordinates.</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] shadow-xs text-center">
          <div className="w-8 h-8 rounded-full bg-[#f0efed] dark:bg-[#292524] mx-auto flex items-center justify-center text-[#292524] dark:text-[#f5f5f5] mb-3">
            <Layers className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-semibold font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5]">Future MCP Ready</h4>
          <p className="text-[11px] text-[#777169] dark:text-[#a8a29e] mt-1 font-sans-editorial">Ingestion and Query MCP adapters are plug-and-play.</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] shadow-xs text-center">
          <div className="w-8 h-8 rounded-full bg-[#f0efed] dark:bg-[#292524] mx-auto flex items-center justify-center text-[#292524] dark:text-[#f5f5f5] mb-3">
            <Volume2 className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-semibold font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5]">Audio-to-Audio Voice</h4>
          <p className="text-[11px] text-[#777169] dark:text-[#a8a29e] mt-1 font-sans-editorial">Realtime conversation with authentic frequency visualization.</p>
        </div>
      </div>
    </div>
  );
};
