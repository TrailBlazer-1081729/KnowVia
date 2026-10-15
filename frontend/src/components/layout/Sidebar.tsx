import React from 'react';
import {
  Plus,
  FileText,
  Trash2,
  Sun,
  Moon,
  Cpu,
  Layers,
  ChevronLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { DocumentMetadata } from '../../types';
import { BrandLogo } from '../common/BrandLogo';

interface SidebarProps {
  currentDocument: DocumentMetadata | null;
  documents: DocumentMetadata[];
  onSelectDocument: (doc: DocumentMetadata) => void;
  onNewSession: () => void;
  onDeleteDocument: (docId: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isMock: boolean;
  onToggleMock: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentDocument,
  documents,
  onSelectDocument,
  onNewSession,
  onDeleteDocument,
  isDark,
  onToggleTheme,
  isMock,
  onToggleMock,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`fixed lg:static top-0 bottom-0 left-0 z-40 transition-all duration-300 ease-in-out border-r border-[#e6dfd8] dark:border-[#2d2a25] bg-[#faf9f5] dark:bg-[#121211] flex flex-col ${
        isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'w-72 translate-x-0'
      }`}
    >
      {/* Top Header */}
      <div className="p-4 border-b border-[#e6dfd8] dark:border-[#2d2a25] flex items-center justify-between">
        <BrandLogo compact={isCollapsed} />
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-[#efe9de] dark:hover:bg-[#22201d] text-[#6c6a64] dark:text-[#9e998f] transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label="Toggle Sidebar"
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-200 ${
              isCollapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* New Session Action */}
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#cc785c] hover:bg-[#a9583e] text-white font-sans-body font-medium text-sm shadow-sm transition-all duration-150 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>New Session</span>}
        </button>
      </div>

      {/* Navigation & Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {/* Active Document Section */}
        {currentDocument && !isCollapsed && (
          <div>
            <div className="text-[11px] font-sans-body font-semibold uppercase tracking-wider text-[#6c6a64] dark:text-[#9e998f] px-2 mb-1.5">
              Current Document
            </div>
            <div className="p-2.5 rounded-lg bg-[#efe9de] dark:bg-[#1c1b18] border border-[#e6dfd8] dark:border-[#2d2a25] shadow-xs">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-[#cc785c] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#141413] dark:text-[#faf9f5] truncate">
                    {currentDocument.filename}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        currentDocument.status === 'ready'
                          ? 'bg-[#5db872]/15 text-[#5db872]'
                          : currentDocument.status === 'ingesting'
                          ? 'bg-[#e8a55a]/15 text-[#e8a55a]'
                          : currentDocument.status === 'error'
                          ? 'bg-[#c64545]/15 text-[#c64545]'
                          : 'bg-[#6c6a64]/15 text-[#6c6a64]'
                      }`}
                    >
                      {currentDocument.status === 'ready' && (
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      )}
                      {currentDocument.status === 'ingesting' && (
                        <Clock className="w-2.5 h-2.5 animate-spin" />
                      )}
                      {currentDocument.status === 'error' && (
                        <AlertCircle className="w-2.5 h-2.5" />
                      )}
                      {currentDocument.status}
                    </span>
                    <span className="text-[10px] text-[#6c6a64] dark:text-[#9e998f]">
                      {currentDocument.page_count} {currentDocument.page_count === 1 ? 'page' : 'pages'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Research Documents */}
        <div>
          {!isCollapsed && (
            <div className="text-[11px] font-sans-body font-semibold uppercase tracking-wider text-[#6c6a64] dark:text-[#9e998f] px-2 mb-1.5 flex items-center justify-between">
              <span>Recent Documents</span>
              <span className="text-[10px] font-normal">{documents.length}</span>
            </div>
          )}

          {documents.length === 0 ? (
            !isCollapsed && (
              <div className="px-3 py-6 text-center text-xs text-[#6c6a64] dark:text-[#9e998f] border border-dashed border-[#e6dfd8] dark:border-[#2d2a25] rounded-lg">
                No recent documents.
                <br />
                Drop a PDF to begin.
              </div>
            )
          ) : (
            <div className="space-y-1">
              {documents.map((doc) => {
                const isActive = currentDocument?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDocument(doc)}
                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                      isActive
                        ? 'bg-[#efe9de] dark:bg-[#22201d] font-medium text-[#141413] dark:text-[#faf9f5]'
                        : 'hover:bg-[#f5f0e8] dark:hover:bg-[#1a1917] text-[#3d3d3a] dark:text-[#cfcbc2]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-[#cc785c]' : 'text-[#6c6a64] dark:text-[#9e998f]'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate max-w-[140px]">{doc.filename}</span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDocument(doc.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#6c6a64] hover:text-[#c64545] transition-opacity"
                        title="Delete document"
                        aria-label="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info & Controls */}
      <div className="p-3 border-t border-[#e6dfd8] dark:border-[#2d2a25] space-y-2">
        {/* MCP Architecture Status Badge */}
        {!isCollapsed && (
          <div className="px-2.5 py-1.5 rounded-md bg-[#f5f0e8] dark:bg-[#1a1917] border border-[#e6dfd8] dark:border-[#2d2a25] flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-[#5db8a6] shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold text-[#141413] dark:text-[#faf9f5] flex items-center gap-1">
                <span>MCP Protocol</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#5db872] inline-block" />
              </div>
              <p className="text-[9px] text-[#6c6a64] dark:text-[#9e998f] truncate">
                Ingestion & Query MCP Hooks
              </p>
            </div>
          </div>
        )}

        {/* Dev Mock Mode Toggle */}
        {!isCollapsed && (
          <button
            onClick={onToggleMock}
            className="w-full px-2.5 py-1.5 rounded-md hover:bg-[#f5f0e8] dark:hover:bg-[#1a1917] flex items-center justify-between text-xs text-[#3d3d3a] dark:text-[#cfcbc2] transition-colors"
            title="Toggle client-side mock simulation for testing without backend"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#cc785c]" />
              <span className="text-[11px]">Dev Mock Mode</span>
            </div>
            {isMock ? (
              <ToggleRight className="w-4 h-4 text-[#cc785c]" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-[#6c6a64]" />
            )}
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center justify-center lg:justify-start gap-2 p-2 rounded-lg hover:bg-[#f5f0e8] dark:hover:bg-[#1a1917] text-xs font-sans-body text-[#3d3d3a] dark:text-[#cfcbc2] transition-colors"
          title={isDark ? 'Switch to Cream Light' : 'Switch to Obsidian Dark'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-[#e8a55a]" />
          ) : (
            <Moon className="w-4 h-4 text-[#6c6a64]" />
          )}
          {!isCollapsed && (
            <span>{isDark ? 'Editorial Cream Light' : 'Obsidian Dark'}</span>
          )}
        </button>
      </div>
    </aside>
  );
};
