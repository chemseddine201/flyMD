import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  FileCode,
  FileText,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  AtSign,
} from 'lucide-react';
import { AgentTaskRecord, AgentToolAction } from '../../../../../shared/types';

interface ActionLogTimelineProps {
  task: AgentTaskRecord;
  onOpenFile?: (filePath: string) => void;
}

export const ActionLogTimeline: React.FC<ActionLogTimelineProps> = ({
  task,
  onOpenFile,
}) => {
  const [expandedSummary, setExpandedSummary] = useState<boolean>(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    all: true,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isItemExpanded = (id: string, defaultState = true) => {
    return expandedItems[id] !== undefined ? expandedItems[id] : defaultState;
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toolActions: AgentToolAction[] = task.toolActions || [];
  const thinkingTraces = task.thinkingTrace || [];

  const fileActions = toolActions.filter(
    (a) => a.kind === 'write' || a.kind === 'read' || a.label.toLowerCase().includes('file')
  );
  const cmdActions = toolActions.filter(
    (a) => a.kind === 'cli' || !!a.command || a.label.toLowerCase().includes('run')
  );

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
  };

  const workspaceBaseName = React.useMemo(() => {
    if (!task.workspacePath) return 'workspace';
    const parts = task.workspacePath.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || 'workspace';
  }, [task.workspacePath]);

  // Highlight command syntax like `pwsh -File "path"`
  const renderCommandPrompt = (command: string) => {
    const parts = command.trim().split(' ');
    const cmd = parts[0] || 'pwsh';
    const rest = parts.slice(1).join(' ');

    return (
      <div className="flex items-baseline gap-2 overflow-x-auto text-[11px] font-mono leading-relaxed">
        <span className="text-zinc-500 select-none shrink-0">...\{workspaceBaseName} $</span>
        <span className="text-amber-300 font-semibold shrink-0">{cmd}</span>
        <span className="text-yellow-200/90">{rest}</span>
      </div>
    );
  };

  // Render conversational narrative statements (e.g. "I have launched...")
  const renderNarrativeStatement = (text: string, idx: number) => {
    // Highlight inline tokens like directory names or file names
    const parts = text.split(/(\s+)/);
    return (
      <p key={idx} className="text-xs sm:text-sm font-semibold text-zinc-100 leading-snug py-1">
        {parts.map((part, pIdx) => {
          if (part.startsWith('v2') || part.endsWith('.ps1') || part.endsWith('.js') || part.endsWith('.html') || part.endsWith('.md')) {
            return (
              <span key={pIdx} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-xs border border-zinc-700/60 mx-0.5">
                {part}
              </span>
            );
          }
          return <span key={pIdx}>{part}</span>;
        })}
      </p>
    );
  };

  // Filter conversational narratives vs trace directives
  const narratives = thinkingTraces.filter(
    (t) =>
      t.startsWith('I have ') ||
      t.startsWith('Active: ') ||
      t.startsWith('Live Sync:') ||
      t.startsWith('Plan:')
  );

  return (
    <div className="space-y-3 font-sans text-xs select-text">
      {/* 1. Main Collapsible Activity Block */}
      <div className="rounded-xl border border-zinc-800/90 bg-[#141416] p-3.5 space-y-3 shadow-md">
        {/* Top Summary Pill */}
        <button
          type="button"
          onClick={() => setExpandedSummary(!expandedSummary)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs transition-colors py-0.5 focus:outline-none"
        >
          <span>
            Explored {Math.max(1, fileActions.length)} {fileActions.length === 1 ? 'file' : 'files'}, ran {Math.max(1, cmdActions.length)} {cmdActions.length === 1 ? 'command' : 'commands'}, edited {Math.max(1, fileActions.length)} {fileActions.length === 1 ? 'file' : 'files'}
          </span>
          {expandedSummary ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
        </button>

        {/* Narrative Statement 1 (if available) */}
        {narratives.length > 0 && renderNarrativeStatement(narratives[0], 0)}

        {expandedSummary && (
          <div className="space-y-3 pt-1">
            {/* List of sub-action capsules and terminal drawers */}
            {toolActions.length > 0 ? (
              toolActions.map((action, idx) => {
                const actionId = action.id || `action-${idx}`;
                const isExpanded = isItemExpanded(actionId, true);
                const isCmd = action.kind === 'cli' || !!action.command;
                const isFile = action.kind === 'write' || action.kind === 'read' || action.label.toLowerCase().includes('file');

                return (
                  <div key={actionId} className="space-y-2">
                    {/* Collapsible Action Pill */}
                    <button
                      type="button"
                      onClick={() => toggleItem(actionId)}
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs transition-colors py-0.5 focus:outline-none"
                    >
                      <span>{action.label}</span>
                      {isExpanded ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                    </button>

                    {/* Expanded Drawer */}
                    {isExpanded && (
                      <div className="space-y-2 pl-1">
                        {/* Status Line */}
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                          <span className="font-semibold text-zinc-200">
                            Status: {action.status.toUpperCase()}
                          </span>
                          <span>•</span>
                          <span className="text-zinc-400">
                            Last progress: {formatRelativeTime(action.timestamp)}
                          </span>
                        </div>

                        {/* Terminal / Code Output Card */}
                        {(isCmd || action.output) && (
                          <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-3 text-xs font-mono space-y-2 shadow-inner">
                            {/* Card Top Actions: @ mention and Copy button */}
                            <div className="flex items-center justify-end gap-1 text-zinc-400">
                              <button
                                type="button"
                                onClick={() => handleCopy(`${actionId}-mention`, `@${task.targetAgentId}`)}
                                className="p-1 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                                title="Mention agent"
                              >
                                <AtSign size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(
                                    `${actionId}-clip`,
                                    action.command ? `${action.command}\n\n${action.output || ''}` : action.output || ''
                                  )
                                }
                                className="p-1 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                                title="Copy output"
                              >
                                {copiedId === `${actionId}-clip` ? (
                                  <Check size={13} className="text-emerald-400" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>

                            {/* Shell prompt line */}
                            {action.command && renderCommandPrompt(action.command)}

                            {/* Command output */}
                            {action.output && (
                              <div className="text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-56 select-text text-[11px]">
                                {action.output}
                              </div>
                            )}
                          </div>
                        )}

                        {/* File Action Capsule */}
                        {isFile && action.targetPath && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[11px]">
                            <div className="flex items-center gap-1.5 text-zinc-300 font-mono truncate">
                              <FileText size={12} className="text-sky-400 shrink-0" />
                              <span className="truncate">{action.targetPath}</span>
                            </div>
                            {onOpenFile && (
                              <button
                                type="button"
                                onClick={() => onOpenFile(action.targetPath!)}
                                className="flex items-center gap-1 text-sky-400 hover:text-sky-300 text-[10px] font-medium ml-2 shrink-0"
                              >
                                <span>Open</span>
                                <ExternalLink size={10} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              /* Fallback default items if task has no structured toolActions yet */
              <div className="space-y-2">
                <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                  <span className="font-semibold text-zinc-200">
                    Status: {task.status.toUpperCase()}
                  </span>
                  <span>•</span>
                  <span className="text-zinc-400">
                    Last progress: {formatRelativeTime(task.startedAt || Date.now())}
                  </span>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-[#18181b] p-3 text-xs font-mono space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                    <span className="text-zinc-500">...\{workspaceBaseName} $</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('fb-clip', task.workspacePath || '')}
                      className="p-1 hover:text-zinc-100 rounded"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <div className="text-zinc-300 whitespace-pre-wrap text-[11px]">
                    {task.status === 'running'
                      ? 'Process actively executing task commands in workspace...'
                      : `Task completed successfully on workspace files.`}
                  </div>
                </div>
              </div>
            )}

            {/* Additional Narrative Statements */}
            {narratives.slice(1).map((narrative, nIdx) =>
              renderNarrativeStatement(narrative, nIdx + 1)
            )}
          </div>
        )}
      </div>

      {/* 2. Live Process Progress Indicator (Active when running) */}
      {task.status === 'running' && (
        <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-950/20 flex items-center justify-between gap-3 shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5 min-w-0">
            <Loader2 size={14} className="text-sky-400 animate-spin shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-sky-200 truncate">
                {task.thinkingTrace && task.thinkingTrace.length > 0
                  ? task.thinkingTrace[task.thinkingTrace.length - 1]
                  : 'Workspace execution active...'}
              </div>
              <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                Working directory: <span className="font-mono text-zinc-300">{task.workspacePath}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40">
              {task.progressPercent ?? 60}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

