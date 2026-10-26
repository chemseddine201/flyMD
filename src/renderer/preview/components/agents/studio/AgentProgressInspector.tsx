import React, { useState } from 'react';
import {
  CheckCircle2,
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
  activeMarkdownContent: string;
  watchedFiles: ScannedMdFile[];
  onRunSingleChecklistItem: (itemText: string) => void;
  onOpenFileInEditor: (filePath?: string) => void;
  onSelectWatchedFileForDispatch: (file: ScannedMdFile) => void;
  onDeleteWorkspaceFile: (filePath: string) => Promise<void> | void;
}

const PROGRESS_STAGES = [
  { id: 'snapshot', label: '1. Safety Snapshot & Git Guard', minPct: 15 },
  { id: 'context', label: '2. Workspace & IDE Workflow Sync', minPct: 35 },
  { id: 'reasoning', label: '3. Agent Context Reasoning', minPct: 55 },
  { id: 'executing', label: '4. Synthesizing Markdown Output', minPct: 80 },
  { id: 'completed', label: '5. Verified & Saved to Workspace', minPct: 100 },
];

export const AgentProgressInspector: React.FC<AgentProgressInspectorProps> = ({
  selectedTask,
  checkpoints,
  restoringCheckpointId,
  onRestoreCheckpoint,
  onClearTaskLogs,
  activeMarkdownContent,
  watchedFiles,
  onRunSingleChecklistItem,
  onOpenFileInEditor,
  onSelectWatchedFileForDispatch,
  onDeleteWorkspaceFile,
}) => {
  const [contextTarget, setContextTarget] =
    useState<SidebarContextMenuTarget | null>(null);

  const pct = selectedTask
    ? selectedTask.progressPercent ??
      (selectedTask.status === 'completed' ? 100 : 25)
    : 0;

  const checkpoint = selectedTask?.checkpointId
    ? checkpoints.find((c) => c.id === selectedTask.checkpointId)
    : undefined;

  const parsedChecklist = React.useMemo(() => {
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

  return (
    <aside className="w-80 shrink-0 h-full border-l border-slate-800/90 bg-slate-900/75 flex flex-col overflow-y-auto p-3.5 space-y-4 select-none">
      {/* 1. Live 5-Stage Progress Tracker */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-sky-400" />
            Live Progress View
          </span>
          <span className="text-xs font-extrabold text-sky-300">{pct}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* 5 Stages Stepper */}
        <div className="space-y-1.5 pt-1">
          {PROGRESS_STAGES.map((stage) => {
            const isDone = pct >= stage.minPct || selectedTask?.status === 'completed';
            const isCurrent =
              selectedTask?.status === 'running' &&
              selectedTask?.progressStage === stage.id;

            return (
              <div
                key={stage.id}
                className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded-lg ${
                  isCurrent
                    ? 'bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30'
                    : isDone
                    ? 'text-emerald-300 font-medium'
                    : 'text-slate-500'
                }`}
              >
                {isCurrent ? (
                  <Loader2 size={12} className="text-sky-400 animate-spin shrink-0" />
                ) : isDone ? (
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                ) : (
                  <Circle size={12} className="text-slate-600 shrink-0" />
                )}
                <span className="truncate">{stage.label}</span>
              </div>
            );
          })}
        </div>

        {/* Safety Checkpoint Undo Button */}
        {checkpoint && !checkpoint.restored && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-[10px] text-emerald-300 flex items-center gap-1">
              <ShieldCheck size={11} /> Restore Point Active
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

      {/* 2. Interactive Checklist Tracker */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ListChecks size={13} className="text-emerald-400" />
            Task Checklist ({parsedChecklist.filter((i) => i.done).length}/
            {parsedChecklist.length})
          </span>
        </div>

        {parsedChecklist.length === 0 ? (
          <div className="text-[11px] text-slate-500 py-3 text-center">
            No `- [ ]` checklist items in current document. Ask an agent to{' '}
            <strong>Refine Plan</strong> to generate a step-by-step checklist!
          </div>
        ) : (
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
            {parsedChecklist.map((item, idx) => (
              <div
                key={idx}
                className="group flex items-start justify-between gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-[11px]"
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
                    title="Execute this specific step in the chat studio"
                    className="opacity-0 group-hover:opacity-100 shrink-0 px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-bold flex items-center gap-0.5 transition-all"
                  >
                    <Play size={9} fill="currentColor" /> Run
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Supervised Workspace Files (Drag, Click or Right-Click) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <FileText size={13} className="text-sky-400" />
            Workspace .md Files ({watchedFiles.length})
          </span>
        </div>

        <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
          {watchedFiles.length === 0 ? (
            <div className="text-[11px] text-slate-500 py-2 text-center">
              Enable <strong>Supervise</strong> to watch project `.md` files automatically.
            </div>
          ) : (
            watchedFiles.slice(0, 20).map((file) => (
              <div
                key={file.path}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/flymd-file',
                    JSON.stringify({
                      filePath: file.path,
                      fileName: file.name,
                      sourceAgent: file.sourceAgent,
                    })
                  );
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextTarget({
                    x: e.clientX,
                    y: e.clientY,
                    title: file.name,
                    subtitle: 'Workspace Markdown File',
                    filePath: file.path,
                    deleteLabel: 'Delete File from Disk...',
                    onOpen: () => onOpenFileInEditor(file.path),
                    onDeleteConfirm: async () => {
                      await onDeleteWorkspaceFile(file.path);
                    },
                  });
                }}
                title="Right-click to Open in Directory or Delete"
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 text-[11px] cursor-grab"
              >
                <span className="truncate text-slate-200 font-medium">
                  {file.name}
                </span>
                <div className="flex items-center gap-1 shrink-0 ml-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenFileInEditor(file.path)}
                    title="Open in Preview"
                    className="text-slate-400 hover:text-white p-0.5"
                  >
                    <ExternalLink size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectWatchedFileForDispatch(file)}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-bold"
                  >
                    Use
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Live Execution Stream Log */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3 flex-1 flex flex-col min-h-[130px]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Terminal size={11} className="text-emerald-400" />
            Execution Stream Log
          </span>
          {selectedTask && selectedTask.logs.length > 0 && (
            <button
              type="button"
              onClick={() => onClearTaskLogs(selectedTask.id)}
              title="Clear Execution Stream Log"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-rose-500/20 text-[9px] font-bold text-slate-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 size={9} />
              <span>Clear</span>
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1 max-h-36">
          {selectedTask && selectedTask.logs.length > 0 ? (
            selectedTask.logs.map((line, i) => (
              <div key={i} className="leading-relaxed break-words">
                {line}
              </div>
            ))
          ) : (
            <div className="text-slate-600 italic">
              Real-time agent stream events appear here...
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

