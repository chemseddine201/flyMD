import React from 'react';
import { Target, Brain, RotateCw, Zap, Send } from 'lucide-react';
import { AgentEffortLevel } from '../../../../../../shared/types';

export interface ParticipantAgentOption {
  id: string;
  name: string;
  role: string;
  color?: string;
}

export interface CouncilInterventionBarProps {
  showTargetedDispatch: boolean;
  onToggleTargetedDispatch: () => void;
  onCloseTargetedDispatch: () => void;
  participantAgents: ParticipantAgentOption[];
  targetedAgentId: string;
  onChangeTargetedAgentId: (id: string) => void;
  targetedActionName: string;
  onChangeTargetedActionName: (name: string) => void;
  targetedEffortLevel: AgentEffortLevel;
  onChangeTargetedEffortLevel: (level: AgentEffortLevel) => void;
  targetedThinkingEnabled: boolean;
  onToggleTargetedThinking: () => void;
  targetedActionQuery: string;
  onChangeTargetedActionQuery: (query: string) => void;
  isDispatchingTargeted: boolean;
  onDispatchTargetedQuery: () => void;
  guidanceInput: string;
  onChangeGuidanceInput: (text: string) => void;
  onSendGuidance: () => void;
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
      targetedActionName,
      onChangeTargetedActionName,
      targetedEffortLevel,
      onChangeTargetedEffortLevel,
      targetedThinkingEnabled,
      onToggleTargetedThinking,
      targetedActionQuery,
      onChangeTargetedActionQuery,
      isDispatchingTargeted,
      onDispatchTargetedQuery,
      guidanceInput,
      onChangeGuidanceInput,
      onSendGuidance,
    }) => {
      return (
        <div className="shrink-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm">
          {showTargetedDispatch && (
            <div className="p-3 bg-purple-950/20 border-b border-purple-500/30 animate-fadeIn">
              <div className="max-w-4xl mx-auto space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                  <div className="flex items-center gap-1.5">
                    <Target size={14} className="text-purple-400" />
                    <span>
                      Targeted Agent Inquiry &amp; Custom Action Dispatch
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseTargetedDispatch}
                    className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
                  >
                    &times;
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-purple-500/30 text-xs">
                    <span className="text-purple-400 font-semibold text-[11px]">
                      Target Agent:
                    </span>
                    <select
                      value={targetedAgentId}
                      onChange={(e) => onChangeTargetedAgentId(e.target.value)}
                      className="bg-transparent border-0 text-slate-200 focus:outline-none cursor-pointer text-xs"
                    >
                      {participantAgents.map((ag) => (
                        <option
                          key={ag.id}
                          value={ag.id}
                          className="bg-slate-900 text-slate-200"
                        >
                          @{ag.name} ({ag.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-purple-500/30 text-xs">
                    <span className="text-purple-400 font-semibold text-[11px]">
                      Action Directive:
                    </span>
                    <select
                      value={targetedActionName}
                      onChange={(e) => onChangeTargetedActionName(e.target.value)}
                      className="bg-transparent border-0 text-slate-200 focus:outline-none cursor-pointer text-xs"
                    >
                      <option
                        value="Targeted Inquiry"
                        className="bg-slate-900 text-slate-200"
                      >
                        Targeted Inquiry
                      </option>
                      <option
                        value="Edge Case Stress Test"
                        className="bg-slate-900 text-slate-200"
                      >
                        Edge Case Stress Test
                      </option>
                      <option
                        value="Invariant Verification"
                        className="bg-slate-900 text-slate-200"
                      >
                        Constraint Verification
                      </option>
                      <option
                        value="Risk & Feasibility Probe"
                        className="bg-slate-900 text-slate-200"
                      >
                        Risk &amp; Feasibility Probe
                      </option>
                      <option
                        value="Alternative Solution Inquiry"
                        className="bg-slate-900 text-slate-200"
                      >
                        Alternative Solution Inquiry
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-purple-500/30 text-xs">
                    <span className="text-purple-400 font-semibold text-[11px]">
                      Effort:
                    </span>
                    <select
                      value={targetedEffortLevel}
                      onChange={(e) =>
                        onChangeTargetedEffortLevel(
                          e.target.value as AgentEffortLevel
                        )
                      }
                      className="bg-transparent border-0 text-sky-300 font-bold focus:outline-none cursor-pointer text-xs"
                    >
                      <option value="low" className="bg-slate-900">
                        Low Effort
                      </option>
                      <option value="medium" className="bg-slate-900">
                        Med Effort
                      </option>
                      <option value="high" className="bg-slate-900">
                        High Effort
                      </option>
                      <option value="xhigh" className="bg-slate-900">
                        X-High Effort
                      </option>
                      <option value="max" className="bg-slate-900">
                        Max Effort
                      </option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleTargetedThinking}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                      targetedThinkingEnabled
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-950 border-purple-500/30 text-slate-400 line-through'
                    }`}
                    title={
                      targetedThinkingEnabled ? 'Thinking: ON' : 'Thinking: OFF'
                    }
                  >
                    <Brain
                      size={12}
                      className={
                        targetedThinkingEnabled
                          ? 'text-indigo-400'
                          : 'text-slate-500'
                      }
                    />
                    <span>
                      {targetedThinkingEnabled ? 'Thinking ON' : 'Thinking OFF'}
                    </span>
                  </button>
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
                    className="flex-1 bg-slate-950 border border-purple-500/40 rounded-lg px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={onDispatchTargetedQuery}
                    disabled={
                      !targetedActionQuery.trim() || isDispatchingTargeted
                    }
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-sm shrink-0"
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
            <div className="max-w-4xl mx-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleTargetedDispatch}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-bold transition-all shrink-0 ${
                  showTargetedDispatch
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
                title="Dispatch a targeted custom inquiry to an individual agent"
              >
                <Target size={13} className="text-purple-400" />
                <span className="hidden sm:inline">Target Agent</span>
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
                placeholder="Intervene or steer council... (e.g. 'Prioritize feasibility', 'Explore alternative angles', press Enter)"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
              <button
                type="button"
                onClick={onSendGuidance}
                disabled={!guidanceInput.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-slate-950 text-xs font-bold transition-all shadow-sm shrink-0"
              >
                <Send size={12} />
                <span>Steer</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
  );

