import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  BookOpen,
  ArrowLeft,
  AlertCircle,
  Layers,
  Radio,
} from 'lucide-react';
import type { VoiceState, SourceCitation, DocumentMetadata } from '../../types';
import { RealtimeVoiceService } from '../../services/voice';
import { isMockMode } from '../../services/api';

interface VoiceConversationProps {
  document: DocumentMetadata;
  sessionId: string;
  onSwitchToText: () => void;
  onCitationClick?: (citation: SourceCitation) => void;
}

export const VoiceConversation: React.FC<VoiceConversationProps> = ({
  document,
  sessionId,
  onSwitchToText,
  onCitationClick,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [userTranscription, setUserTranscription] = useState<string>('');
  const [assistantTranscription, setAssistantTranscription] = useState<string>('');
  const [activeSources, setActiveSources] = useState<SourceCitation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const voiceServiceRef = useRef<RealtimeVoiceService | null>(null);

  useEffect(() => {
    const service = new RealtimeVoiceService(document.id, sessionId, {
      onStateChange: (state) => setVoiceState(state),
      onAudioLevel: (lvl) => setAudioLevel(lvl),
      onInputTranscription: (text) => setUserTranscription(text),
      onOutputTranscription: (text) => setAssistantTranscription(text),
      onSources: (sources) => setActiveSources(sources),
      onError: (err) => setErrorMessage(err),
    });

    voiceServiceRef.current = service;

    return () => {
      service.stop();
      voiceServiceRef.current = null;
    };
  }, [document.id, sessionId]);

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
    setAudioLevel(0);
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

  const numBars = 24;
  const isSessionActive =
    voiceState === 'connected' ||
    voiceState === 'listening' ||
    voiceState === 'processing' ||
    voiceState === 'speaking';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#faf9f5] dark:bg-[#121211] p-4 md:p-8">
      {/* Top Header & Mode Breadcrumb */}
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pb-4 border-b border-[#e6dfd8] dark:border-[#2d2a25]">
        <button
          onClick={onSwitchToText}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6c6a64] dark:text-[#9e998f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Text Conversation</span>
        </button>

        {isMockMode() && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#e8a55a]/15 text-[#e8a55a] border border-[#e8a55a]/30">
            <Layers className="w-3 h-3" />
            <span>Dev Mock Audio Mode</span>
          </span>
        )}
      </div>

      {/* Main Voice Interactive Arena */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-8 space-y-8">
        {/* Document Context Card */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#efe9de] dark:bg-[#1c1b18] border border-[#e6dfd8] dark:border-[#2d2a25] text-xs text-[#6c6a64] dark:text-[#9e998f] mb-3">
            <Radio className="w-3.5 h-3.5 text-[#cc785c]" />
            <span>Grounded on: <strong className="text-[#141413] dark:text-[#faf9f5]">{document.filename}</strong></span>
          </div>

          <h2 className="font-serif-display text-3xl md:text-4xl font-normal text-[#141413] dark:text-[#faf9f5]">
            Realtime Audio-to-Audio Ingestion
          </h2>
          <p className="mt-2 text-xs text-[#6c6a64] dark:text-[#9e998f]">
            Speak naturally. Questions are routed via RAG retrieval with cited page references.
          </p>
        </div>

        {/* Live Audio Waveform Visualizer */}
        <div className="w-full p-8 rounded-3xl bg-[#efe9de] dark:bg-[#181715] border border-[#e6dfd8] dark:border-[#2d2a25] shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
          {/* Status Badge */}
          <div className="mb-6">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                voiceState === 'listening'
                  ? 'bg-[#5db872]/20 text-[#5db872] border border-[#5db872]/40'
                  : voiceState === 'processing'
                  ? 'bg-[#e8a55a]/20 text-[#e8a55a] border border-[#e8a55a]/40 animate-pulse'
                  : voiceState === 'speaking'
                  ? 'bg-[#cc785c]/20 text-[#cc785c] border border-[#cc785c]/40 animate-pulse'
                  : voiceState === 'error'
                  ? 'bg-[#c64545]/20 text-[#c64545] border border-[#c64545]/40'
                  : 'bg-[#6c6a64]/15 text-[#6c6a64] dark:text-[#9e998f]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  voiceState === 'listening'
                    ? 'bg-[#5db872] animate-ping'
                    : voiceState === 'processing'
                    ? 'bg-[#e8a55a] animate-bounce'
                    : voiceState === 'speaking'
                    ? 'bg-[#cc785c] animate-pulse'
                    : 'bg-[#8e8b82]'
                }`}
              />
              <span className="capitalize">
                {voiceState === 'listening'
                  ? 'Listening to researcher...'
                  : voiceState === 'processing'
                  ? 'Reasoning & Grounding...'
                  : voiceState === 'speaking'
                  ? 'Aethelgard Speaking...'
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

          {/* Authentic Waveform Visualization */}
          <div className="h-24 w-full flex items-center justify-center gap-1.5 px-4">
            {Array.from({ length: numBars }).map((_, index) => {
              const distanceCenter = Math.abs(index - numBars / 2) / (numBars / 2);
              const falloff = 1 - Math.pow(distanceCenter, 1.5);
              const heightMultiplier = isSessionActive ? Math.max(0.08, audioLevel * falloff) : 0.08;
              const barHeight = Math.min(100, Math.max(8, heightMultiplier * 100));

              return (
                <div
                  key={index}
                  className="w-1.5 rounded-full transition-all duration-75 ease-out"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor:
                      voiceState === 'speaking'
                        ? '#cc785c'
                        : voiceState === 'processing'
                        ? '#e8a55a'
                        : voiceState === 'listening'
                        ? '#5db872'
                        : 'var(--hairline)',
                    opacity: isSessionActive ? 0.9 : 0.3,
                  }}
                />
              );
            })}
          </div>

          {/* Live Captions / Transcriptions Overlay */}
          <div className="mt-6 w-full space-y-3">
            {userTranscription && (
              <div className="p-3 rounded-xl bg-[#faf9f5]/80 dark:bg-[#22201d]/80 border border-[#e6dfd8] dark:border-[#2d2a25] text-xs">
                <span className="font-semibold text-[#6c6a64] dark:text-[#9e998f] uppercase text-[10px] block mb-0.5">
                  You:
                </span>
                <p className="text-[#141413] dark:text-[#faf9f5] italic">"{userTranscription}"</p>
              </div>
            )}

            {assistantTranscription && (
              <div className="p-3 rounded-xl bg-[#cc785c]/10 border border-[#cc785c]/30 text-xs">
                <span className="font-semibold text-[#cc785c] uppercase text-[10px] block mb-0.5 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Assistant:
                </span>
                <p className="text-[#141413] dark:text-[#faf9f5] leading-relaxed">
                  {assistantTranscription}
                </p>
              </div>
            )}

            {/* Active Sources Cited Live */}
            {activeSources.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-2 justify-center">
                {activeSources.map((src) => (
                  <button
                    key={src.id}
                    onClick={() => onCitationClick?.(src)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#faf9f5] dark:bg-[#252320] border border-[#cc785c] text-[11px] text-[#cc785c] font-medium shadow-xs hover:bg-[#cc785c] hover:text-white transition-colors"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Page {src.page}: {src.section}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="w-full p-4 rounded-xl bg-[#c64545]/10 border border-[#c64545]/20 flex items-center gap-3 text-xs text-[#c64545]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="flex-1">{errorMessage}</p>
          </div>
        )}

        {/* Voice Control Dock */}
        <div className="flex items-center justify-center gap-4">
          {!isSessionActive ? (
            <button
              onClick={handleStartSession}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#cc785c] hover:bg-[#a9583e] text-white font-medium text-sm shadow-md transition-all active:scale-95"
            >
              <Mic className="w-5 h-5" />
              <span>Start Voice Conversation</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleMute}
                className={`p-3.5 rounded-full border transition-all ${
                  isMuted
                    ? 'bg-[#c64545] border-[#c64545] text-white'
                    : 'bg-[#efe9de] dark:bg-[#252320] border-[#e6dfd8] dark:border-[#2d2a25] text-[#141413] dark:text-[#faf9f5] hover:bg-[#e6dfd8]'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={handleFinishTurn}
                className="px-4 py-2.5 rounded-full bg-[#efe9de] dark:bg-[#252320] border border-[#e6dfd8] dark:border-[#2d2a25] text-xs font-medium text-[#141413] dark:text-[#faf9f5] hover:bg-[#e6dfd8] transition-colors"
              >
                Finish My Turn
              </button>

              <button
                onClick={handleStopSession}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#181715] dark:bg-[#252320] hover:bg-[#c64545] text-white text-xs font-medium shadow-md transition-colors"
                title="Disconnect voice session"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>End Voice</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
