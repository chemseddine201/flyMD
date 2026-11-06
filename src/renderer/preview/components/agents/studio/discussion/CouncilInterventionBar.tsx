import React, { useRef, useState } from 'react';
import { Target, Brain, RotateCw, Zap, Send, Paperclip, AlertCircle } from 'lucide-react';
import { AgentEffortLevel, DiscussionAttachedFile } from '../../../../../../shared/types';
import { ModelEffortSideBySidePicker } from '../../common/ModelEffortSideBySidePicker';
import { DiscussionAttachmentPills, MAX_DISCUSSION_ATTACHMENTS } from './discussionAttachmentUtils';

export interface ParticipantAgentOption {
  id: string;
  name: string;
  role: string;
  color?: string;
  /** Actual engine/provider that powers this participant (from the live transcript or config). */
  providerId?: string;
}

export interface CouncilInterventionBarProps {
  showTargetedDispatch: boolean;
  onToggleTargetedDispatch: () => void;
  onCloseTargetedDispatch: () => void;
  participantAgents: ParticipantAgentOption[];
  targetedAgentId: string;
  onChangeTargetedAgentId: (id: string) => void;
  /** Subscription-aware lookups so the model picker reflects the participant's real engine. */
  getSubscriptionTierForAgent?: (agentOrProviderId: string) => string | undefined;
  getDynamicModelsForAgent?: (agentOrProviderId: string) => string[];
  targetedActionName: string;
  onChangeTargetedActionName: (name: string) => void;
  targetedEffortLevel: AgentEffortLevel;
  onChangeTargetedEffortLevel: (level: AgentEffortLevel) => void;
  targetedThinkingEnabled: boolean;
  onToggleTargetedThinking: () => void;
  targetedModelId?: string;
  onChangeTargetedModelId?: (model: string) => void;
  targetedActionQuery: string;
  onChangeTargetedActionQuery: (query: string) => void;
  isDispatchingTargeted: boolean;
  onDispatchTargetedQuery: () => void;
  guidanceInput: string;
  onChangeGuidanceInput: (text: string) => void;
  onSendGuidance: () => void;
  interventionFiles?: DiscussionAttachedFile[];
  onAddInterventionFiles?: (files: FileList | File[]) => Promise<void>;
  onRemoveInterventionFile?: (fileId: string) => void;
  interventionClampedNotice?: boolean;
}

