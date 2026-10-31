import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Circle,
  ShieldCheck,
  RotateCcw,
  FileText,
  Terminal,
  ListChecks,
  Play,
  ExternalLink,
  Trash2,
  Globe,
  FileCode,
  FolderOpen,
  Activity,
  Layers,
  Sparkles,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import {
  AgentCheckpoint,
  AgentTaskRecord,
  ScannedMdFile,
} from '../../../../../shared/types';
import {
  SidebarContextMenuTarget,
  SidebarItemContextMenu,
} from '../../sidebar/SidebarItemContextMenu';

interface AgentProgressInspectorProps {
  selectedTask: AgentTaskRecord | null;
  checkpoints: AgentCheckpoint[];
  restoringCheckpointId: string | null;
  onRestoreCheckpoint: (checkpointId: string) => void;
  onClearTaskLogs: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<void> | void;
  onCancelTask?: (taskId: string) => void;
  onRecoverTask?: (
    task: AgentTaskRecord,
    mode: 'continue_from_breakpoint' | 'revert_and_retry' | 'ask'
  ) => void;
  activeMarkdownContent: string;
  watchedFiles?: ScannedMdFile[];
  onRunSingleChecklistItem: (itemText: string) => void;
  onOpenFileInEditor: (filePath?: string) => void;
  onSelectWatchedFileForDispatch?: (file: ScannedMdFile) => void;
  onDeleteWorkspaceFile?: (filePath: string) => Promise<void> | void;
  width?: number;
  isPipelineRunning?: boolean;
}

interface TouchedFile {
  name: string;
  fullPath: string;
  isHtml: boolean;
  status: 'created' | 'modified';
  toolLabel?: string;
}

const PROGRESS_STAGES = [
  { id: 'snapshot', label: '1. Safety Snapshot & Git Guard', minPct: 15 },
  { id: 'context', label: '2. Workspace & IDE Workflow Sync', minPct: 35 },
  { id: 'reasoning', label: '3. Agent Context Reasoning', minPct: 55 },
  { id: 'executing', label: '4. Synthesizing Output & Files', minPct: 80 },
  { id: 'completed', label: '5. Verified & Saved to Workspace', minPct: 100 },
];

