import React, { useState, useRef, useCallback, useImperativeHandle } from 'react';
import {
  Sparkles,
  FileCheck2,
  Brain,
  Image as ImageIcon,
  X,
  Loader2,
  Send,
} from 'lucide-react';
import {
  AgentId,
  AgentProfile,
  AgentTaskIntent,
  ScannedMdFile,
  CustomPipelineAction,
  AgentEffortLevel,
} from '../../../../../shared/types';
import {
  AGENT_INTENT_PRESETS,
  STARTER_CUSTOM_PIPELINE_ACTIONS,
} from '../../../../../shared/constants';

export interface ChatImageAttachment {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
}

export interface AgentChatComposerHandle {
  getEffortAndThinking: () => {
    effortLevel: AgentEffortLevel;
    thinkingEnabled: boolean;
  };
  appendImageFiles: (files: FileList | File[]) => void;
}

export interface AgentChatComposerProps {
  visibleAgents: AgentProfile[];
  allAgents: AgentProfile[];
  agentsById?: Map<string, AgentProfile>;
  selectedAgentId: AgentId;
  onSelectAgent: (id: AgentId) => void;
  selectedIntent: AgentTaskIntent;
  onSelectIntent: (intent: AgentTaskIntent) => void;
  activeFileName: string;
  activeFilePath: string;
  watchedFiles: ScannedMdFile[];
  selectedSourceFile: string;
  onSelectSourceFile: (path: string) => void;
  isComposerDisabled: boolean;
  isPipelineActive: boolean;
  isPausedForApproval: boolean;
  submitting: boolean;
  customActions?: CustomPipelineAction[];
  onOpenCustomActionsModal?: () => void;
  onSendChatTask: (
    promptText: string,
    attachedImages?: ChatImageAttachment[],
    customActionId?: string,
    effortLevel?: AgentEffortLevel,
    thinkingEnabled?: boolean
  ) => Promise<void>;
}

