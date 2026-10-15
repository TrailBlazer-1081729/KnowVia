import React from 'react';
import { MessageSquare, Mic } from 'lucide-react';
import type { ConversationMode } from '../../types';

interface ModeSelectorProps {
  currentMode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;
  isVoiceActive?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onModeChange,
  isVoiceActive = false,
}) => {
  return (
    <div className="relative inline-flex p-1 rounded-xl bg-[#efe9de] dark:bg-[#1c1b18] border border-[#e6dfd8] dark:border-[#2d2a25] shadow-xs">
      {/* Text Mode Option */}
      <button
        onClick={() => onModeChange('text')}
        className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-sans-body font-medium transition-all duration-200 ${
          currentMode === 'text'
            ? 'bg-[#faf9f5] dark:bg-[#252320] text-[#141413] dark:text-[#faf9f5] shadow-xs'
            : 'text-[#6c6a64] dark:text-[#9e998f] hover:text-[#141413] dark:hover:text-[#faf9f5]'
        }`}
        aria-label="Switch to Text Conversation"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Text Conversation</span>
      </button>

      {/* Voice Mode Option */}
      <button
        onClick={() => onModeChange('voice')}
        className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-sans-body font-medium transition-all duration-200 ${
          currentMode === 'voice'
            ? 'bg-[#cc785c] text-white shadow-xs'
            : 'text-[#6c6a64] dark:text-[#9e998f] hover:text-[#141413] dark:hover:text-[#faf9f5]'
        }`}
        aria-label="Switch to Voice Conversation"
      >
        <div className="relative">
          <Mic className="w-3.5 h-3.5" />
          {isVoiceActive && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#5db872] animate-ping" />
          )}
        </div>
        <span>Voice Conversation</span>
        {isVoiceActive && (
          <span className="text-[10px] px-1 rounded bg-black/20 text-white font-mono">
            LIVE
          </span>
        )}
      </button>
    </div>
  );
};