export const AgentProgressInspector: React.FC<AgentProgressInspectorProps> = ({
  selectedTask,
  checkpoints,
  restoringCheckpointId,
  onRestoreCheckpoint,
  onClearTaskLogs,
  onDeleteTask,
  onCancelTask,
  onRecoverTask,
  activeMarkdownContent,
  onRunSingleChecklistItem,
  onOpenFileInEditor,
  onDeleteWorkspaceFile,
  width,
  isPipelineRunning = false,
}) => {
  const [contextTarget, setContextTarget] =
    useState<SidebarContextMenuTarget | null>(null);
  const [viewTab, setViewTab] = useState<'activity' | 'terminal'>('activity');
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [copiedErrorLog, setCopiedErrorLog] = useState<boolean>(false);
  const [showStderrTrace, setShowStderrTrace] = useState<boolean>(false);

  useEffect(() => {
    if (selectedTask?.status === 'running') {
      const start = selectedTask.startedAt || selectedTask.createdAt || Date.now();
      const updateTimer = () => {
        const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
        setElapsedSec(diff);
      };
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsedSec(0);
    }
  }, [selectedTask?.status, selectedTask?.startedAt, selectedTask?.createdAt]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const pct = selectedTask
    ? selectedTask.progressPercent ??
      (selectedTask.status === 'completed' ? 100 : 25)
    : 0;

  const checkpoint = selectedTask?.checkpointId
    ? checkpoints.find((c) => c.id === selectedTask.checkpointId)
    : undefined;

  // Extract checklist items from markdown source
  const parsedChecklist = useMemo(() => {
    const source =
      selectedTask?.responseMarkdown || activeMarkdownContent || '';
    const items: { text: string; done: boolean }[] = [];
    source.split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (t.startsWith('- [ ] ') || t.startsWith('* [ ] ')) {
        items.push({ text: t.slice(6).trim(), done: false });
      } else if (
        t.startsWith('- [x] ') ||
        t.startsWith('- [X] ') ||
        t.startsWith('* [x] ') ||
        t.startsWith('* [X] ')
      ) {
        items.push({ text: t.slice(6).trim(), done: true });
      }
    });
    return items;
  }, [selectedTask?.responseMarkdown, activeMarkdownContent]);

  // Antigravity-Style: Extract files touched and created by the agent
  const touchedFiles = useMemo<TouchedFile[]>(() => {
    if (!selectedTask) return [];
    const map = new Map<string, TouchedFile>();
    const ws = (selectedTask.workspacePath || '').replace(/\\/g, '/');

    // 1. Inspect toolActions
    if (selectedTask.toolActions) {
      for (const action of selectedTask.toolActions) {
        if (action.targetPath) {
          const rawPath = action.targetPath.replace(/\\/g, '/');
          // Ignore internal dot-folders and dot-files
          if (
            rawPath.includes('/.flymd') ||
            rawPath.includes('/.') ||
            rawPath.startsWith('.')
          ) {
            continue;
          }
          const name = rawPath.split('/').pop() || rawPath;
          const isHtml =
            name.toLowerCase().endsWith('.html') ||
            name.toLowerCase().endsWith('.htm');
          const fullPath =
            action.targetPath.includes(':') || action.targetPath.startsWith('/')
              ? action.targetPath
              : ws
              ? `${ws}/${action.targetPath}`
              : action.targetPath;

          const status: 'created' | 'modified' = action.label
            .toLowerCase()
            .includes('create')
            ? 'created'
            : 'modified';

          map.set(name.toLowerCase(), {
            name,
            fullPath,
            isHtml,
            status,
            toolLabel: action.label,
          });
        }
      }
    }

    // 2. Inspect logs for file creation notices
    if (selectedTask.logs) {
      for (const log of selectedTask.logs) {
        const createdMatch = log.match(/Created file:\s*`?([^`\r\n]+)`?/i);
        if (createdMatch && createdMatch[1]) {
          const raw = createdMatch[1].trim().replace(/\\/g, '/');
          if (!raw.includes('/.') && !raw.startsWith('.')) {
            const name = raw.split('/').pop() || raw;
            const fullPath =
              raw.includes(':') || raw.startsWith('/')
                ? raw
                : ws
                ? `${ws}/${raw}`
                : raw;
            const isHtml =
              name.toLowerCase().endsWith('.html') ||
              name.toLowerCase().endsWith('.htm');
            if (!map.has(name.toLowerCase())) {
              map.set(name.toLowerCase(), {
                name,
                fullPath,
                isHtml,
                status: 'created',
                toolLabel: `Created ${name}`,
              });
            }
          }
        }
      }
    }

    // 2b. Include explicit modifiedFiles from task record or errorDiagnostic
    const recordedModFiles = [
      ...(selectedTask.modifiedFiles || []),
      ...(selectedTask.errorDiagnostic?.modifiedFiles || []),
      ...(selectedTask.verificationReport?.checkedFiles || []),
    ];
    for (const rawMod of recordedModFiles) {
      const raw = rawMod.trim().replace(/\\/g, '/');
      if (!raw || raw.includes('/.') || raw.startsWith('.')) continue;
      const name = raw.split('/').pop() || raw;
      if (!map.has(name.toLowerCase())) {
        const fullPath =
          raw.includes(':') || raw.startsWith('/')
            ? raw
            : ws
            ? `${ws}/${raw}`
            : raw;
        const isHtml =
          name.toLowerCase().endsWith('.html') ||
          name.toLowerCase().endsWith('.htm');
        map.set(name.toLowerCase(), {
          name,
          fullPath,
          isHtml,
          status: 'modified',
          toolLabel: `Modified ${name}`,
        });
      }
    }

    // 3. Fallback: If markdown contains HTML code block and no html file registered yet, link index.html
    if (
      selectedTask.responseMarkdown &&
      selectedTask.responseMarkdown.includes('```html')
    ) {
      if (!map.has('index.html')) {
        map.set('index.html', {
          name: 'index.html',
          fullPath: ws ? `${ws}/index.html` : 'index.html',
          isHtml: true,
          status: 'created',
          toolLabel: 'Synthesized HTML block',
        });
      }
    }

    return Array.from(map.values());
  }, [selectedTask]);

  // Live preview handler: open in system default browser & in editor
  const handleLivePreview = async (file: TouchedFile) => {
    try {
      if (window.electronAPI?.openExternalPath) {
        await window.electronAPI.openExternalPath(file.fullPath);
      } else if (window.electronAPI?.revealInExplorer) {
        await window.electronAPI.revealInExplorer(file.fullPath);
      }
      onOpenFileInEditor(file.fullPath);
    } catch (err) {
      console.error('Failed to open live preview:', err);
      onOpenFileInEditor(file.fullPath);
    }
  };

  return (
    <aside
      style={{ width: `${width || 340}px` }}
      className="shrink-0 h-full border-l border-slate-800/90 bg-slate-900/75 flex flex-col p-3.5 space-y-3.5 select-none overflow-hidden"
    >
      {/* 1. Live Progress & Git Guard Stepper */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-sky-400" />
            Live Progress View
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-sky-300">{pct}%</span>
            {selectedTask && selectedTask.status !== 'running' && !isPipelineRunning && onDeleteTask && (
              <button
                type="button"
                onClick={() => onDeleteTask(selectedTask.id)}
                className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                title="Delete this finished task session"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-300 ${
              selectedTask?.status === 'running' ? 'animate-pulse' : ''
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Live Execution & Background Tracking Monitor Card */}
        {selectedTask?.status === 'running' && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-950/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-sky-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
                <span>Live Execution</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <Clock size={11} />
                  <span>{formatTimer(elapsedSec)}</span>
                </span>
                {onCancelTask && (
                  <button
                    type="button"
                    onClick={() => onCancelTask(selectedTask.id)}
                    className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[10px] font-bold transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-200 font-medium leading-tight">
              {selectedTask.progressStage === 'snapshot' && 'Creating safety snapshot & Git guard...'}
              {selectedTask.progressStage === 'context' && 'Synchronizing workspace specification & MEMORY.md...'}
              {selectedTask.progressStage === 'reasoning' && 'Agent reasoning engine analyzing context, AST & invariants...'}
              {selectedTask.progressStage === 'executing' && 'Writing workspace files & streaming Markdown response...'}
              {(!selectedTask.progressStage || selectedTask.progressStage === 'completed') && 'Running active task...'}
            </div>

            {/* Live Streaming Activity Ticker */}
            <div className="rounded-lg bg-slate-950/90 border border-slate-800/80 p-2 text-[10px] font-mono space-y-1 max-h-24 overflow-y-auto">
              {selectedTask.logs && selectedTask.logs.length > 0 ? (
                selectedTask.logs.slice(-3).map((log, lIdx) => (
                  <div key={lIdx} className="text-slate-300 truncate flex items-center gap-1">
                    <span className="text-sky-400 select-none">&gt;</span>
                    <span className="truncate">{log}</span>
                  </div>
                ))
              ) : selectedTask.thinkingTrace && selectedTask.thinkingTrace.length > 0 ? (
                selectedTask.thinkingTrace.slice(-2).map((trace, tIdx) => (
                  <div key={tIdx} className="text-indigo-300 truncate flex items-center gap-1">
                    <span className="text-indigo-400 select-none">&bull;</span>
                    <span className="truncate">{trace}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 flex items-center gap-1">
                  <span className="animate-pulse">_</span>
                  <span>Awaiting subprocess stream output...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5 Stages Stepper */}
        <div className="space-y-1 pt-0.5">
          {PROGRESS_STAGES.map((stage) => {
            const isDone =
              pct >= stage.minPct || selectedTask?.status === 'completed';
            const isCurrent =
              selectedTask?.status === 'running' &&
              selectedTask?.progressStage === stage.id;

            return (
              <div
                key={stage.id}
                className={`flex items-center justify-between text-[11px] px-2 py-1 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30'
                    : isDone
                    ? 'text-emerald-300 font-medium'
                    : 'text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCurrent ? (
                    <Loader2 size={12} className="text-sky-400 animate-spin shrink-0" />
                  ) : isDone ? (
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Circle size={12} className="text-slate-600 shrink-0" />
                  )}
                  <span className="truncate">{stage.label}</span>
                </div>
                {isCurrent && (
                  <span className="text-[10px] font-mono text-sky-400 shrink-0">
                    {formatTimer(elapsedSec)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Checkpoint Safety Restore Point */}
        {checkpoint && !checkpoint.restored && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-[10px] text-emerald-300 flex items-center gap-1">
              <ShieldCheck size={11} /> Restore Point Ready
            </span>
            <button
              type="button"
              disabled={restoringCheckpointId === checkpoint.id}
              onClick={() => onRestoreCheckpoint(checkpoint.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-bold transition-colors"
            >
              <RotateCcw size={10} />
              {restoringCheckpointId === checkpoint.id
                ? 'Restoring...'
                : 'Undo Changes'}
            </button>
          </div>
        )}
      </div>

      {/* 2. Antigravity-Style Files Progress Deck (Files Touched & Created) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Globe size={13} className="text-emerald-400" />
            Files Touched &amp; Created ({touchedFiles.length})
          </span>
          {touchedFiles.some((f) => f.isHtml) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Web Ready
            </span>
          )}
        </div>

        {touchedFiles.length === 0 ? (
          <div className="text-[11px] text-slate-500 py-2.5 text-center border border-dashed border-slate-800/80 rounded-xl px-2">
            Files created or edited by the agent (e.g. <span className="text-sky-300 font-mono">index.html</span>) appear here with 1-click live preview.
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5">
            {touchedFiles.map((file) => (
              <div
                key={file.fullPath}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextTarget({
                    x: e.clientX,
                    y: e.clientY,
                    title: file.name,
                    subtitle: file.isHtml
                      ? 'Web Application Page'
                      : 'Workspace File',
                    filePath: file.fullPath,
                    deleteLabel: 'Delete File from Disk...',
                    onOpen: () => onOpenFileInEditor(file.fullPath),
                    onDeleteConfirm: async () => {
                      if (onDeleteWorkspaceFile) {
                        await onDeleteWorkspaceFile(file.fullPath);
                      } else if (window.electronAPI?.deleteFilePath) {
                        await window.electronAPI.deleteFilePath(file.fullPath);
                      }
                    },
                  });
                }}
                className="group flex flex-col gap-1.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {file.isHtml ? (
                      <Globe size={13} className="text-emerald-400 shrink-0" />
                    ) : file.name.endsWith('.css') ? (
                      <Layers size={13} className="text-sky-400 shrink-0" />
                    ) : file.name.endsWith('.js') || file.name.endsWith('.ts') ? (
                      <FileCode size={13} className="text-amber-400 shrink-0" />
                    ) : (
                      <FileText size={13} className="text-slate-400 shrink-0" />
                    )}
                    <span
                      className="truncate text-[11px] font-semibold text-slate-200"
                      title={file.fullPath}
                    >
                      {file.name}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide shrink-0 ${
                      file.status === 'created'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {file.status}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  {file.isHtml && (
                    <button
                      type="button"
                      onClick={() => handleLivePreview(file)}
                      title="Launch live web preview in browser"
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold transition-all"
                    >
                      <Globe size={10} />
                      <span>Live Preview</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenFileInEditor(file.fullPath)}
                    title="Open file in FlyMD editor"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white text-[10px] font-medium transition-colors"
                  >
                    <ExternalLink size={10} />
                    <span>FlyMD</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.electronAPI?.revealInExplorer) {
                        await window.electronAPI.revealInExplorer(file.fullPath);
                      }
                    }}
                    title="Reveal in File Explorer"
                    className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-400 hover:text-white transition-colors"
                  >
                    <FolderOpen size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Combined Clean Activity & Process Inspector (Human Feed + Terminal Stream) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800/90 px-3 py-2 bg-slate-950/60">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewTab('activity')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                viewTab === 'activity'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity size={11} />
              <span>Activity &amp; Process</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('terminal')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                viewTab === 'terminal'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal size={11} />
              <span>Terminal Stream</span>
            </button>
          </div>

          {viewTab === 'terminal' && selectedTask && selectedTask.logs.length > 0 && (
            <button
              type="button"
              onClick={() => onClearTaskLogs(selectedTask.id)}
              title="Clear Terminal Execution Log"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-rose-500/20 text-[9px] font-bold text-slate-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 size={9} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {viewTab === 'activity' ? (
            <div className="space-y-3">
              {/* Context Reasoning Trace */}
              {selectedTask?.thinkingTrace && selectedTask.thinkingTrace.length > 0 && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                    <Sparkles size={11} className="text-indigo-400" />
                    Agent Context Reasoning
                  </div>
                  <div className="space-y-1">
                    {selectedTask.thinkingTrace.map((step, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] text-indigo-200/90 leading-relaxed pl-2 border-l border-indigo-500/30"
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task Checklist Tracker */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ListChecks size={12} className="text-emerald-400" />
                    Task Checklist ({parsedChecklist.filter((i) => i.done).length}/
                    {parsedChecklist.length})
                  </span>
                </div>

                {parsedChecklist.length === 0 ? (
                  <div className="text-[11px] text-slate-500 py-1 text-center italic">
                    No active checklist steps in document.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {parsedChecklist.map((item, idx) => (
                      <div
                        key={idx}
                        className="group flex items-start justify-between gap-1.5 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-[11px]"
                      >
                        <div className="flex items-start gap-1.5 min-w-0">
                          {item.done ? (
                            <CheckCircle2
                              size={12}
                              className="text-emerald-400 shrink-0 mt-0.5"
                            />
                          ) : (
                            <Circle
                              size={12}
                              className="text-slate-500 shrink-0 mt-0.5"
                            />
                          )}
                          <span
                            className={
                              item.done
                                ? 'text-slate-400 line-through'
                                : 'text-slate-200'
                            }
                          >
                            {item.text}
                          </span>
                        </div>
                        {!item.done && (
                          <button
                            type="button"
                            onClick={() => onRunSingleChecklistItem(item.text)}
                            title="Execute this specific step"
                            className="opacity-0 group-hover:opacity-100 shrink-0 px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[9px] font-bold flex items-center gap-0.5 transition-all"
                          >
                            <Play size={8} fill="currentColor" /> Run
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Outcome & Clean Error / Exception Diagnostic Card */}
              {selectedTask && (() => {
                const isErrorState =
                  selectedTask.status === 'incomplete' ||
                  selectedTask.status === 'failed';
                const diag = selectedTask.errorDiagnostic;
                const fallbackStderrLines = (selectedTask.logs || []).filter(
                  (l) =>
                    l.includes('[stderr]') ||
                    l.includes('[Hang Watchdog]') ||
                    l.includes('[Process Error]') ||
                    l.includes('[CLI Error]') ||
                    l.includes('[Verification Gate]') ||
                    l.toLowerCase().includes('error') ||
                    l.toLowerCase().includes('exception')
                );
                const stderrLines =
                  diag?.stderrTrace && diag.stderrTrace.length > 0
                    ? diag.stderrTrace
                    : fallbackStderrLines;
                const exceptionMsg =
                  diag?.exceptionMessage ||
                  selectedTask.error ||
                  selectedTask.outcomeReason ||
                  fallbackStderrLines[fallbackStderrLines.length - 1] ||
                  'Task stopped before all deliverables were verified.';
                const lastActivity =
                  diag?.lastKnownActivity ||
                  (selectedTask.toolActions && selectedTask.toolActions.length > 0
                    ? selectedTask.toolActions[selectedTask.toolActions.length - 1]
                        .label
                    : selectedTask.thinkingTrace &&
                      selectedTask.thinkingTrace.length > 0
                    ? selectedTask.thinkingTrace[
                        selectedTask.thinkingTrace.length - 1
                      ]
                    : undefined);

                const handleCopyDiagnostic = async () => {
                  const fullReport = [
                    `=== FlyMD Task Exception & Error Diagnostic ===`,
                    `Task ID: ${selectedTask.id}`,
                    `Agent: ${selectedTask.targetAgentId} (${selectedTask.intent})`,
                    `Status: ${selectedTask.status.toUpperCase()}`,
                    `Category: ${diag?.category || 'execution_interrupted'}`,
                    diag?.exitCode !== undefined ? `Exit Code: ${diag.exitCode}` : '',
                    diag?.cliSessionId ? `CLI Session ID: ${diag.cliSessionId}` : '',
                    `Title: ${diag?.title || 'Task Execution Interrupted'}`,
                    `Exception Message: ${exceptionMsg}`,
                    lastActivity ? `Last Active Breakpoint: ${lastActivity}` : '',
                    touchedFiles.length > 0
                      ? `Modified Files (${touchedFiles.length}): ${touchedFiles.map((f) => f.name).join(', ')}`
                      : 'Modified Files: None',
                    stderrLines.length > 0
                      ? `\n--- Trace / Stderr Log ---\n${stderrLines.join('\n')}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('\n');
                  try {
                    await navigator.clipboard.writeText(fullReport);
                    setCopiedErrorLog(true);
                    setTimeout(() => setCopiedErrorLog(false), 2000);
                  } catch {}
                };

                return (
                  <div
                    className={`rounded-xl p-2.5 border text-[11px] flex flex-col gap-2 ${
                      selectedTask.status === 'completed'
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : selectedTask.status === 'incomplete'
                        ? 'bg-amber-950/35 border-amber-500/60 text-amber-200'
                        : selectedTask.status === 'running'
                        ? 'bg-sky-950/20 border-sky-500/30 text-sky-300'
                        : selectedTask.status === 'failed'
                        ? 'bg-rose-950/35 border-rose-500/60 text-rose-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold min-w-0">
                        {selectedTask.status === 'running' ? (
                          <Loader2 size={13} className="animate-spin shrink-0 text-sky-400" />
                        ) : selectedTask.status === 'completed' ? (
                          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                        ) : selectedTask.status === 'incomplete' ? (
                          <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                        ) : selectedTask.status === 'failed' ? (
                          <AlertCircle size={14} className="shrink-0 text-rose-400" />
                        ) : null}
                        <span className="leading-snug">
                          {selectedTask.status === 'completed'
                            ? 'Task completed. Deliverables verified on disk.'
                            : isErrorState
                            ? diag?.title ||
                              (selectedTask.status === 'incomplete'
                                ? 'Deliverable Incomplete / Execution Interrupted'
                                : 'Task Execution Failed')
                            : selectedTask.status === 'running'
                            ? 'Agent actively processing instructions...'
                            : `Task status: ${selectedTask.status}`}
                        </span>
                      </div>

                      {isErrorState && (
                        <button
                          type="button"
                          onClick={handleCopyDiagnostic}
                          title="Copy clean error & exception log to clipboard"
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-[9px] font-bold text-slate-300 hover:text-white transition-colors"
                        >
                          {copiedErrorLog ? (
                            <>
                              <Check size={10} className="text-emerald-400" />
                              <span className="text-emerald-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={10} />
                              <span>Copy Log</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Clean Exception & Diagnostic Block when Failed or Incomplete */}
                    {isErrorState && (
                      <div className="space-y-2 pt-1">
                        {/* Category & Exit Code Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700/80 text-[9px] font-mono font-bold uppercase text-amber-300">
                            {diag?.category || selectedTask.status}
                          </span>
                          {diag?.exitCode !== undefined && diag?.exitCode !== null && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-[9px] font-mono font-bold text-rose-300">
                              Exit Code: {diag.exitCode}
                            </span>
                          )}
                          {touchedFiles.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/40 text-[9px] font-mono text-indigo-300">
                              {touchedFiles.length} file(s) modified
                            </span>
                          )}
                        </div>

                        {/* Clean Exception Message Box */}
                        <div className="rounded-lg bg-slate-950/90 border border-slate-800/90 p-2 font-mono text-[10px] text-rose-200/95 leading-relaxed break-words select-text">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                            Exception / Error Reason:
                          </div>
                          {exceptionMsg}
                        </div>

                        {/* Last Known Activity Breakpoint */}
                        {lastActivity && (
                          <div className="text-[10px] text-slate-300 bg-slate-950/60 border border-slate-800/70 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
                            <Clock size={11} className="text-sky-400 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="font-bold text-sky-300">Last Breakpoint: </span>
                              <span className="font-mono text-slate-200 break-words">
                                {lastActivity}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Collapsible Stderr / Exception Trace */}
                        {stderrLines.length > 0 && (
                          <div className="rounded-lg border border-slate-800/90 bg-slate-950/80 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setShowStderrTrace((prev) => !prev)}
                              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white bg-slate-900/70 transition-colors"
                            >
                              <span className="flex items-center gap-1">
                                {showStderrTrace ? (
                                  <ChevronDown size={11} />
                                ) : (
                                  <ChevronRight size={11} />
                                )}
                                <span>
                                  Exception &amp; Stderr Trace ({stderrLines.length} lines)
                                </span>
                              </span>
                              <span className="text-[9px] text-slate-400 font-normal">
                                {showStderrTrace ? 'Hide' : 'Expand'}
                              </span>
                            </button>
                            {showStderrTrace && (
                              <div className="p-2 max-h-36 overflow-y-auto font-mono text-[9px] text-rose-300/90 space-y-1 select-text border-t border-slate-800/80">
                                {stderrLines.map((line, idx) => (
                                  <div key={idx} className="leading-relaxed break-words">
                                    {line}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Missing Deliverables / Verification Gaps */}
                        {selectedTask.verificationReport &&
                          selectedTask.verificationReport.gaps &&
                          selectedTask.verificationReport.gaps.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-amber-500/20">
                              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                                Missing Deliverables / Stubs:
                              </span>
                              <ul className="text-[10px] space-y-0.5 text-amber-200 list-disc list-inside">
                                {selectedTask.verificationReport.gaps.map((gap, gIdx) => (
                                  <li key={gIdx} className="leading-tight">
                                    {gap}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                        {/* Interactive Resume / Retry Action Buttons */}
                        {onRecoverTask && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                              <span>Task Recovery &amp; Breakpoint Resume</span>
                              <button
                                type="button"
                                onClick={() => onRecoverTask(selectedTask, 'ask')}
                                className="text-sky-400 hover:text-sky-300 underline font-semibold"
                              >
                                Full Recovery Dialog...
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onRecoverTask(
                                    selectedTask,
                                    'continue_from_breakpoint'
                                  )
                                }
                                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow-sm transition-colors cursor-pointer"
                                title="Keep files modified so far and resume execution from the last breakpoint"
                              >
                                <Play size={10} fill="currentColor" />
                                <span>Continue from Last Breakpoint (Keep Files)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onRecoverTask(selectedTask, 'revert_and_retry')
                                }
                                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-[10px] transition-colors cursor-pointer"
                                title="Revert modified/created files using safety checkpoint and retry cleanly"
                              >
                                <RotateCcw size={10} />
                                <span>Revert Modified Files &amp; Retry Cleanly</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedTask.verificationReport && selectedTask.verificationReport.passed && (
                      <div className="text-[10px] text-emerald-400/90 font-mono flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        <span>{selectedTask.verificationReport.checkedFiles.length} deliverable files verified</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="font-mono text-[10px] text-slate-400 space-y-1">
              {selectedTask && selectedTask.logs.length > 0 ? (
                selectedTask.logs.map((line, i) => (
                  <div key={i} className="leading-relaxed break-words">
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-600 italic">
                  Raw terminal stream events will appear here...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right-Click Context Menu & Confirmable Delete Modal */}
      <SidebarItemContextMenu
        target={contextTarget}
        onClose={() => setContextTarget(null)}
      />
    </aside>
  );
};
