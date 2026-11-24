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
      className={`fixed lg:static top-0 bottom-0 left-0 z-40 transition-all duration-300 ease-in-out border-r border-[#e7e5e4] dark:border-[#27272a] bg-[#f5f5f5] dark:bg-[#0c0a09] flex flex-col ${
        isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'w-72 translate-x-0'
      }`}
    >
      {/* Top Header */}
      <div className="p-4 border-b border-[#e7e5e4] dark:border-[#27272a] flex items-center justify-between">
        <BrandLogo compact={isCollapsed} />
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-full hover:bg-[#f0efed] dark:hover:bg-[#1c1917] text-[#777169] dark:text-[#a8a29e] transition-colors"
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
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#292524] hover:bg-[#0c0a09] dark:bg-[#f5f5f5] dark:text-[#0c0a09] dark:hover:bg-white text-white font-sans-editorial font-medium text-sm shadow-xs transition-all active:scale-[0.98]"
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
            <div className="text-[11px] font-sans-editorial font-semibold uppercase tracking-wider text-[#777169] dark:text-[#a8a29e] px-2 mb-1.5">
              Current Document
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-[#1c1917] border border-[#e7e5e4] dark:border-[#27272a] shadow-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#f0efed] dark:bg-[#292524] flex items-center justify-center text-[#292524] dark:text-[#f5f5f5] shrink-0 mt-0.5">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#0c0a09] dark:text-[#f5f5f5] truncate">
                    {currentDocument.filename}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        currentDocument.status === 'ready'
                          ? 'bg-[#16a34a]/10 text-[#16a34a] dark:text-[#22c55e]'
                          : currentDocument.status === 'ingesting'
                          ? 'bg-[#777169]/10 text-[#777169] dark:text-[#a8a29e]'
                          : currentDocument.status === 'error'
                          ? 'bg-[#dc2626]/10 text-[#dc2626]'
                          : 'bg-[#f0efed] text-[#777169]'
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
                    <span className="text-[10px] text-[#777169] dark:text-[#a8a29e]">
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
            <div className="text-[11px] font-sans-editorial font-semibold uppercase tracking-wider text-[#777169] dark:text-[#a8a29e] px-2 mb-1.5 flex items-center justify-between">
              <span>Recent Documents</span>
              <span className="text-[10px] font-normal">{documents.length}</span>
            </div>
          )}

          {documents.length === 0 ? (
            !isCollapsed && (
              <div className="px-3 py-6 text-center text-xs text-[#777169] dark:text-[#a8a29e] border border-dashed border-[#e7e5e4] dark:border-[#27272a] rounded-xl">
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
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                      isActive
                        ? 'bg-white dark:bg-[#1c1917] font-medium text-[#0c0a09] dark:text-[#f5f5f5] shadow-xs border border-[#e7e5e4] dark:border-[#27272a]'
                        : 'hover:bg-white/60 dark:hover:bg-[#141210] text-[#4e4e4e] dark:text-[#d6d3d1]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#f0efed] dark:bg-[#292524] flex items-center justify-center shrink-0">
                        <FileText
                          className={`w-3 h-3 ${
                            isActive ? 'text-[#0c0a09] dark:text-white' : 'text-[#777169] dark:text-[#a8a29e]'
                          }`}
                        />
                      </div>
                      {!isCollapsed && (
                        <span className="truncate max-w-[130px]">{doc.filename}</span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDocument(doc.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#777169] hover:text-[#dc2626] transition-opacity"
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
      <div className="p-3 border-t border-[#e7e5e4] dark:border-[#27272a] space-y-2">
        {/* MCP Architecture Status Badge */}
        {!isCollapsed && (
          <div className="px-3 py-2 rounded-xl bg-white dark:bg-[#1c1b18] border border-[#e7e5e4] dark:border-[#27272a] flex items-center gap-2.5 shadow-xs">
            <Cpu className="w-3.5 h-3.5 text-[#292524] dark:text-[#f5f5f5] shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold text-[#0c0a09] dark:text-[#f5f5f5] flex items-center gap-1.5">
                <span>MCP Protocol</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] inline-block" />
              </div>
              <p className="text-[9px] text-[#777169] dark:text-[#a8a29e] truncate">
                Ingestion & Query MCP Hooks
              </p>
            </div>
          </div>
        )}

        {/* Dev Mock Mode Toggle */}
        {!isCollapsed && (
          <button
            onClick={onToggleMock}
            className="w-full px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-[#1c1b18] flex items-center justify-between text-xs text-[#4e4e4e] dark:text-[#d6d3d1] transition-colors"
            title="Toggle client-side mock simulation for testing without backend"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#777169]" />
              <span className="text-[11px]">Dev Mock Mode</span>
            </div>
            {isMock ? (
              <ToggleRight className="w-4 h-4 text-[#292524] dark:text-white" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-[#a8a29e]" />
            )}
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center justify-center lg:justify-start gap-2.5 p-2 rounded-xl hover:bg-white dark:hover:bg-[#1c1b18] text-xs font-sans-editorial text-[#4e4e4e] dark:text-[#d6d3d1] transition-colors"
          title={isDark ? 'Switch to Off-white Canvas' : 'Switch to Dark Deep'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-[#f4c5a8]" />
          ) : (
            <Moon className="w-4 h-4 text-[#777169]" />
          )}
          {!isCollapsed && (
            <span>{isDark ? 'Light Canvas' : 'Dark Deep'}</span>
          )}
        </button>
      </div>
    </aside>
  );
};