export const CouncilInterventionBar: React.FC<CouncilInterventionBarProps> =
  React.memo(
    ({
      showTargetedDispatch,
      onToggleTargetedDispatch,
      onCloseTargetedDispatch,
      participantAgents,
      targetedAgentId,
      onChangeTargetedAgentId,
      getSubscriptionTierForAgent,
      getDynamicModelsForAgent,
      targetedActionName,
      onChangeTargetedActionName,
      targetedEffortLevel,
      onChangeTargetedEffortLevel,
      targetedThinkingEnabled,
      onToggleTargetedThinking,
      targetedModelId,
      onChangeTargetedModelId,
      targetedActionQuery,
      onChangeTargetedActionQuery,
      isDispatchingTargeted,
      onDispatchTargetedQuery,
      guidanceInput,
      onChangeGuidanceInput,
      onSendGuidance,
      interventionFiles,
      onAddInterventionFiles,
      onRemoveInterventionFile,
      interventionClampedNotice,
    }) => {
      const fileInputRef = useRef<HTMLInputElement>(null);
      const [isDragOver, setIsDragOver] = useState(false);

      const targetedProviderId =
        participantAgents.find((ag) => ag.id === targetedAgentId)?.providerId ||
        targetedAgentId;

      return (
        <div
          onDragOver={(e) => {
            if (e.dataTransfer?.types?.includes('Files')) {
              e.preventDefault();
              setIsDragOver(true);
            }
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
              onAddInterventionFiles?.(e.dataTransfer.files);
            }
          }}
          className={`shrink-0 border-t ${
            isDragOver
              ? 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-50/50 dark:bg-sky-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95'
          } backdrop-blur-sm transition-colors duration-150`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onAddInterventionFiles?.(e.target.files);
                e.target.value = '';
              }
            }}
            className="hidden"
          />

          {showTargetedDispatch && (
            <div className="p-3 bg-purple-50/80 dark:bg-purple-950/20 border-b border-purple-300 dark:border-purple-500/30 animate-fadeIn">
              <div className="max-w-4xl mx-auto space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-purple-800 dark:text-purple-300">
                  <div className="flex items-center gap-1.5">
                    <Target size={14} className="text-purple-600 dark:text-purple-400" />
                    <span>
                      Targeted Agent Inquiry &amp; Custom Action Dispatch
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseTargetedDispatch}
                    className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-semibold"
                  >
                    &times;
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-1 rounded-lg border border-purple-500/30 text-xs">
                    <span className="text-purple-600 dark:text-purple-400 font-semibold text-[11px]">
                      Target Agent:
                    </span>
                    <select
                      value={targetedAgentId}
                      onChange={(e) => onChangeTargetedAgentId(e.target.value)}
                      className="bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer text-xs"
                    >
                      {participantAgents.map((ag) => (
                        <option
                          key={ag.id}
                          value={ag.id}
                          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                        >
                          @{ag.name} ({ag.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-1 rounded-lg border border-purple-500/30 text-xs">
                    <span className="text-purple-600 dark:text-purple-400 font-semibold text-[11px]">
                      Action Directive:
                    </span>
                    <select
                      value={targetedActionName}
                      onChange={(e) => onChangeTargetedActionName(e.target.value)}
                      className="bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer text-xs"
                    >
                      <option
                        value="Targeted Inquiry"
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                      >
                        Targeted Inquiry
                      </option>
                      <option
                        value="Edge Case Stress Test"
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                      >
                        Edge Case Stress Test
                      </option>
                      <option
                        value="Invariant Verification"
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                      >
                        Constraint Verification
                      </option>
                      <option
                        value="Risk & Feasibility Probe"
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                      >
                        Risk &amp; Feasibility Probe
                      </option>
                      <option
                        value="Alternative Solution Inquiry"
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                      >
                        Alternative Solution Inquiry
                      </option>
                    </select>
                  </div>

                  {/* Side-by-Side Model & Effort Matrix */}
                  <ModelEffortSideBySidePicker
                    agentId={targetedProviderId}
                    subscriptionTier={getSubscriptionTierForAgent?.(targetedProviderId)}
                    dynamicModels={getDynamicModelsForAgent?.(targetedProviderId)}
                    selectedModel={targetedModelId}
                    onChangeModel={onChangeTargetedModelId || (() => {})}
                    effortLevel={targetedEffortLevel}
                    onChangeEffortLevel={onChangeTargetedEffortLevel}
                    thinkingEnabled={targetedThinkingEnabled}
                    onToggleThinking={onToggleTargetedThinking}
                    compact={true}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={targetedActionQuery}
                    onChange={(e) => onChangeTargetedActionQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onDispatchTargetedQuery();
                      }
                    }}
                    placeholder={`Specify inquiry or probe for ${targetedAgentId}... (e.g. 'What are the main risks, dependencies, or trade-offs?')`}
                    className="flex-1 bg-white dark:bg-slate-950 border border-purple-500/40 rounded-lg px-3.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-purple-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={onDispatchTargetedQuery}
                    disabled={
                      (!targetedActionQuery.trim() && (!interventionFiles || interventionFiles.length === 0)) ||
                      isDispatchingTargeted
                    }
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-sm shrink-0"
                  >
                    {isDispatchingTargeted ? (
                      <>
                        <RotateCw size={12} className="animate-spin" />
                        <span>Probing...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={12} />
                        <span>Dispatch Probe</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-3">
            <div className="max-w-4xl mx-auto space-y-1.5">
              {interventionFiles && interventionFiles.length > 0 && (
                <div className="pb-1">
                  <DiscussionAttachmentPills
                    files={interventionFiles}
                    onRemove={onRemoveInterventionFile || (() => {})}
                    maxFiles={MAX_DISCUSSION_ATTACHMENTS}
                  />
                </div>
              )}
              {interventionClampedNotice && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle size={11} />
                  <span>Maximum 10 files allowed. Additional files were omitted.</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleTargetedDispatch}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-bold transition-all shrink-0 ${
                    showTargetedDispatch
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  title="Dispatch a targeted custom inquiry to an individual agent"
                >
                  <Target size={13} className="text-purple-400" />
                  <span className="hidden sm:inline">Target Agent</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
                    interventionFiles && interventionFiles.length > 0
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-800 dark:text-sky-300'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  title="Attach up to 10 files (code, documents, configs, images)"
                >
                  <Paperclip size={13} className="text-sky-500" />
                  <span className="hidden sm:inline">Attach</span>
                  {interventionFiles && interventionFiles.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                      {interventionFiles.length}
                    </span>
                  )}
                </button>

                <input
                  type="text"
                  value={guidanceInput}
                  onChange={(e) => onChangeGuidanceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      (e.metaKey || e.ctrlKey || !e.shiftKey)
                    ) {
                      e.preventDefault();
                      onSendGuidance();
                    }
                  }}
                  placeholder="Intervene or steer council... (e.g. 'Prioritize feasibility', attach code/specs, press Enter)"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={onSendGuidance}
                  disabled={!guidanceInput.trim() && (!interventionFiles || interventionFiles.length === 0)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-sm shrink-0"
                >
                  <Send size={12} />
                  <span>Steer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  );

