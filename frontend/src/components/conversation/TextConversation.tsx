import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Copy,
  Check,
  BookOpen,
  User,
  Bot,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import type { ChatMessage, SourceCitation, DocumentMetadata } from '../../types';

interface TextConversationProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  document: DocumentMetadata;
  onCitationClick?: (citation: SourceCitation) => void;
  onResetSession?: () => void;
}

export const TextConversation: React.FC<TextConversationProps> = ({
  messages,
  onSendMessage,
  isLoading,
  document,
  onCitationClick,
  onResetSession,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;
    setInputText('');
    await onSendMessage(trimmed);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const starterQuestions = [
    `What are the core theses and primary findings of ${document.filename}?`,
    'Summarize the methodology and experimental setup.',
    'What limitations or open questions are noted by the authors?',
    'Extract any quantitative benchmarks or numerical results.',
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f5f5f5] dark:bg-[#0c0a09]">
      {/* Scrollable Conversation History */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 max-w-4xl mx-auto w-full">
        {/* Empty State / Welcome Screen */}
        {messages.length === 0 && (
          <div className="py-12 text-center max-w-2xl mx-auto">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-[#f5f5f5] flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>

            <h2 className="font-display-light text-3xl md:text-4xl text-[#0c0a09] dark:text-[#f5f5f5]">
              Inquire into {document.filename}
            </h2>

            <p className="mt-2 text-sm font-sans-editorial text-[#777169] dark:text-[#a8a29e] leading-relaxed">
              The document is verified and indexed into {document.chunk_count || document.page_count * 4} passages.
              Inquire below or select an editorial research starter.
            </p>

            {/* Starter Questions Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              {starterQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(q)}
                  disabled={isLoading}
                  className="p-4 rounded-2xl border border-[#e7e5e4] dark:border-[#27272a] bg-white dark:bg-[#1c1917] hover:border-[#0c0a09] dark:hover:border-white text-xs font-sans-editorial text-[#4e4e4e] dark:text-[#d6d3d1] transition-all flex items-start justify-between gap-2 group text-left shadow-xs"
                >
                  <span className="leading-relaxed">{q}</span>
                  <ChevronRight className="w-4 h-4 text-[#0c0a09] dark:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 md:gap-4 ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-[#f5f5f5] flex items-center justify-center shrink-0 mt-1 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] md:max-w-[78%] rounded-2xl p-5 shadow-xs ${
                  isUser
                    ? 'bg-[#292524] dark:bg-[#f5f5f5] text-white dark:text-[#0c0a09] rounded-tr-xs font-sans-editorial text-sm leading-relaxed'
                    : 'bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] text-[#0c0a09] dark:text-[#f5f5f5] rounded-tl-xs'
                }`}
              >
                {/* Header for assistant message */}
                {!isUser && (
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#e7e5e4] dark:border-[#27272a] text-[11px] text-[#777169] dark:text-[#a8a29e]">
                    <span className="font-medium font-sans-editorial">
                      {msg.model || 'KnowVia Research Synthesizer'}
                    </span>
                    <button
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="p-1 rounded-full hover:bg-[#f0efed] dark:hover:bg-[#292524] text-[#777169] dark:text-[#a8a29e] transition-colors flex items-center gap-1"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#16a34a]" />
                          <span className="text-[10px] text-[#16a34a]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[10px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Message Content */}
                <div className="font-sans-editorial text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {msg.content}
                </div>

                {/* Source Citations Tags */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#e7e5e4] dark:border-[#27272a]">
                    <div className="text-[11px] font-semibold text-[#777169] dark:text-[#a8a29e] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 text-[#292524] dark:text-[#f5f5f5]" />
                      <span>Retrieved Sources ({msg.sources.length})</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((src) => (
                        <button
                          key={src.id}
                          onClick={() => onCitationClick?.(src)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0efed] dark:bg-[#292524] border border-[#e7e5e4] dark:border-[#27272a] text-[11px] font-medium text-[#0c0a09] dark:text-[#f5f5f5] hover:border-[#0c0a09] dark:hover:border-white transition-colors"
                          title={`Page ${src.page} — Match: ${Math.round(src.relevance_score * 100)}%`}
                        >
                          <span className="font-mono font-semibold">p.{src.page}</span>
                          <span className="truncate max-w-[120px]">{src.section || 'Excerpt'}</span>
                          <span className="text-[10px] text-[#777169] dark:text-[#a8a29e]">
                            {Math.round(src.relevance_score * 100)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-[#f0efed] dark:bg-[#292524] text-[#0c0a09] dark:text-[#f5f5f5] flex items-center justify-center shrink-0 mt-1 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading / Thinking State */}
        {isLoading && (
          <div className="flex items-start gap-3 md:gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-[#292524] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] rounded-tl-xs flex items-center gap-2.5 text-xs text-[#777169] dark:text-[#a8a29e] shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0c0a09] dark:bg-white animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#0c0a09] dark:bg-white animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#0c0a09] dark:bg-white animate-bounce [animation-delay:0.4s]" />
              <span className="font-sans-editorial ml-1">Analyzing passages and grounding response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Bottom Prompt Input Area */}
      <div className="border-t border-[#e7e5e4] dark:border-[#27272a] bg-[#f5f5f5] dark:bg-[#0c0a09] p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl border border-[#d6d3d1] dark:border-[#3f3f46] bg-white dark:bg-[#1c1917] focus-within:border-[#0c0a09] dark:focus-within:border-white focus-within:ring-2 focus-within:ring-[#0c0a09]/10 transition-all shadow-xs">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask a question about ${document.filename}... (Press Enter to submit)`}
              disabled={isLoading}
              className="w-full resize-none p-4 pr-24 bg-transparent font-sans-editorial text-sm text-[#0c0a09] dark:text-[#f5f5f5] placeholder-[#a8a29e] focus:outline-none"
            />

            {/* Input Action Cluster */}
            <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
              {messages.length > 0 && onResetSession && (
                <button
                  onClick={onResetSession}
                  className="p-1.5 rounded-full text-[#a8a29e] hover:text-[#dc2626] hover:bg-[#f0efed] dark:hover:bg-[#292524] transition-colors"
                  title="Clear conversation context"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleSubmit}
                disabled={!inputText.trim() || isLoading}
                className="p-2.5 rounded-full bg-[#292524] hover:bg-[#0c0a09] dark:bg-[#f5f5f5] dark:text-[#0c0a09] dark:hover:bg-white disabled:opacity-30 text-white shadow-xs transition-all active:scale-95"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#777169] dark:text-[#a8a29e] mt-2 px-1 font-sans-editorial">
            <span>
              Press <kbd className="px-1.5 py-0.5 rounded-full bg-white dark:bg-[#292524] border border-[#e7e5e4] dark:border-[#27272a] font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded-full bg-white dark:bg-[#292524] border border-[#e7e5e4] dark:border-[#27272a] font-mono text-[10px]">Shift+Enter</kbd> for newline
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
              Grounded on {document.page_count} pages
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
