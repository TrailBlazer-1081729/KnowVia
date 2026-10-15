import { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Sparkles,
  PanelRightOpen,
  PanelRightClose,
  FileText,
} from 'lucide-react';
import type {
  DocumentMetadata,
  ChatMessage,
  ConversationMode,
  SourceCitation,
  SessionInfo,
} from './types';
import * as api from './services/api';
import { Sidebar } from './components/layout/Sidebar';
import { UploadDropZone } from './components/ingestion/UploadDropZone';
import { ModeSelector } from './components/conversation/ModeSelector';
import { TextConversation } from './components/conversation/TextConversation';
import { VoiceConversation } from './components/conversation/VoiceConversation';
import { ContextPanel } from './components/context/ContextPanel';

export function App() {
  // Theme & Mock Mode State
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aethelgard_theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [isMock, setIsMock] = useState<boolean>(() => api.isMockMode());

  // Layout State — default to collapsed sidebar on mobile, open on desktop
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  // Context panel open on wide desktop by default, closed on mobile by default
  const [isContextPanelOpen, setIsContextPanelOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1280;
    }
    return false;
  });

  // Document & Ingestion State
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [currentDocument, setCurrentDocument] = useState<DocumentMetadata | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Conversation State
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationMode, setConversationMode] = useState<ConversationMode>('text');
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [activeSources, setActiveSources] = useState<SourceCitation[]>([]);
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);

  // Polling ref for ingestion status
  const pollingRef = useRef<number | null>(null);

  // Apply dark mode class to html document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('aethelgard_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('aethelgard_theme', 'light');
    }
  }, [isDark]);

  // Handle window resizing for responsive panels
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial load: fetch recent documents
  useEffect(() => {
    async function loadInitial() {
      try {
        const list = await api.listDocuments();
        setDocuments(list);
        if (list.length > 0) {
          const firstReady = list.find((d) => d.status === 'ready') || list[0];
          setCurrentDocument(firstReady);
          if (firstReady.status === 'ready') {
            const session = await api.createSession(firstReady.id);
            setCurrentSession(session);
          }
        }
      } catch (err) {
        console.warn('Initial document load note:', err);
      }
    }
    loadInitial();
  }, []);

  // Handle clean up of polling interval
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Theme Toggle Handler
  const handleToggleTheme = () => setIsDark((prev) => !prev);

  // Dev Mock Toggle Handler
  const handleToggleMock = () => {
    const nextVal = !isMock;
    setIsMock(nextVal);
    api.setMockMode(nextVal);
  };

  // Select File from Drop Zone
  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setIsUploading(true);

    try {
      const doc = await api.uploadDocument(file);
      setCurrentDocument(doc);
      setDocuments((prev) => {
        const filtered = prev.filter((d) => d.id !== doc.id);
        return [doc, ...filtered];
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(msg);
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Start RAG Ingestion Pipeline with genuine status polling
  const handleStartIngestion = async () => {
    if (!currentDocument) return;
    setErrorMessage(null);
    setIsIngesting(true);

    try {
      await api.startIngestion(currentDocument.id);

      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = window.setInterval(async () => {
        try {
          const res = await api.getIngestionStatus(currentDocument.id);

          setCurrentDocument((prev) => (prev ? { ...prev, ...res.metadata, status: res.status, stage: res.stage, progress: res.progress } : null));

          if (res.status === 'ready') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setIsIngesting(false);

            setDocuments((prev) =>
              prev.map((d) => (d.id === currentDocument.id ? { ...d, status: 'ready', stage: 'completed', progress: 1.0 } : d))
            );

            const session = await api.createSession(currentDocument.id);
            setCurrentSession(session);
            setMessages([]);
          } else if (res.status === 'error') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setIsIngesting(false);
            setErrorMessage(res.message || 'Ingestion encountered an error.');
          }
        } catch (err: unknown) {
          console.warn('Polling error:', err);
        }
      }, 700);
    } catch (err: unknown) {
      setIsIngesting(false);
      const msg = err instanceof Error ? err.message : 'Could not start ingestion';
      setErrorMessage(msg);
    }
  };

  // Reset to empty state / New Session
  const handleReset = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setSelectedFile(null);
    setCurrentDocument(null);
    setCurrentSession(null);
    setMessages([]);
    setActiveSources([]);
    setErrorMessage(null);
    setIsIngesting(false);
  };

  // Select an existing document from sidebar
  const handleSelectDocument = async (doc: DocumentMetadata) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setCurrentDocument(doc);
    setSelectedFile(null);
    setErrorMessage(null);
    setActiveSources([]);

    // Auto-close sidebar on mobile after selection
    if (window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }

    if (doc.status === 'ready') {
      try {
        const session = await api.createSession(doc.id);
        setCurrentSession(session);
        setMessages([]);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId: string) => {
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (currentDocument?.id === docId) {
        handleReset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send Text Question in Conversation
  const handleSendMessage = async (text: string) => {
    if (!currentDocument || !currentSession || isLoadingChat) return;

    if (currentDocument.status !== 'ready') {
      setErrorMessage('Ingestion must genuinely complete before asking questions.');
      return;
    }

    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoadingChat(true);

    try {
      const response = await api.sendChatMessage(currentSession.id, currentDocument.id, text);
      setMessages((prev) => [...prev, response]);

      if (response.sources && response.sources.length > 0) {
        setActiveSources(response.sources);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending message';
      const errorReply: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `**Error:** ${msg}\n\nPlease verify that the backend is running or enable Dev Mock Mode.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Click on a citation chip
  const handleCitationClick = (citation: SourceCitation) => {
    setIsContextPanelOpen(true);
    setHighlightedCitationId(citation.id);
    setTimeout(() => setHighlightedCitationId(null), 3000);
  };

  const showConversationWorkspace = currentDocument && currentDocument.status === 'ready';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#faf9f5] dark:bg-[#121211] font-sans-body antialiased">
      {/* Mobile Backdrop for Sidebar */}
      {!isSidebarCollapsed && (
        <div
          onClick={() => setIsSidebarCollapsed(true)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* 1. Left Sidebar */}
      <Sidebar
        currentDocument={currentDocument}
        documents={documents}
        onSelectDocument={handleSelectDocument}
        onNewSession={handleReset}
        onDeleteDocument={handleDeleteDocument}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        isMock={isMock}
        onToggleMock={handleToggleMock}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* 2. Main Workspace */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-14 border-b border-[#e6dfd8] dark:border-[#2d2a25] px-3 md:px-6 flex items-center justify-between bg-[#faf9f5] dark:bg-[#121211] shrink-0 z-20">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="p-1.5 rounded-md hover:bg-[#efe9de] dark:hover:bg-[#22201d] text-[#6c6a64] dark:text-[#9e998f]"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {currentDocument ? (
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-[#cc785c] shrink-0" />
                <span className="text-xs md:text-sm font-medium text-[#141413] dark:text-[#faf9f5] truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs">
                  {currentDocument.filename}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    currentDocument.status === 'ready'
                      ? 'bg-[#5db872]/15 text-[#5db872]'
                      : 'bg-[#e8a55a]/15 text-[#e8a55a]'
                  }`}
                >
                  {currentDocument.status}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#6c6a64] dark:text-[#9e998f]">
                <Sparkles className="w-4 h-4 text-[#cc785c]" />
                <span className="font-serif-display text-sm text-[#141413] dark:text-[#faf9f5]">
                  New Research Workspace
                </span>
              </div>
            )}
          </div>

          {/* Center / Right Header Controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {showConversationWorkspace && (
              <ModeSelector
                currentMode={conversationMode}
                onModeChange={(m) => setConversationMode(m)}
              />
            )}

            <button
              onClick={() => setIsContextPanelOpen((prev) => !prev)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isContextPanelOpen
                  ? 'bg-[#efe9de] dark:bg-[#22201d] border-[#cc785c]/40 text-[#cc785c]'
                  : 'bg-transparent border-[#e6dfd8] dark:border-[#2d2a25] text-[#6c6a64] dark:text-[#9e998f] hover:bg-[#efe9de] dark:hover:bg-[#22201d]'
              }`}
              title={isContextPanelOpen ? 'Hide Document Intelligence' : 'Show Document Intelligence'}
              aria-label="Toggle Document Intelligence Panel"
            >
              {isContextPanelOpen ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* Workspace Body Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {!showConversationWorkspace ? (
            <div className="flex-1 overflow-y-auto">
              <UploadDropZone
                onFileSelected={handleFileSelected}
                onStartIngestion={handleStartIngestion}
                onReset={handleReset}
                selectedFile={selectedFile}
                currentDocument={currentDocument}
                isUploading={isUploading}
                isIngesting={isIngesting}
                errorMessage={errorMessage}
              />
            </div>
          ) : conversationMode === 'text' ? (
            <TextConversation
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoadingChat}
              document={currentDocument}
              onCitationClick={handleCitationClick}
              onResetSession={() => setMessages([])}
            />
          ) : (
            <VoiceConversation
              document={currentDocument}
              sessionId={currentSession?.id || 'sess_voice'}
              onSwitchToText={() => setConversationMode('text')}
              onCitationClick={handleCitationClick}
            />
          )}

          {/* Mobile Backdrop for Context Panel */}
          {isContextPanelOpen && (
            <div
              onClick={() => setIsContextPanelOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-25 lg:hidden"
            />
          )}

          {/* 3. Right Context Panel ("Document Intelligence") */}
          <div
            className={`fixed inset-y-0 right-0 z-30 lg:static transition-transform duration-300 ease-in-out ${
              isContextPanelOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:hidden'
            }`}
          >
            <ContextPanel
              document={currentDocument}
              sources={activeSources}
              highlightedCitationId={highlightedCitationId}
              isOpen={isContextPanelOpen}
              onClose={() => setIsContextPanelOpen(false)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
