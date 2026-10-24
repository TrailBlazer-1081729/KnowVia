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
    <div className="relative inline-flex p-1 rounded-full bg-[#f0efed] dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] shadow-xs">
      {/* Text Mode Option */}
      <button
        onClick={() => onModeChange('text')}
        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-sans-editorial font-medium transition-all duration-200 ${
          currentMode === 'text'
            ? 'bg-[#292524] text-white dark:bg-[#f5f5f5] dark:text-[#0c0a09] shadow-xs'
            : 'text-[#777169] dark:text-[#a8a29e] hover:text-[#0c0a09] dark:hover:text-[#f5f5f5]'
        }`}
        aria-label="Switch to Text Conversation"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Text Conversation</span>
        <span className="sm:hidden">Text</span>
      </button>

      {/* Voice Mode Option */}
      <button
        onClick={() => onModeChange('voice')}
        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-sans-editorial font-medium transition-all duration-200 ${
          currentMode === 'voice'
            ? 'bg-[#292524] text-white dark:bg-[#f5f5f5] dark:text-[#0c0a09] shadow-xs'
            : 'text-[#777169] dark:text-[#a8a29e] hover:text-[#0c0a09] dark:hover:text-[#f5f5f5]'
        }`}
        aria-label="Switch to Voice Conversation"
      >
        <div className="relative">
          <Mic className="w-3.5 h-3.5" />
          {isVoiceActive && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#16a34a] animate-ping" />
          )}
        </div>
        <span className="hidden sm:inline">Voice Conversation</span>
        <span className="sm:hidden">Voice</span>
        {isVoiceActive && (
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#16a34a]/20 text-[#16a34a] font-mono">
            LIVE
          </span>
        )}
      </button>
    </div>
  );
};
