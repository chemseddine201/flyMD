import React, { useMemo, useState } from 'react';
import {
  FileText,
  Rocket,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Edit3,
  Save,
  CheckCircle2,
  Award,
  Layers,
  RotateCcw,
  Eye,
  Code2,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { usePreviewStore } from '../../../store';
import {
  AgentPipelinePreset,
  AgentPipelineStep,
  AgentTaskIntent,
} from '../../../../../shared/types';
import { markdownService } from '../../../services/MarkdownService';
import '../../../../styles/markdown.css';
import { cleanDiscussionMarkdown } from '../studio/DiscussionStudio';

interface ProjectSynthesisReportViewerProps {
  workspacePath: string;
  reportMarkdown: string;
  onLaunchDedicatedPipeline: (
    preset: AgentPipelinePreset,
    reportMarkdown: string
  ) => void;
  onRollupToMaster?: () => void;
  onSendBackToDebate?: (feedback: string, reportMarkdown: string) => void;
}

export const ProjectSynthesisReportViewer: React.FC<ProjectSynthesisReportViewerProps> = ({
  workspacePath,
  reportMarkdown,
  onLaunchDedicatedPipeline,
  onRollupToMaster,
  onSendBackToDebate,
}) => {
  const activeProject = usePreviewStore((s) => s.activeProject);
  const agentProfiles = usePreviewStore((s) => s.agentProfiles);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState(reportMarkdown);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  const enabledAgents = agentProfiles.filter((a) => a.enabled);
  const availableAgents = enabledAgents.length > 0 ? enabledAgents : agentProfiles;

  // Sync editedMarkdown if external reportMarkdown changes and user hasn't edited
  React.useEffect(() => {
    if (!isEditing && reportMarkdown) {
      setEditedMarkdown(reportMarkdown);
    }
  }, [reportMarkdown, isEditing]);

  // Extract checklist items from Markdown (e.g. - [ ] or - [x])
  const checklistItems = useMemo(() => {
    const lines = (editedMarkdown || reportMarkdown).split('\n');
    const items: { lineIndex: number; text: string; checked: boolean }[] = [];

    lines.forEach((line, idx) => {
      const match = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.+)$/);
      if (match) {
        items.push({
          lineIndex: idx,
          checked: match[2].toLowerCase() === 'x',
          text: match[3].trim(),
        });
      }
    });

    return items;
  }, [reportMarkdown, editedMarkdown]);

  const handleToggleItem = (lineIndex: number) => {
    const lines = (editedMarkdown || reportMarkdown).split('\n');
    const line = lines[lineIndex];
    if (!line) return;

    if (line.includes('[ ]')) {
      lines[lineIndex] = line.replace('[ ]', '[x]');
    } else if (line.includes('[x]') || line.includes('[X]')) {
      lines[lineIndex] = line.replace(/\[[xX]\]/, '[ ]');
    }

    const next = lines.join('\n');
    setEditedMarkdown(next);
  };

  const handleBuildPipelineFromReport = () => {
    const fallbackAgent = availableAgents[0]?.id || 'antigravity';
    const secondAgent = availableAgents[1]?.id || fallbackAgent;

    // Convert extracted checklist items (or fallback to default steps if none)
    const steps: AgentPipelineStep[] = [];

    if (checklistItems.length > 0) {
      checklistItems.forEach((item, idx) => {
        const lower = item.text.toLowerCase();
        let intent: AgentTaskIntent = 'build';
        let agentId = fallbackAgent;

        if (
          lower.includes('plan') ||
          lower.includes('architect') ||
          lower.includes('design') ||
          lower.includes('research') ||
          lower.includes('outline') ||
          lower.includes('strategy')
        ) {
          intent = 'refine-plan';
          agentId = fallbackAgent;
        } else if (
          lower.includes('test') ||
          lower.includes('verify') ||
          lower.includes('audit') ||
          lower.includes('review') ||
          lower.includes('evaluate') ||
          lower.includes('fact-check')
        ) {
          intent = 'review';
          agentId = secondAgent;
        } else if (
          lower.includes('fix') ||
          lower.includes('bug') ||
          lower.includes('correct') ||
          lower.includes('revise')
        ) {
          intent = 'fix-bugs';
          agentId = fallbackAgent;
        } else {
          intent = 'build';
          agentId = idx % 2 === 0 ? fallbackAgent : secondAgent;
        }

        steps.push({
          agentId,
          intent,
          label: item.text.length > 40 ? `${item.text.slice(0, 37)}...` : item.text,
          requireConfirmation: false,
        });
      });
    } else {
      steps.push(
        { agentId: fallbackAgent, intent: 'refine-plan', label: 'Synthesize Specifications & Plan', requireConfirmation: false },
        { agentId: secondAgent, intent: 'build', label: 'Execute Core Deliverables', requireConfirmation: false },
        { agentId: fallbackAgent, intent: 'review', label: 'Review Deliverables & Settle', requireConfirmation: false }
      );
    }

    const preset: AgentPipelinePreset = {
      id: `pipeline-proj-${activeProject?.id || Date.now()}`,
      name: `${activeProject?.name || 'Project'} Dedicated Pipeline`,
      description: `Targeted execution derived from Synthesis Report (${steps.length} steps)`,
      steps,
    };

    onLaunchDedicatedPipeline(preset, editedMarkdown || reportMarkdown);
  };

  const handleTriggerReDeliberation = () => {
    if (!onSendBackToDebate) return;
    const notes = feedbackNotes.trim() || 'Review and refine the current synthesis report specifications.';
    onSendBackToDebate(notes, editedMarkdown || reportMarkdown);
    setShowFeedbackModal(false);
    setFeedbackNotes('');
  };

  const completedCount = checklistItems.filter((i) => i.checked).length;
  const progressPercent =
    checklistItems.length > 0
      ? Math.round((completedCount / checklistItems.length) * 100)
      : 0;

  const renderedHtml = useMemo(() => {
    const raw = editedMarkdown || reportMarkdown || '';
    return markdownService.render(cleanDiscussionMarkdown(raw));
  }, [editedMarkdown, reportMarkdown]);

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              Synthesis Report &amp; Contract Specification
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-700/60 font-mono">
                Evidence Graded
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Review contractual specifications and checklist before provisioning dedicated pipeline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Recycling Vector 1: Send Back to Deliberation Council */}
          {onSendBackToDebate && (
            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 border border-purple-500/40 transition-colors shadow-sm"
              title="Return to Council Debate with human guidance or new questions"
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
              <span>◀ Re-deliberate with Feedback</span>
            </button>
          )}

          {/* Rollup to Master if completed */}
          {onRollupToMaster && activeProject?.status === 'completed' && (
            <button
              type="button"
              onClick={onRollupToMaster}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Rollup to Master Memory</span>
            </button>
          )}

          {/* Formatted Preview vs Edit Source Toggle */}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isEditing
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {isEditing ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>View Formatted Preview</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Source</span>
              </>
            )}
          </button>

          {/* Assign to Pipeline Main Action Button */}
          <button
            type="button"
            onClick={handleBuildPipelineFromReport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-slate-950 shadow-md transition-all hover:scale-[1.02]"
          >
            <Rocket className="w-3.5 h-3.5 fill-current" />
            <span>Assign to Pipeline &rarr;</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Report Content (Rich Markdown or Editor) */}
        <div className="flex-1 overflow-y-auto p-4 border-r border-slate-800 bg-slate-950/60">
          {isEditing ? (
            <div className="h-full flex flex-col space-y-2">
              <div className="text-[11px] text-amber-300 flex items-center justify-between">
                <span>Editing Markdown Source: Changes will update checklist and pipeline tasks.</span>
                <span className="text-slate-500 font-mono text-[10px]">GFM Markdown</span>
              </div>
              <textarea
                value={editedMarkdown}
                onChange={(e) => setEditedMarkdown(e.target.value)}
                className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
                placeholder="Enter markdown specification..."
              />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-2">
              <div
                className="markdown-body p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-200 leading-relaxed shadow-lg"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          )}
        </div>

        {/* Right: Operator Checklist Gate & Pipeline Provisioning */}
        <div className="w-80 bg-slate-950/80 p-3.5 flex flex-col shrink-0 border-l border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
              Checklist Tasks ({completedCount}/{checklistItems.length})
            </span>
            <span className="text-[11px] font-mono text-sky-400 font-bold">
              {progressPercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Checklist Items */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {checklistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 text-center text-slate-500 text-xs p-4 bg-slate-900/40 rounded-xl border border-slate-800/60">
                <CheckSquare className="w-6 h-6 mb-1 text-slate-600" />
                <p className="font-medium text-slate-400">No `- [ ]` tasks found</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  Click 'Edit Source' to add tasks like `- [ ] Implement API endpoint`.
                </p>
              </div>
            ) : (
              checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleItem(item.lineIndex)}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors border ${
                    item.checked
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-400 line-through'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200 shadow-xs'
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 text-slate-400 hover:text-sky-400 shrink-0"
                  >
                    {item.checked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="text-[11px] leading-tight flex-1">{item.text}</span>
                </div>
              ))
            )}
          </div>

          {/* Operator Action Bar */}
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={handleBuildPipelineFromReport}
              className="w-full py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              <Rocket className="w-3.5 h-3.5 fill-current" />
              <span>Assign to Pipeline &rarr;</span>
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Transitions to Pipeline configuration view before execution starts.
            </p>
          </div>
        </div>
      </div>

      {/* Re-deliberate with Feedback Modal (Recycling Vector 1) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Return to Deliberation Council with Feedback
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Steer the council to re-evaluate specific assumptions, challenge constraints, or explore alternative architecture before executing the pipeline.
            </p>

            <textarea
              rows={4}
              autoFocus
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              placeholder="e.g. Please test edge cases with unexpected disconnects, prioritize memory efficiency, or evaluate alternative distribution models..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 leading-relaxed font-sans mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="px-3.5 py-1.5 text-xs rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerReDeliberation}
                className="px-4 py-1.5 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Council &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
