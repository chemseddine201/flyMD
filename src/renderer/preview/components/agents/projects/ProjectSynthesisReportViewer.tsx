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
} from 'lucide-react';
import { usePreviewStore } from '../../../store';
import { AgentPipelinePreset, AgentPipelineStep, AgentTaskIntent } from '../../../../../shared/types';

interface ProjectSynthesisReportViewerProps {
  workspacePath: string;
  reportMarkdown: string;
  onLaunchDedicatedPipeline: (preset: AgentPipelinePreset) => void;
  onRollupToMaster?: () => void;
}

export const ProjectSynthesisReportViewer: React.FC<ProjectSynthesisReportViewerProps> = ({
  workspacePath,
  reportMarkdown,
  onLaunchDedicatedPipeline,
  onRollupToMaster,
}) => {
  const activeProject = usePreviewStore((s) => s.activeProject);
  const agentProfiles = usePreviewStore((s) => s.agentProfiles);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState(reportMarkdown);

  const enabledAgents = agentProfiles.filter((a) => a.enabled);
  const availableAgents = enabledAgents.length > 0 ? enabledAgents : agentProfiles;

  // Extract checklist items from Markdown (e.g. - [ ] or - [x])
  const checklistItems = useMemo(() => {
    const lines = (isEditing ? editedMarkdown : reportMarkdown).split('\n');
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
  }, [reportMarkdown, editedMarkdown, isEditing]);

  const handleToggleItem = (lineIndex: number) => {
    const lines = editedMarkdown.split('\n');
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

        if (lower.includes('plan') || lower.includes('architect') || lower.includes('design')) {
          intent = 'refine-plan';
          agentId = fallbackAgent;
        } else if (lower.includes('test') || lower.includes('verify') || lower.includes('audit')) {
          intent = 'review';
          agentId = secondAgent;
        } else if (lower.includes('fix') || lower.includes('bug')) {
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
        { agentId: fallbackAgent, intent: 'refine-plan', label: 'Verify Contract & Specs', requireConfirmation: false },
        { agentId: secondAgent, intent: 'build', label: 'Implement Core Components', requireConfirmation: false },
        { agentId: fallbackAgent, intent: 'review', label: 'Evidence Audit & Settle', requireConfirmation: false }
      );
    }

    const preset: AgentPipelinePreset = {
      id: `pipeline-proj-${activeProject?.id || Date.now()}`,
      name: `${activeProject?.name || 'Project'} Dedicated Pipeline`,
      description: `Targeted execution derived from Synthesis Report (${steps.length} steps)`,
      steps,
    };

    onLaunchDedicatedPipeline(preset);
  };

  const completedCount = checklistItems.filter((i) => i.checked).length;
  const progressPercent =
    checklistItems.length > 0
      ? Math.round((completedCount / checklistItems.length) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-cyan-400" />
          <div>
            <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              Synthesis Report & Operator Gate
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-700/60">
                Evidence Graded
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Review contractual specifications and checklist before provisioning dedicated pipeline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {isEditing ? <Save className="w-3.5 h-3.5 text-indigo-400" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isEditing ? 'Done Editing' : 'Edit Report'}</span>
          </button>

          <button
            type="button"
            onClick={handleBuildPipelineFromReport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-md transition-all hover:scale-[1.01]"
          >
            <Rocket className="w-3.5 h-3.5 fill-current" />
            <span>Provision & Launch Dedicated Pipeline &gt;</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Report Content */}
        <div className="flex-1 overflow-y-auto p-4 border-r border-slate-800">
          {isEditing ? (
            <textarea
              value={editedMarkdown}
              onChange={(e) => setEditedMarkdown(e.target.value)}
              className="w-full h-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
            />
          ) : (
            <div className="prose prose-invert prose-xs max-w-none font-sans text-slate-200 leading-relaxed space-y-3">
              <pre className="whitespace-pre-wrap font-sans bg-transparent p-0 border-0 text-slate-200 text-xs">
                {editedMarkdown || reportMarkdown}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Operator Checklist Gate */}
        <div className="w-80 bg-slate-950/40 p-3.5 flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
              Checklist Tasks ({completedCount}/{checklistItems.length})
            </span>
            <span className="text-[11px] font-mono text-indigo-400">
              {progressPercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Checklist Items */}
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {checklistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center text-slate-500 text-xs">
                <CheckSquare className="w-6 h-6 mb-1 text-slate-600" />
                <p>No `- [ ]` tasks found in report.</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  Click 'Edit Report' to add action items like `- [ ] Implement API`.
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
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 text-slate-400 hover:text-indigo-400 shrink-0"
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
          <div className="mt-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBuildPipelineFromReport}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center justify-center gap-1.5 transition-colors"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Launch Pipeline from Tasks</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
