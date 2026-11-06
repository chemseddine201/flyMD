import React from 'react';
import { MessageSquare, Trash2, Plus, Search, Layers, Sliders } from 'lucide-react';
import { DiscussionMetadata, DiscussionStatus } from '../../../../../../shared/types';

export interface DiscussionSessionSidebarProps {
  discussions: DiscussionMetadata[];
  activeSessionId: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredDiscussions: DiscussionMetadata[];
  onSelectSession: (sessionId: string) => void;
  onOpenNewModal: () => void;
  onOpenClearAllModal: () => void;
  onInspectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  getStatusBadge: (status: DiscussionStatus) => React.ReactNode;
}

export const DiscussionSessionSidebar: React.FC<DiscussionSessionSidebarProps> = ({
  discussions,
  activeSessionId,
  searchTerm,
  setSearchTerm,
  filteredDiscussions,
  onSelectSession,
  onOpenNewModal,
  onOpenClearAllModal,
  onInspectSession,
  onDeleteSession,
  getStatusBadge,
}) => {
  return (
    <div className="w-80 h-full border-r border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 flex flex-col shrink-0 min-h-0 overflow-hidden transition-colors duration-150">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-sky-600 dark:text-sky-400" />
          <h2 className="text-xs font-bold tracking-wide text-slate-800 dark:text-slate-200 uppercase">
            Deliberations ({discussions.length})
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {discussions.length > 0 && (
            <button
              type="button"
              onClick={onOpenClearAllModal}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
              title="Clear all deliberations"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenNewModal}
            className="p-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs"
            title="Configure and launch new deliberation"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800/60">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter sessions..."
            className="w-full bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Discussions List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/40">
        {filteredDiscussions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Layers size={28} className="mx-auto mb-2 text-slate-400 dark:text-slate-600 opacity-60" />
            <p className="font-semibold text-slate-800 dark:text-slate-200">No deliberations found</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Start a structured debate with multiple AI models.</p>
            <button
              type="button"
              onClick={onOpenNewModal}
              className="mt-4 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 dark:text-sky-300 dark:border-sky-500/30 text-xs font-semibold transition-colors"
            >
              + Launch Deliberation
            </button>
          </div>
        ) : (
          filteredDiscussions.map((d: DiscussionMetadata) => {
            const isSelected = d.sessionId === activeSessionId;
            return (
              <div
                key={d.sessionId}
                onClick={() => onSelectSession(d.sessionId)}
                className={`p-3 cursor-pointer transition-all group relative ${
                  isSelected
                    ? 'bg-sky-500/10 border-l-2 border-sky-500'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[130px]" title={d.sessionId}>
                    {d.sessionId}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(d.status)}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectSession(d.sessionId);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sky-500/20 text-slate-400 hover:text-sky-500 transition-opacity"
                      title="View details & modify configuration (when paused)"
                    >
                      <Sliders size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(d.sessionId);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-opacity"
                      title="Delete session"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-900 dark:text-slate-200 line-clamp-1 mb-1">
                  {(d as any).topic || 'Multi-Agent Deliberation'}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>Round {d.currentRound}</span>
                  <span>{d.totalMessages} msgs • {d.totalTokens.toLocaleString()} tokens</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

