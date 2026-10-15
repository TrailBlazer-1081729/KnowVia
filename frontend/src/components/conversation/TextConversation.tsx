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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#faf9f5] dark:bg-[#121211]">
      {/* Scrollable Conversation History */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 max-w-4xl mx-auto w-full">
        {/* Empty State / Welcome Screen */}
        {messages.length === 0 && (
          <div className="py-12 text-center max-w-2xl mx-auto">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#cc785c]/10 text-[#cc785c] flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>

            <h2 className="font-serif-display text-2xl md:text-3xl font-normal text-[#141413] dark:text-[#faf9f5]">
              Inquire into {document.filename}
            </h2>

            <p className="mt-2 text-sm text-[#6c6a64] dark:text-[#9e998f] leading-relaxed">
              The document is fully indexed into {document.chunk_count || document.page_count * 4} passages.
              Ask any question or pick a starter inquiry below.
            </p>

            {/* Starter Questions Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              {starterQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(q)}
                  disabled={isLoading}
                  className="p-3.5 rounded-xl border border-[#e6dfd8] dark:border-[#2d2a25] bg-[#efe9de]/50 dark:bg-[#1c1b18]/60 hover:border-[#cc785c]/50 hover:bg-[#efe9de] dark:hover:bg-[#22201d] text-xs font-sans-body text-[#3d3d3a] dark:text-[#cfcbc2] transition-all flex items-start justify-between gap-2 group text-left"
                >
                  <span className="leading-relaxed">{q}</span>
                  <ChevronRight className="w-4 h-4 text-[#cc785c] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
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
                <div className="w-8 h-8 rounded-lg bg-[#cc785c] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] md:max-w-[78%] rounded-2xl p-4 md:p-5 shadow-xs ${
                  isUser
                    ? 'bg-[#cc785c] text-white rounded-tr-xs font-sans-body text-sm leading-relaxed'
                    : 'bg-[#efe9de] dark:bg-[#1c1b18] border border-[#e6dfd8] dark:border-[#2d2a25] text-[#141413] dark:text-[#faf9f5] rounded-tl-xs'
                }`}
              >
                {/* Header for assistant message */}
                {!isUser && (
                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#e6dfd8] dark:border-[#2d2a25] text-[11px] text-[#6c6a64] dark:text-[#9e998f]">
                    <span className="font-medium font-sans-body">
                      {msg.model || 'Grounded Assistant'}
                    </span>
                    <button
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="p-1 rounded hover:bg-[#faf9f5] dark:hover:bg-[#252320] text-[#6c6a64] dark:text-[#9e998f] transition-colors flex items-center gap-1"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#5db872]" />
                          <span className="text-[10px] text-[#5db872]">Copied</span>
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
                <div className="font-sans-body text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {msg.content}
                </div>

                {/* Source Citations Tags */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#e6dfd8] dark:border-[#2d2a25]">
                    <div className="text-[11px] font-semibold text-[#6c6a64] dark:text-[#9e998f] uppercase tracking-wider mb-2 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-[#cc785c]" />
                      <span>Retrieved Sources ({msg.sources.length})</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((src) => (
                        <button
                          key={src.id}
                          onClick={() => onCitationClick?.(src)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#faf9f5] dark:bg-[#252320] border border-[#e6dfd8] dark:border-[#2d2a25] text-[11px] font-medium text-[#3d3d3a] dark:text-[#cfcbc2] hover:border-[#cc785c] hover:text-[#cc785c] transition-colors"
                          title={`Page ${src.page} — Match: ${Math.round(src.relevance_score * 100)}%`}
                        >
                          <span className="font-mono text-[#cc785c]">p.{src.page}</span>
                          <span className="truncate max-w-[120px]">{src.section || 'Excerpt'}</span>
                          <span className="text-[10px] text-[#8e8b82]">
                            {Math.round(src.relevance_score * 100)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-[#efe9de] dark:bg-[#252320] border border-[#e6dfd8] dark:border-[#2d2a25] text-[#141413] dark:text-[#faf9f5] flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading / Thinking State */}
        {isLoading && (
          <div className="flex items-start gap-3 md:gap-4 justify-start">
            <div className="w-8 h-8 rounded-lg bg-[#cc785c] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="p-4 rounded-2xl bg-[#efe9de] dark:bg-[#1c1b18] border border-[#e6dfd8] dark:border-[#2d2a25] rounded-tl-xs flex items-center gap-2.5 text-xs text-[#6c6a64] dark:text-[#9e998f]">
              <span className="w-2 h-2 rounded-full bg-[#cc785c] animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-[#cc785c] animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-[#cc785c] animate-bounce [animation-delay:0.4s]" />
              <span className="font-serif-display italic ml-1">Analyzing passages and grounding response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Bottom Prompt Input Area */}
      <div className="border-t border-[#e6dfd8] dark:border-[#2d2a25] bg-[#faf9f5] dark:bg-[#121211] p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-xl border border-[#e6dfd8] dark:border-[#2d2a25] bg-[#efe9de]/40 dark:bg-[#1c1b18] focus-within:border-[#cc785c] focus-within:ring-2 focus-within:ring-[#cc785c]/15 transition-all shadow-xs">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask a question about ${document.filename}... (Press Enter to submit)`}
              disabled={isLoading}
              className="w-full resize-none p-3.5 pr-24 bg-transparent font-sans-body text-sm text-[#141413] dark:text-[#faf9f5] placeholder-[#8e8b82] dark:placeholder-[#7a766e] focus:outline-none"
            />

            {/* Input Action Cluster */}
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              {messages.length > 0 && onResetSession && (
                <button
                  onClick={onResetSession}
                  className="p-1.5 rounded-lg text-[#8e8b82] hover:text-[#c64545] hover:bg-[#efe9de] dark:hover:bg-[#252320] transition-colors"
                  title="Clear conversation context"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleSubmit}
                disabled={!inputText.trim() || isLoading}
                className="p-2 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] disabled:opacity-40 text-white shadow-xs transition-all active:scale-95"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#8e8b82] dark:text-[#7a766e] mt-2 px-1">
            <span>
              Press <kbd className="px-1 py-0.5 rounded bg-[#efe9de] dark:bg-[#252320] font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-[#efe9de] dark:bg-[#252320] font-mono text-[10px]">Shift+Enter</kbd> for newline
            </span>
            <span className="flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5db872]" />
              Grounded on {document.page_count} pages
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
