import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  BookOpen,
  ArrowLeft,
  AlertCircle,
  Radio,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  VoiceState,
  SourceCitation,
  DocumentMetadata,
  ToolInvocation,
  VoiceTurn,
} from '../../types';
import { RealtimeVoiceService } from '../../services/voice';
import { isMockMode } from '../../services/api';
import { AudioWaveform } from './AudioWaveform';

interface VoiceConversationProps {
  document: DocumentMetadata;
  sessionId: string;
  onSwitchToText: () => void;
  onCitationClick?: (citation: SourceCitation) => void;
  onSourcesChange?: (sources: SourceCitation[]) => void;
}

/**
 * Format MCP server name into a readable, prominent title (e.g. 'web_search' -> 'Web Search')
 */
function formatServerName(server: string): string {
  if (!server) return 'MCP';
  return server
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Concise human-readable action description derived from tool name and arguments.
 * (e.g., 'Searching the web for "machines"', 'Adding 250 and 175', etc.)
 */
function formatToolAction(
  server: string,
  name: string,
  args: Record<string, unknown> = {}
): string {
  const sLower = (server || '').toLowerCase();
  const nLower = (name || '').toLowerCase();

  // Web search
  if (nLower.includes('search') || sLower.includes('search')) {
    const q = args.query || args.q || args.search_query || args.prompt;
    if (q) {
      const qStr = String(q).trim();
      return `Searching the web for "${
        qStr.length > 45 ? qStr.slice(0, 42) + '...' : qStr
      }"`;
    }
    return 'Searching the web for external information';
  }

  // Arithmetic: testing1 on 'add' or 'add'
  if (sLower === 'add' || nLower === 'add' || nLower === 'testing1') {
    if (args.a !== undefined && args.b !== undefined) {
      return `Adding ${args.a} and ${args.b}`;
    }
    return 'Calculating arithmetic sum';
  }

  // Arithmetic: testing2 on 'multiply' or 'multiply'
  if (sLower === 'multiply' || nLower === 'multiply' || nLower === 'testing2') {
    if (args.a !== undefined && args.b !== undefined) {
      return `Multiplying ${args.a} by ${args.b}`;
    }
    return 'Calculating multiplication product';
  }

  // Document retrieval / RAG
  if (
    nLower.includes('retrieve') ||
    nLower.includes('document') ||
    nLower.includes('rag')
  ) {
    const q = args.query || args.text || args.prompt;
    if (q) {
      const qStr = String(q).trim();
      return `Searching document excerpts for "${
        qStr.length > 45 ? qStr.slice(0, 42) + '...' : qStr
      }"`;
    }
    return 'Searching document excerpts';
  }

  // Fallback with concise parameter keys/values
  const entries = Object.entries(args);
  if (entries.length === 0) {
    return `Executing ${name}`;
  }
  const summary = entries
    .slice(0, 2)
    .map(
      ([k, v]) =>
        `${k}: ${typeof v === 'string' ? `"${v.slice(0, 25)}"` : String(v)}`
    )
    .join(', ');
  return `Executing ${name} with ${summary}`;
}

export const VoiceConversation: React.FC<VoiceConversationProps> = ({
  document,
  sessionId,
  onSwitchToText,
  onCitationClick,
  onSourcesChange,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const audioLevelRef = useRef<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real-time Tool Invocations
  const [toolInvocations, setToolInvocations] = useState<ToolInvocation[]>([]);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {}
  );

  // Conversation History & Live Spoken Text
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [currentTurn, setCurrentTurn] = useState<VoiceTurn | null>(null);
  const currentTurnRef = useRef<VoiceTurn | null>(null);

  const voiceServiceRef = useRef<RealtimeVoiceService | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const onSourcesChangeRef = useRef(onSourcesChange);

  useEffect(() => {
    onSourcesChangeRef.current = onSourcesChange;
  }, [onSourcesChange]);

  // Auto-scroll conversation history to bottom as new speech streams
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [turns, currentTurn?.assistantText, currentTurn?.userText]);

  useEffect(() => {
    const service = new RealtimeVoiceService(document.id, sessionId, {
      onStateChange: (state) => setVoiceState(state),
      onAudioLevel: (lvl) => {
        audioLevelRef.current = lvl;
      },

      onInputTranscription: (text) => {
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        // If the active turn already received an assistant response and the user begins speaking again,
        // commit the previous turn first to prevent losing or merging conversational turns.
        if (currentTurnRef.current && currentTurnRef.current.assistantText.trim().length > 0) {
          const finished: VoiceTurn = { ...currentTurnRef.current, isStreaming: false };
          setTurns((history) => {
            if (history.some((t) => t.id === finished.id)) return history;
            return [...history, finished];
          });
          currentTurnRef.current = null;
        }

        if (currentTurnRef.current) {
          // Streaming partial/incremental user speech within the same active turn
          currentTurnRef.current.userText = text;
          setCurrentTurn({ ...currentTurnRef.current });
        } else {
          // New conversational turn
          const newTurn: VoiceTurn = {
            id: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            userText: text,
            assistantText: '',
            isStreaming: true,
            documentName: document.filename,
            timestamp: timeStr,
          };
          currentTurnRef.current = newTurn;
          setCurrentTurn(newTurn);
        }
      },

      onOutputTranscription: (text) => {
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        if (!currentTurnRef.current) {
          const newTurn: VoiceTurn = {
            id: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            userText: '',
            assistantText: text,
            isStreaming: true,
            documentName: document.filename,
            timestamp: timeStr,
          };
          currentTurnRef.current = newTurn;
          setCurrentTurn(newTurn);
          return;
        }

        // Incremental text streaming from Gemini Live
        const prevText = currentTurnRef.current.assistantText;
        let combinedText: string;
        if (!prevText) {
          combinedText = text;
        } else if (text.startsWith(prevText)) {
          combinedText = text;
        } else {
          const separator =
            prevText.endsWith(' ') || text.startsWith(' ') ? '' : ' ';
          combinedText = prevText + separator + text;
        }

        currentTurnRef.current.assistantText = combinedText;
        setCurrentTurn({ ...currentTurnRef.current });
      },

      onSources: (sources, docName) => {
        if (currentTurnRef.current) {
          currentTurnRef.current.citations = sources;
          if (docName) {
            currentTurnRef.current.documentName = docName;
          }
          setCurrentTurn({ ...currentTurnRef.current });
        }
        onSourcesChangeRef.current?.(sources);
      },

      onToolCall: (invocation) => {
        setToolInvocations((prev) => {
          const existing = prev.find((t) => t.id === invocation.id);
          if (existing) {
            return prev.map((t) =>
              t.id === invocation.id ? { ...t, ...invocation } : t
            );
          }
          return [invocation, ...prev];
        });
      },

      onToolResult: (invocation) => {
        setToolInvocations((prev) =>
          prev.map((t) => {
            if (t.id === invocation.id) {
              const duration = t.startTime
                ? `${((Date.now() - t.startTime) / 1000).toFixed(1)}s`
                : undefined;
              return {
                ...t,
                status: invocation.status,
                result: invocation.result,
                error: invocation.error,
                duration: duration || t.duration,
              };
            }
            return t;
          })
        );
      },

      onTurnComplete: () => {
        const active = currentTurnRef.current;
        if (!active) return;

        // Synchronously clear the active turn reference to guarantee idempotency
        // against rapid/duplicate socket messages or React effect cycles
        currentTurnRef.current = null;
        setCurrentTurn(null);

        // Only commit turns that contain actual user or assistant content
        if (!active.userText?.trim() && !active.assistantText?.trim()) {
          return;
        }

        const completedTurn: VoiceTurn = { ...active, isStreaming: false };
        setTurns((history) => {
          // Idempotent: prevent duplicate turns with the same ID
          if (history.some((t) => t.id === completedTurn.id)) {
            return history;
          }
          return [...history, completedTurn];
        });
      },

      onInterrupted: () => {
        onSourcesChangeRef.current?.([]);
        const active = currentTurnRef.current;
        if (!active) {
          setVoiceState('listening');
          return;
        }

        // Synchronously clear the active turn reference
        currentTurnRef.current = null;
        setCurrentTurn(null);

        const hasText =
          active.assistantText && active.assistantText.trim().length > 0;
        const interruptedTurn: VoiceTurn = {
          ...active,
          isStreaming: false,
          assistantText: hasText
            ? active.assistantText.includes('[Interrupted]')
              ? active.assistantText
              : `${active.assistantText} [Interrupted]`
            : '[Response interrupted]',
        };

        setTurns((history) => {
          // Idempotent: prevent duplicate turns with the same ID
          if (history.some((t) => t.id === interruptedTurn.id)) {
            return history;
          }
          return [...history, interruptedTurn];
        });
        setVoiceState('listening');
      },

      onError: (err) => setErrorMessage(err),
    });

    voiceServiceRef.current = service;

    return () => {
      service.stop();
      voiceServiceRef.current = null;
      currentTurnRef.current = null;
    };
  }, [document.id, document.filename, sessionId]);

  const handleStartSession = async () => {
    setErrorMessage(null);
    if (voiceServiceRef.current) {
      await voiceServiceRef.current.start();
    }
  };

  const handleStopSession = () => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.stop();
    }
    setVoiceState('idle');
    audioLevelRef.current = 0;
  };

  const handleToggleMute = () => {
    if (voiceServiceRef.current) {
      const muted = voiceServiceRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const handleFinishTurn = () => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.finishTurn();
    }
  };

  const handleInterrupt = () => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.interrupt();
    }
    setVoiceState('listening');
  };

  const toggleToolExpanded = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const numBars = 28;
  const isSessionActive =
    voiceState === 'connected' ||
    voiceState === 'listening' ||
    voiceState === 'processing' ||
    voiceState === 'speaking' ||
    voiceState === 'interrupted' ||
    voiceState === 'executing_tool';

  const canInterrupt =
    isSessionActive &&
    (voiceState === 'speaking' ||
      voiceState === 'processing' ||
      voiceState === 'executing_tool' ||
      (currentTurn !== null && currentTurn.isStreaming));

  // Keyboard shortcut: Escape or 'i' to trigger instant barge-in interrupt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if ((e.key === 'Escape' || e.key === 'i' || e.key === 'I') && canInterrupt) {
        e.preventDefault();
        handleInterrupt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canInterrupt]);

  // Active running tool for header pill
  const runningTool = toolInvocations.find((t) => t.status === 'running');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f5f5f5] dark:bg-[#0c0a09] p-3 md:p-5">
      {/* 1. Header Bar */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-[#e7e5e4] dark:border-[#27272a] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onSwitchToText}
            className="inline-flex items-center gap-2 text-xs font-medium font-sans-editorial text-[#777169] dark:text-[#a8a29e] hover:text-[#0c0a09] dark:hover:text-[#f5f5f5] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Text Conversation</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Grounded Document Badge */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] text-xs text-[#777169] dark:text-[#a8a29e] shadow-xs">
            <Radio className="w-3 h-3 text-[#0c0a09] dark:text-white" />
            <span>
              Grounded on:{' '}
              <strong className="text-[#0c0a09] dark:text-[#f5f5f5]">
                {document.filename}
              </strong>
            </span>
          </div>

          {isMockMode() && (
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-semibold bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-[#f5f5f5] border border-[#e7e5e4] dark:border-[#27272a]">
              <span>Dev Mock Audio Mode</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 mt-3 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Voice Controls & Simplified MCP Invocations (4 cols on xl, 5 cols on lg) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3.5 min-h-0 h-full overflow-hidden">
          {/* A. Live Audio Waveform & Status Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] shadow-xs flex flex-col items-center justify-center relative shrink-0">
            {/* Live Status Badge */}
            <div className="mb-3.5">
              <span
                className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium font-sans-editorial transition-all ${
                  voiceState === 'listening'
                    ? 'bg-[#16a34a]/10 text-[#16a34a] dark:text-[#22c55e]'
                    : voiceState === 'processing'
                    ? 'bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-white animate-pulse'
                    : voiceState === 'executing_tool'
                    ? 'bg-[#7c3aed]/10 text-[#7c3aed] dark:text-[#a78bfa] animate-pulse'
                    : voiceState === 'speaking'
                    ? 'bg-[#0c0a09] dark:bg-white text-white dark:text-[#0c0a09] animate-pulse shadow-xs'
                    : voiceState === 'interrupted'
                    ? 'bg-[#f59e0b]/10 text-[#d97706] dark:text-[#fbbf24]'
                    : voiceState === 'error'
                    ? 'bg-[#dc2626]/10 text-[#dc2626]'
                    : 'bg-[#f0efed] dark:bg-[#292524] text-[#777169] dark:text-[#a8a29e]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    voiceState === 'listening'
                      ? 'bg-[#16a34a] animate-ping'
                      : voiceState === 'processing'
                      ? 'bg-[#0c0a09] dark:bg-white animate-bounce'
                      : voiceState === 'executing_tool'
                      ? 'bg-[#7c3aed] animate-ping'
                      : voiceState === 'speaking'
                      ? 'bg-white dark:bg-[#0c0a09] animate-pulse'
                      : voiceState === 'interrupted'
                      ? 'bg-[#f59e0b]'
                      : 'bg-[#a8a29e]'
                  }`}
                />
                <span className="capitalize font-medium">
                  {voiceState === 'listening'
                    ? 'Listening to researcher...'
                    : voiceState === 'processing'
                    ? 'Reasoning & Grounding...'
                    : voiceState === 'executing_tool'
                    ? runningTool
                      ? `Calling MCP [${runningTool.server}:${runningTool.name}]...`
                      : 'Executing MCP Tool...'
                    : voiceState === 'speaking'
                    ? 'KnowVia Live Speaking...'
                    : voiceState === 'interrupted'
                    ? 'Response Interrupted'
                    : voiceState === 'requesting_permission'
                    ? 'Requesting Microphone...'
                    : voiceState === 'connecting'
                    ? 'Connecting Audio Bridge...'
                    : voiceState === 'error'
                    ? 'Connection Error'
                    : 'Ready to Connect'}
                </span>
              </span>
            </div>

            {/* Zero Re-render Real-time Waveform Visualization */}
            <AudioWaveform
              levelRef={audioLevelRef}
              voiceState={voiceState}
              isActive={isSessionActive}
              numBars={numBars}
            />

            {/* Error Notification */}
            {errorMessage && (
              <div className="w-full mt-3 p-2.5 rounded-xl bg-[#dc2626]/10 border border-[#dc2626]/20 flex items-center gap-2 text-xs text-[#dc2626]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="flex-1 font-sans-editorial">{errorMessage}</p>
              </div>
            )}

            {/* Voice Control Dock */}
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              {!isSessionActive ? (
                <button
                  onClick={handleStartSession}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0c0a09] hover:bg-[#292524] dark:bg-[#f5f5f5] dark:text-[#0c0a09] dark:hover:bg-white text-white font-medium text-xs shadow-xs transition-all active:scale-95"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Voice Conversation</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleToggleMute}
                    className={`p-2.5 rounded-full border transition-all ${
                      isMuted
                        ? 'bg-[#dc2626] border-[#dc2626] text-white'
                        : 'bg-white dark:bg-[#1c1917] border-[#e7e5e4] dark:border-[#27272a] text-[#0c0a09] dark:text-[#f5f5f5] hover:bg-[#f0efed]'
                    }`}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  {/* Persistent & Responsive Interrupt Barge-In Button */}
                  <button
                    onClick={handleInterrupt}
                    disabled={!canInterrupt}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium font-sans-editorial transition-all shadow-xs ${
                      canInterrupt
                        ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white cursor-pointer active:scale-95 shadow-sm ring-2 ring-red-400/20'
                        : 'bg-[#f0efed] dark:bg-[#292524] text-[#a8a29e] dark:text-[#78716c] opacity-40 cursor-not-allowed border border-[#e7e5e4] dark:border-[#27272a]'
                    }`}
                    title={
                      canInterrupt
                        ? 'Interrupt assistant speech or reasoning instantly (barge-in)'
                        : 'Assistant is not speaking'
                    }
                    aria-label="Interrupt assistant speech"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Interrupt</span>
                  </button>

                  <button
                    onClick={handleFinishTurn}
                    className="px-3.5 py-2 rounded-full bg-white dark:bg-[#1c1917] border border-[#d6d3d1] dark:border-[#3f3f46] text-xs font-medium font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5] hover:bg-[#f0efed] dark:hover:bg-[#292524] transition-colors"
                  >
                    Finish My Turn
                  </button>

                  <button
                    onClick={handleStopSession}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0c0a09] hover:bg-[#dc2626] text-white text-xs font-medium shadow-xs transition-colors"
                    title="Disconnect voice session"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>End Voice</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* B. Simplified & Polished MCP Tool Invocations Section */}
          <div className="flex-1 flex flex-col min-h-0 rounded-2xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e7e5e4] dark:border-[#27272a] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-[#7c3aed] dark:text-[#a78bfa]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0c0a09] dark:text-[#f5f5f5] font-sans-editorial">
                  MCP Tool Invocations
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#777169] dark:text-[#a8a29e] font-mono">
                  {toolInvocations.length}{' '}
                  {toolInvocations.length === 1 ? 'call' : 'calls'}
                </span>
                {toolInvocations.length > 0 && (
                  <button
                    onClick={() => setToolInvocations([])}
                    className="text-[10px] text-[#78716c] hover:text-[#0c0a09] dark:text-[#a8a29e] dark:hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {toolInvocations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[#777169] dark:text-[#a8a29e] text-xs font-sans-editorial space-y-1">
                  <Wrench className="w-5 h-5 stroke-1 text-[#a8a29e] dark:text-[#57534e] opacity-60 mb-0.5" />
                  <p className="font-medium text-[#0c0a09] dark:text-[#f5f5f5]">
                    No MCP tools invoked yet
                  </p>
                  <p className="text-[11px] text-[#78716c] dark:text-[#a8a29e] max-w-xs">
                    Calculations (e.g. "add 140 and 360") or external queries
                    trigger connected MCP tools in real time.
                  </p>
                </div>
              ) : (
                toolInvocations.map((tool) => {
                  const isExpanded = expandedTools[tool.id] ?? false;
                  const serverLabel = formatServerName(tool.server);
                  const actionDescription = formatToolAction(
                    tool.server,
                    tool.name,
                    tool.arguments
                  );

                  return (
                    <div
                      key={tool.id}
                      className="p-2.5 rounded-xl border border-[#e7e5e4] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#141210] transition-colors"
                    >
                      {/* Prominent Header & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-xs text-[#0c0a09] dark:text-[#f5f5f5] truncate">
                            {serverLabel} ·{' '}
                            <code className="font-mono text-[11px] text-[#7c3aed] dark:text-[#a78bfa]">
                              {tool.name}
                            </code>
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {tool.status === 'running' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#7c3aed]/10 text-[#7c3aed] dark:text-[#a78bfa] border border-[#7c3aed]/20">
                              <Clock className="w-2.5 h-2.5 animate-spin" />
                              <span>Running</span>
                            </span>
                          )}
                          {tool.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#16a34a]/10 text-[#16a34a] dark:text-[#22c55e] border border-[#16a34a]/20">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>
                                Completed
                                {tool.duration ? ` · ${tool.duration}` : ''}
                              </span>
                            </span>
                          )}
                          {tool.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#dc2626]/10 text-[#dc2626] dark:text-[#f87171] border border-[#dc2626]/20">
                              <XCircle className="w-2.5 h-2.5" />
                              <span>Failed</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Human-readable action description */}
                      <p className="text-[11px] text-[#57534e] dark:text-[#a8a29e] mt-1 font-sans-editorial leading-snug">
                        {actionDescription}
                      </p>

                      {/* Compact Details toggle */}
                      <div className="mt-1.5 pt-1.5 border-t border-[#e7e5e4]/60 dark:border-[#27272a]/60 flex items-center justify-between text-[10px]">
                        <button
                          onClick={() => toggleToolExpanded(tool.id)}
                          className="text-[#78716c] dark:text-[#71717a] hover:text-[#0c0a09] dark:hover:text-[#f5f5f5] inline-flex items-center gap-1 transition-colors"
                        >
                          <span>
                            {isExpanded
                              ? 'Hide technical details'
                              : 'Technical details'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-2.5 h-2.5" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5" />
                          )}
                        </button>
                        <span className="text-[#a8a29e] dark:text-[#57534e] font-mono text-[9px]">
                          {tool.timestamp}
                        </span>
                      </div>

                      {/* Collapsed by default technical details (arguments / errors only) */}
                      {isExpanded && (
                        <div className="mt-2 pt-1.5 space-y-1.5 text-[10px] font-mono">
                          {tool.arguments &&
                            Object.keys(tool.arguments).length > 0 && (
                              <div className="p-2 rounded-lg bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] text-[#57534e] dark:text-[#a8a29e] overflow-x-auto max-h-24">
                                <span className="text-[9px] font-sans font-semibold text-[#78716c] uppercase block mb-0.5">
                                  Arguments:
                                </span>
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(tool.arguments, null, 2)}
                                </pre>
                              </div>
                            )}
                          {tool.error && (
                            <div className="p-2 rounded-lg bg-[#dc2626]/5 border border-[#dc2626]/20 text-[#dc2626] overflow-x-auto">
                              <span className="text-[9px] font-sans font-semibold uppercase block mb-0.5">
                                Error:
                              </span>
                              <p>{tool.error}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Spoken Conversation History & Live Speech Stream (8 cols on xl, 7 cols on lg) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-0 bg-white dark:bg-[#1c1917] rounded-2xl border border-[#e7e5e4] dark:border-[#27272a] shadow-xs overflow-hidden">
          {/* Conversation Header */}
          <div className="px-5 py-3 border-b border-[#e7e5e4] dark:border-[#27272a] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#0c0a09] dark:text-white" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0c0a09] dark:text-[#f5f5f5] font-sans-editorial">
                Spoken Conversation & Transcripts
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#777169] dark:text-[#a8a29e]">
              <span>
                {turns.length} completed {turns.length === 1 ? 'turn' : 'turns'}
              </span>
              {turns.length > 0 && (
                <button
                  onClick={() => setTurns([])}
                  className="text-[11px] px-2 py-0.5 rounded-full hover:bg-[#f0efed] dark:hover:bg-[#292524] transition-colors"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Conversation Stream */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
          >
            {turns.length === 0 && !currentTurn ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#777169] dark:text-[#a8a29e] space-y-2">
                <Mic className="w-8 h-8 text-[#a8a29e] stroke-1" />
                <h4 className="font-display-light text-lg text-[#0c0a09] dark:text-[#f5f5f5]">
                  Voice stream ready
                </h4>
                <p className="text-xs max-w-sm font-sans-editorial">
                  Start speaking into your microphone. Your spoken questions and
                  Gemini Live's incremental responses will stream here in real
                  time with grounded document citations.
                </p>
              </div>
            ) : (
              <>
                {/* Past Completed Turns */}
                {turns.map((turn) => (
                  <div
                    key={turn.id}
                    className="space-y-3 pb-3 border-b border-[#e7e5e4]/60 dark:border-[#27272a]/60 last:border-none"
                  >
                    {/* User Question */}
                    {turn.userText && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[#f0efed] dark:bg-[#292524] flex items-center justify-center shrink-0 text-[10px] font-semibold text-[#0c0a09] dark:text-white">
                          You
                        </div>
                        <div className="flex-1 p-3 rounded-2xl bg-[#f0efed] dark:bg-[#292524] text-xs font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5]">
                          <p>{turn.userText}</p>
                          <span className="block text-[10px] text-[#777169] dark:text-[#a8a29e] mt-1 text-right font-mono">
                            {turn.timestamp}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Assistant Response */}
                    {turn.assistantText && (
                      <div className="flex items-start gap-2.5 pl-2 sm:pl-4">
                        <div className="w-6 h-6 rounded-full bg-[#0c0a09] dark:bg-white flex items-center justify-center shrink-0 text-[10px] font-semibold text-white dark:text-[#0c0a09]">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 p-3.5 rounded-2xl bg-[#fafafa] dark:bg-[#141210] border border-[#e7e5e4] dark:border-[#27272a] text-xs font-sans-editorial">
                          <p className="text-[#0c0a09] dark:text-[#f5f5f5] leading-relaxed whitespace-pre-wrap">
                            {turn.assistantText}
                          </p>

                          {/* Grounded Citation Chips */}
                          {turn.citations && turn.citations.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-[#e7e5e4] dark:border-[#27272a] flex flex-wrap gap-1.5">
                              {turn.citations.map((src) => (
                                <button
                                  key={src.id}
                                  onClick={() => onCitationClick?.(src)}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-[#292524] border border-[#d6d3d1] dark:border-[#3f3f46] text-[10px] text-[#0c0a09] dark:text-white font-medium hover:border-[#0c0a09] dark:hover:border-white transition-colors"
                                  title={`Click to inspect Page ${src.page} excerpt in Context Panel`}
                                >
                                  <BookOpen className="w-2.5 h-2.5" />
                                  <span>
                                    Page {src.page}: {src.section}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Currently Streaming / Active Turn */}
                {currentTurn && (
                  <div className="space-y-3 p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0f172a]/30 border border-[#38bdf8]/30 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[11px] text-[#0284c7] dark:text-[#38bdf8] font-medium font-sans-editorial mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#0284c7] dark:bg-[#38bdf8] animate-ping" />
                        <span>Active Response Turn</span>
                      </span>
                      <span className="font-mono text-[10px]">
                        {currentTurn.timestamp}
                      </span>
                    </div>

                    {/* Active User Input */}
                    {currentTurn.userText && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[#e2e8f0] dark:bg-[#1e293b] flex items-center justify-center shrink-0 text-[10px] font-semibold text-[#0c0a09] dark:text-white">
                          You
                        </div>
                        <div className="flex-1 p-3 rounded-2xl bg-white dark:bg-[#1e293b] border border-[#cbd5e1] dark:border-[#334155] text-xs font-sans-editorial text-[#0c0a09] dark:text-[#f5f5f5]">
                          <p>"{currentTurn.userText}"</p>
                        </div>
                      </div>
                    )}

                    {/* Active Assistant Speech Streaming Incrementally */}
                    <div className="flex items-start gap-2.5 pl-2 sm:pl-4">
                      <div className="w-6 h-6 rounded-full bg-[#0c0a09] dark:bg-white flex items-center justify-center shrink-0 text-[10px] font-semibold text-white dark:text-[#0c0a09]">
                        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                      </div>
                      <div className="flex-1 p-3.5 rounded-2xl bg-white dark:bg-[#141210] border border-[#e2e8f0] dark:border-[#334155] text-xs font-sans-editorial">
                        {currentTurn.assistantText ? (
                          <p className="text-[#0c0a09] dark:text-[#f5f5f5] leading-relaxed whitespace-pre-wrap">
                            {currentTurn.assistantText}
                            <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#0284c7] dark:bg-[#38bdf8] animate-pulse" />
                          </p>
                        ) : (
                          <div className="flex items-center gap-2 text-[#777169] dark:text-[#a8a29e] italic text-xs py-1">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              {voiceState === 'executing_tool'
                                ? 'Executing MCP tool and generating synthesis...'
                                : 'Formulating grounded spoken response...'}
                            </span>
                          </div>
                        )}

                        {/* Live Citations for Active Turn */}
                        {currentTurn.citations &&
                          currentTurn.citations.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-[#e7e5e4] dark:border-[#27272a] flex flex-wrap gap-1.5">
                              {currentTurn.citations.map((src) => (
                                <button
                                  key={src.id}
                                  onClick={() => onCitationClick?.(src)}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f0fdf4] dark:bg-[#14532d]/40 border border-[#86efac] dark:border-[#166534] text-[10px] text-[#15803d] dark:text-[#86efac] font-medium transition-colors"
                                >
                                  <BookOpen className="w-2.5 h-2.5" />
                                  <span>
                                    Page {src.page}: {src.section}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
