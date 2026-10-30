import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Sparkles,
  FileText,
  Shield,
  BookOpen,
  Terminal,
  CheckCircle2,
  RotateCcw,
  Sliders,
  HelpCircle,
  Copy,
  Zap,
} from 'lucide-react';
import {
  CustomPipelineAction,
  CustomActionEpistemicPolicy,
  CustomActionIconKey,
} from '../../../../../shared/types';
import { STARTER_CUSTOM_PIPELINE_ACTIONS } from '../../../../../shared/constants';

interface CustomPipelineActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customActions: CustomPipelineAction[];
  onSaveAction: (action: CustomPipelineAction) => void;
  onDeleteAction: (actionId: string) => void;
  onSelectActionForStep?: (actionId: string) => void;
}

export const renderCustomActionIcon = (
  iconKey: CustomActionIconKey | string,
  className = 'w-3.5 h-3.5'
) => {
  switch (iconKey) {
    case 'shield':
      return <Shield className={className} />;
    case 'book-open':
      return <BookOpen className={className} />;
    case 'terminal':
      return <Terminal className={className} />;
    case 'check-circle':
      return <CheckCircle2 className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'file-text':
    default:
      return <FileText className={className} />;
  }
};

export const CustomPipelineActionsModal: React.FC<CustomPipelineActionsModalProps> = ({
  isOpen,
  onClose,
  customActions,
  onSaveAction,
  onDeleteAction,
  onSelectActionForStep,
}) => {
  const [selectedActionId, setSelectedActionId] = useState<string>(
    customActions[0]?.id || STARTER_CUSTOM_PIPELINE_ACTIONS[0].id
  );

  const selectedAction =
    customActions.find((a) => a.id === selectedActionId) ||
    STARTER_CUSTOM_PIPELINE_ACTIONS.find((a) => a.id === selectedActionId) ||
    customActions[0];

  const [formName, setFormName] = useState(selectedAction?.name || '');
  const [formShortLabel, setFormShortLabel] = useState(
    selectedAction?.shortLabel || ''
  );
  const [formDescription, setFormDescription] = useState(
    selectedAction?.description || ''
  );
  const [formPromptTemplate, setFormPromptTemplate] = useState(
    selectedAction?.promptTemplate || ''
  );
  const [formOutputFileHint, setFormOutputFileHint] = useState(
    selectedAction?.outputFileHint || ''
  );
  const [formEpistemicPolicy, setFormEpistemicPolicy] =
    useState<CustomActionEpistemicPolicy>(
      selectedAction?.epistemicPolicy || 'collaborative'
    );
  const [formIconKey, setFormIconKey] = useState<CustomActionIconKey>(
    selectedAction?.iconKey || 'file-text'
  );

  const [savedNotice, setSavedNotice] = useState(false);

  // Sync form when selected action changes
  const handleSelectAction = (action: CustomPipelineAction) => {
    setSelectedActionId(action.id);
    setFormName(action.name);
    setFormShortLabel(action.shortLabel);
    setFormDescription(action.description);
    setFormPromptTemplate(action.promptTemplate);
    setFormOutputFileHint(action.outputFileHint || '');
    setFormEpistemicPolicy(action.epistemicPolicy);
    setFormIconKey(action.iconKey);
    setSavedNotice(false);
  };

  const handleCreateNew = () => {
    const newId = `custom-action-${Date.now()}`;
    const newAction: CustomPipelineAction = {
      id: newId,
      name: 'New Custom Action',
      shortLabel: 'Custom',
      description: 'Custom user-defined workflow step action',
      promptTemplate:
        'Execute this custom step carefully in the workspace. Document what was done and verify result.',
      outputFileHint: '',
      epistemicPolicy: 'collaborative',
      iconKey: 'sparkles',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSaveAction(newAction);
    handleSelectAction(newAction);
  };

  const handleApplyTemplate = (template: CustomPipelineAction) => {
    const clone: CustomPipelineAction = {
      ...template,
      id: `custom-action-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSaveAction(clone);
    handleSelectAction(clone);
  };

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formShortLabel.trim()) return;

    const updated: CustomPipelineAction = {
      id: selectedAction?.id || `custom-action-${Date.now()}`,
      name: formName.trim(),
      shortLabel: formShortLabel.trim().slice(0, 16),
      description: formDescription.trim(),
      promptTemplate: formPromptTemplate.trim(),
      outputFileHint: formOutputFileHint.trim() || undefined,
      epistemicPolicy: formEpistemicPolicy,
      iconKey: formIconKey,
      createdAt: selectedAction?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSaveAction(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);

    if (onSelectActionForStep) {
      onSelectActionForStep(updated.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Custom Pipeline Actions Library
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {customActions.length} Actions
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Define reusable steps (like Report or Security Audit) with custom prompt directives and epistemic cache modes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Split: Master List on Left, Editor on Right */}
        <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-slate-800">
          {/* Left: Saved Actions & Starter Templates */}
          <div className="w-72 p-4 flex flex-col gap-3 bg-slate-950/40 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Your Saved Actions
              </span>
              <button
                type="button"
                onClick={handleCreateNew}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
              >
                <Plus size={12} />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1">
              {customActions.map((action) => {
                const isSelected = action.id === selectedAction?.id;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleSelectAction(action)}
                    className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-950/70 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/40'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-indigo-400 shrink-0">
                        {renderCustomActionIcon(action.iconKey)}
                      </span>
                      <div className="min-w-0 truncate">
                        <div className="text-xs font-bold truncate">
                          {action.shortLabel}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {action.name}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        action.epistemicPolicy === 'independent-audit'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {action.epistemicPolicy === 'independent-audit'
                        ? 'Audit'
                        : 'Cache'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Starter Templates */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Sparkles size={11} className="text-indigo-400" />
                Quick Starter Templates
              </span>
              <div className="space-y-1">
                {STARTER_CUSTOM_PIPELINE_ACTIONS.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="w-full text-left p-2 rounded-lg bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white text-xs flex items-center justify-between group transition"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {renderCustomActionIcon(tpl.iconKey, 'w-3 h-3 text-slate-400 group-hover:text-indigo-400')}
                      <span className="truncate">{tpl.shortLabel}</span>
                    </div>
                    <span className="text-[10px] text-indigo-400 opacity-70 group-hover:opacity-100 flex items-center gap-0.5">
                      <Copy size={10} />
                      Use
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Form Editor */}
          <form
            onSubmit={handleSaveCurrent}
            className="flex-1 p-6 flex flex-col justify-between overflow-y-auto space-y-4"
          >
            <div className="space-y-4">
              {/* Short Label and Full Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Short Label <span className="text-rose-400">*</span>
                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                      (Shown in Step Pill, max 14 chars)
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={formShortLabel}
                    onChange={(e) => setFormShortLabel(e.target.value)}
                    placeholder="e.g. Report"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Action Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Comprehensive Project & Delivery Report"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Icon & Output File Hint */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Step Icon
                  </label>
                  <div className="flex items-center gap-2">
                    {(
                      [
                        'file-text',
                        'shield',
                        'sparkles',
                        'book-open',
                        'terminal',
                        'check-circle',
                      ] as CustomActionIconKey[]
                    ).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setFormIconKey(k)}
                        className={`p-2 rounded-xl border transition ${
                          formIconKey === k
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                        title={k}
                      >
                        {renderCustomActionIcon(k, 'w-4 h-4')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Deliverable File (Optional)
                  </label>
                  <input
                    type="text"
                    value={formOutputFileHint}
                    onChange={(e) => setFormOutputFileHint(e.target.value)}
                    placeholder="e.g. PROJECT_REPORT.md"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Generates an executive Markdown report documenting architecture and deliverables."
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Epistemic Policy Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Multi-Agent Epistemic & Cognitive Cache Policy</span>
                  <span className="text-[10px] text-slate-400">Controls context handoff & cost</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormEpistemicPolicy('collaborative')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      formEpistemicPolicy === 'collaborative'
                        ? 'bg-sky-950/60 border-sky-500/80 text-white shadow-sm ring-1 ring-sky-500/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <Zap size={16} className="text-sky-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-sky-200">
                        ⚡ Inherit Verified Cache (Fast & Economical)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        DirectInherit: Passes .flymd/cache digest. Saves ~80% tokens by skipping full-repo file rescans. Ideal for reports, docs, and summaries.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormEpistemicPolicy('independent-audit')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                      formEpistemicPolicy === 'independent-audit'
                        ? 'bg-amber-950/60 border-amber-500/80 text-white shadow-sm ring-1 ring-amber-500/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <Shield size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-amber-200">
                        🛡️ Blind Independent Audit (Anti-Bias Rigor)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Withholds upstream praise; forces agent to inspect raw code on disk and conclude its own &lt;independent_resume&gt;. Ideal for security & QA audits.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Prompt Template Directive */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Prompt Instructions Directive <span className="text-rose-400">*</span>
                  <span className="text-[10px] font-normal text-slate-400 ml-1">
                    (Injected into agent when executing this step)
                  </span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={formPromptTemplate}
                  onChange={(e) => setFormPromptTemplate(e.target.value)}
                  placeholder="Enter detailed directives for the agent executing this action..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono leading-relaxed resize-y"
                />
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {customActions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedAction) {
                        onDeleteAction(selectedAction.id);
                        const remaining = customActions.filter(
                          (a) => a.id !== selectedAction.id
                        );
                        if (remaining[0]) handleSelectAction(remaining[0]);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs font-medium transition"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                )}
                {savedNotice && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-fadeIn">
                    <CheckCircle2 size={13} /> Saved!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Save size={13} />
                  <span>Save Action</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