export const AgentChatComposer = React.memo(
  React.forwardRef<AgentChatComposerHandle, AgentChatComposerProps>(({
  visibleAgents,
  allAgents,
  agentsById,
  selectedAgentId,
  onSelectAgent,
  selectedIntent,
  onSelectIntent,
  activeFileName,
  activeFilePath,
  watchedFiles,
  selectedSourceFile,
  onSelectSourceFile,
  isComposerDisabled,
  isPipelineActive,
  isPausedForApproval,
  submitting,
  customActions = [],
  onOpenCustomActionsModal,
  onSendChatTask,
}, ref) => {
  const [promptInput, setPromptInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<ChatImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedCustomActionId, setSelectedCustomActionId] = useState('');
  const [composerEffort, setComposerEffort] = useState<AgentEffortLevel>('medium');
  const [composerThinking, setComposerThinking] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const availableCustomActions =
    customActions.length > 0 ? customActions : STARTER_CUSTOM_PIPELINE_ACTIONS;

  const activeAgent =
    agentsById?.get(selectedAgentId) ||
    allAgents.find((a) => a.id === selectedAgentId) ||
    visibleAgents[0];

  const addImageFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setAttachedImages((prev) => [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name || `Pasted-Image-${Date.now()}`,
              size: file.size,
              dataUrl,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getEffortAndThinking: () => ({
        effortLevel: composerEffort,
        thinkingEnabled: composerThinking,
      }),
      appendImageFiles: addImageFiles,
    }),
    [composerEffort, composerThinking, addImageFiles]
  );

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const imageFiles = Array.from(e.clipboardData.files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImageFiles(imageFiles);
        return;
      }
    }
    if (e.clipboardData.items) {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith('image/'));
      if (imageItems.length > 0) {
        e.preventDefault();
        const files = imageItems
          .map((item) => item.getAsFile())
          .filter(Boolean) as File[];
        if (files.length > 0) {
          addImageFiles(files);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  const handleManualSend = async () => {
    if (isComposerDisabled) return;
    const text = promptInput.trim();
    if (!text && attachedImages.length === 0) return;

    const imagesToSend = [...attachedImages];
    const customActId = selectedCustomActionId;
    setPromptInput('');
    setAttachedImages([]);
    await onSendChatTask(
      text,
      imagesToSend,
      customActId || undefined,
      composerEffort,
      composerThinking
    );
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files) addImageFiles(e.dataTransfer.files);
      }}
      className={`p-3 bg-slate-900 border-t border-slate-800 space-y-2 shrink-0 transition-colors ${
        isDragOver ? 'bg-sky-950/40 border-sky-500' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* @Agent Selector Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: activeAgent?.accentColor || '#38bdf8',
              }}
            />
            <span className="text-[10px] font-bold text-slate-400">Agent:</span>
            <select
              value={selectedAgentId}
              disabled={isComposerDisabled}
              onChange={(e) => onSelectAgent(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer disabled:cursor-not-allowed"
            >
              {visibleAgents.map((a) => (
                <option key={a.id} value={a.id} className="bg-slate-900">
                  @{a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mode / Intent Selector Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs">
            <Sparkles size={11} className="text-sky-400" />
            <span className="text-[10px] font-bold text-slate-400">Mode:</span>
            <select
              value={
                selectedCustomActionId
                  ? `custom:${selectedCustomActionId}`
                  : selectedIntent
              }
              disabled={isComposerDisabled}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__manage_custom__') {
                  onOpenCustomActionsModal?.();
                  return;
                }
                if (val.startsWith('custom:')) {
                  const cId = val.replace('custom:', '');
                  onSelectIntent('custom');
                  setSelectedCustomActionId(cId);
                } else {
                  onSelectIntent(val as AgentTaskIntent);
                  setSelectedCustomActionId('');
                }
              }}
              className="bg-transparent text-sky-300 font-bold text-xs focus:outline-none cursor-pointer disabled:cursor-not-allowed"
            >
              {AGENT_INTENT_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900">
                  {p.title}
                </option>
              ))}
              {availableCustomActions.length > 0 && (
                <optgroup
                  label="Custom Actions"
                  className="bg-slate-900 text-indigo-300 font-semibold"
                >
                  {availableCustomActions.map((ca) => (
                    <option
                      key={ca.id}
                      value={`custom:${ca.id}`}
                      className="bg-slate-900 text-slate-100"
                    >
                      ✨ {ca.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {onOpenCustomActionsModal && (
                <option
                  value="__manage_custom__"
                  className="bg-slate-900 text-sky-400 font-bold"
                >
                  + Manage Custom Actions...
                </option>
              )}
            </select>
          </div>

          {/* Attached Markdown Context File Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs max-w-xs">
            <FileCheck2 size={12} className="text-emerald-400 shrink-0" />
            <select
              value={selectedSourceFile || activeFilePath}
              disabled={isComposerDisabled}
              onChange={(e) => onSelectSourceFile(e.target.value)}
              className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none truncate cursor-pointer disabled:cursor-not-allowed"
            >
              <option value={activeFilePath} className="bg-slate-900">
                Target: {activeFileName}
              </option>
              {watchedFiles
                .filter((f) => f.path !== activeFilePath)
                .slice(0, 25)
                .map((f) => (
                  <option key={f.path} value={f.path} className="bg-slate-900">
                    {f.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Effort Selector Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs">
            <span className="text-[10px] font-bold text-slate-400">Effort:</span>
            <select
              value={composerEffort}
              disabled={isComposerDisabled}
              onChange={(e) =>
                setComposerEffort(e.target.value as AgentEffortLevel)
              }
              className="bg-transparent text-sky-300 font-bold text-xs focus:outline-none cursor-pointer disabled:cursor-not-allowed"
              title="Reasoning effort level and token budget"
            >
              <option value="low" className="bg-slate-900">
                Low
              </option>
              <option value="medium" className="bg-slate-900">
                Med (Default)
              </option>
              <option value="high" className="bg-slate-900">
                High
              </option>
              <option value="xhigh" className="bg-slate-900">
                X-High
              </option>
              <option value="max" className="bg-slate-900">
                Max
              </option>
            </select>
          </div>

          {/* Thinking Mode Toggle Pill */}
          <button
            type="button"
            disabled={isComposerDisabled}
            onClick={() => setComposerThinking((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed ${
              composerThinking
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-xs'
                : 'bg-slate-950 border-slate-700 text-slate-400 line-through'
            }`}
            title={
              composerThinking
                ? 'Thinking Mode: ENABLED (Click to turn off and save tokens)'
                : 'Thinking Mode: DISABLED (Fast direct output, no extended reasoning)'
            }
          >
            <Brain
              size={12}
              className={composerThinking ? 'text-indigo-400' : 'text-slate-500'}
            />
            <span>{composerThinking ? 'Thinking ON' : 'Thinking OFF'}</span>
          </button>
        </div>

        <span className="text-[10px] text-slate-400 hidden sm:inline">
          Paste images (Ctrl+V) or drag &amp; drop • Click Send button to dispatch
        </span>
      </div>

      {/* Attached Images Preview Strip */}
      {attachedImages.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
          {attachedImages.map((img) => (
            <div
              key={img.id}
              className="relative group shrink-0 rounded-xl border border-slate-700 bg-slate-950 p-1.5 flex items-center gap-2 shadow-sm"
            >
              <img
                src={img.dataUrl}
                alt={img.name}
                className="w-12 h-12 object-cover rounded-lg border border-slate-800"
              />
              <div className="text-[10px] pr-2 max-w-[130px]">
                <div className="font-semibold text-slate-200 truncate">{img.name}</div>
                <div className="text-slate-500 font-mono">
                  {(img.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAttachedImages((prev) =>
                    prev.filter((i) => i.id !== img.id)
                  )
                }
                title="Remove image"
                className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-transform hover:scale-110"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Multi-Line Textarea */}
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          rows={3}
          disabled={isComposerDisabled}
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isPipelineActive && !isPausedForApproval
              ? 'Workflow running — manual input locked until pipeline completes or pauses...'
              : `Message @${activeAgent?.shortName || 'Agent'} about ${activeFileName}...\n(Enter or Shift+Enter creates a new line. Click Send button to dispatch)`
          }
          className="w-full min-h-[76px] p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 leading-relaxed font-sans resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Action Row: Attach Image Picker & Manual Send Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={isComposerDisabled}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addImageFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={isComposerDisabled}
              onClick={() => fileInputRef.current?.click()}
              title="Attach images (or paste screenshot with Ctrl+V, or drag & drop)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ImageIcon size={13} className="text-sky-400" />
              <span>Attach Image</span>
              {attachedImages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                  {attachedImages.length}
                </span>
              )}
            </button>

            <span className="text-[11px] text-slate-500 hidden md:inline">
              Enter creates a new line
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualSend}
            disabled={
              isComposerDisabled ||
              (!promptInput.trim() && attachedImages.length === 0)
            }
            title={
              isPipelineActive && !isPausedForApproval
                ? 'Workflow running — manual dispatch locked'
                : `Send to @${activeAgent?.shortName || 'Agent'}`
            }
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span>Send to @{activeAgent?.shortName || 'Agent'}</span>
          </button>
        </div>
      </div>
    </div>
  );
  })
);

