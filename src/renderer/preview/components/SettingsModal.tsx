import React, { useState, useEffect } from 'react';
import { AppSettings, AppTheme, PreviewWidthMode, AccessibilityConfig } from '../../../shared/types';
import { DEFAULT_A11Y_CONFIG } from '../../../shared/constants';
import { Settings, X, Save, Eye, Palette, FileCode, Plus, Check, Asterisk } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: Partial<AppSettings>) => void;
}

const SETTINGS_COMMON_PRESETS = [
  { label: 'Markdown', ext: '.md', icon: '📝' },
  { label: 'Text', ext: '.txt', icon: '📄' },
  { label: 'HTML', ext: '.html', icon: '🌐' },
  { label: 'CSS', ext: '.css', icon: '🎨' },
  { label: 'JavaScript', ext: '.js', icon: '⚡' },
  { label: 'TypeScript', ext: '.ts', icon: '🔷' },
  { label: 'JSON', ext: '.json', icon: '📦' },
  { label: 'Python', ext: '.py', icon: '🐍' },
  { label: 'Rust', ext: '.rs', icon: '🦀' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [confirmMultipleTabs, setConfirmMultipleTabs] = useState<boolean>(() => {
    return localStorage.getItem('flymd_skip_close_tab_confirm') !== 'true';
  });
  const [customExtInput, setCustomExtInput] = useState<string>('');

  useEffect(() => {
    setFormData(settings);
    setConfirmMultipleTabs(localStorage.getItem('flymd_skip_close_tab_confirm') !== 'true');
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const currentExts = formData.defaultAllowedExtensions || ['.md', '.markdown'];
  const isAllFiles = currentExts.includes('*.*') || currentExts.includes('*');

  const normalizeExt = (raw: string): string => {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return '';
    if (trimmed === '*' || trimmed === '*.*') return '*.*';
    return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
  };

  const handleAddExtension = (extToAdd?: string) => {
    const target = extToAdd || customExtInput;
    const clean = normalizeExt(target);
    if (!clean) return;

    if (clean === '*.*') {
      setFormData((prev) => ({ ...prev, defaultAllowedExtensions: ['*.*'] }));
      setCustomExtInput('');
      return;
    }

    const withoutWildcard = currentExts.filter((e) => e !== '*' && e !== '*.*');
    if (!withoutWildcard.includes(clean)) {
      setFormData((prev) => ({
        ...prev,
        defaultAllowedExtensions: [...withoutWildcard, clean],
      }));
    }
    setCustomExtInput('');
  };

  const handleRemoveExtension = (extToRemove: string) => {
    const updated = currentExts.filter((e) => e !== extToRemove);
    setFormData((prev) => ({
      ...prev,
      defaultAllowedExtensions: updated.length === 0 ? ['.md', '.markdown'] : updated,
    }));
  };

  const handleTogglePreset = (ext: string) => {
    const clean = normalizeExt(ext);
    if (isAllFiles) {
      setFormData((prev) => ({
        ...prev,
        defaultAllowedExtensions: ['.md', '.markdown', clean],
      }));
      return;
    }
    if (currentExts.includes(clean)) {
      handleRemoveExtension(clean);
    } else {
      handleAddExtension(clean);
    }
  };

  const handleSetMarkdownOnly = () => {
    setFormData((prev) => ({
      ...prev,
      defaultAllowedExtensions: ['.md', '.markdown'],
    }));
  };

  const handleSetWebDev = () => {
    setFormData((prev) => ({
      ...prev,
      defaultAllowedExtensions: ['.md', '.markdown', '.html', '.css', '.js', '.ts', '.json'],
    }));
  };

  const handleToggleAllFiles = () => {
    setFormData((prev) => ({
      ...prev,
      defaultAllowedExtensions: isAllFiles ? ['.md', '.markdown'] : ['*.*'],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const updateA11y = (patch: Partial<AccessibilityConfig>) => {
    setFormData((prev) => ({
      ...prev,
      a11yConfig: {
        ...(prev.a11yConfig || DEFAULT_A11Y_CONFIG),
        ...patch,
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100 text-xs">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/80 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-sky-400" />
            <h2 className="font-bold text-slate-100">FlyMD Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Appearance & Themes */}
          <div className="space-y-3 pb-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Appearance & Themes
            </h3>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Design Theme</label>
              <select
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value as AppTheme })}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="dark">GitHub Dark (Default)</option>
                <option value="light">GitHub Light</option>
                <option value="tokyo-night">Tokyo Night (Deep Indigo)</option>
                <option value="catppuccin">Catppuccin Mocha (Soft Pastel)</option>
                <option value="dracula">Dracula (Vampire Purple)</option>
                <option value="sepia">Warm Sepia (Eye Comfort)</option>
                <option value="cyber">Cyberpunk (Neon Yellow/Cyan)</option>
                <option value="high-contrast">High Contrast (WCAG AAA)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Preview Layout Max-Width</label>
              <select
                value={formData.previewWidthMode || 'wide'}
                onChange={(e) => setFormData({ ...formData, previewWidthMode: e.target.value as PreviewWidthMode })}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="standard">Standard Reading (896px / max-w-4xl)</option>
                <option value="wide">Wide Balanced (1280px / max-w-7xl)</option>
                <option value="full">Full Width (100% Unconstrained)</option>
              </select>
            </div>
          </div>

          {/* Visual Accessibility Suite */}
          <div className="space-y-2.5 pb-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Accessibility & Readability
            </h3>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <div>
                <span className="font-medium text-slate-200 block">High Contrast Mode</span>
                <span className="text-[10px] text-slate-400">Maximize visual separation with WCAG AAA pure black/white canvas</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.a11yConfig?.highContrast)}
                onChange={(e) => updateA11y({ highContrast: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <div>
                <span className="font-medium text-slate-200 block">Dyslexia-Friendly Typography</span>
                <span className="text-[10px] text-slate-400">Apply high-readability letter spacing and bottom-weighted font</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.a11yConfig?.dyslexicFont)}
                onChange={(e) => updateA11y({ dyslexicFont: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <div>
                <span className="font-medium text-slate-200 block">Large Print Mode</span>
                <span className="text-[10px] text-slate-400">Scale base typography up 1.25x for users with low vision</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.a11yConfig?.largePrint)}
                onChange={(e) => updateA11y({ largePrint: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <div>
                <span className="font-medium text-slate-200 block">Reduced Motion</span>
                <span className="text-[10px] text-slate-400">Disable UI animations and smooth scroll effects</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.a11yConfig?.reducedMotion)}
                onChange={(e) => updateA11y({ reducedMotion: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <div>
                <span className="font-medium text-slate-200 block">Color-Blind Safe Badges</span>
                <span className="text-[10px] text-slate-400">Show explicit [NEW] text labels instead of relying solely on green color</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.a11yConfig?.colorBlindSafe)}
                onChange={(e) => updateA11y({ colorBlindSafe: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>
          </div>

          {/* LLM & AI Settings */}
          <div className="space-y-3 pb-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              AI & Translation
            </h3>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">LLM Provider</label>
              <select
                value={formData.llmConfig?.provider || 'ollama'}
                onChange={(e) => {
                  const prov = e.target.value as any;
                  const endpoint = prov === 'ollama' ? 'http://127.0.0.1:11434' : (formData.llmConfig?.endpointUrl && formData.llmConfig.endpointUrl !== 'http://127.0.0.1:11434' ? formData.llmConfig.endpointUrl : 'https://api.openai.com/v1');
                  setFormData({
                    ...formData,
                    llmConfig: {
                      ...(formData.llmConfig || {}),
                      provider: prov,
                      endpointUrl: endpoint,
                      model: formData.llmConfig?.model || formData.ollamaModel || 'qwen2.5:3b',
                    },
                  });
                }}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="ollama">Ollama (Local Default)</option>
                <option value="openai-compatible">OpenAI-Compatible (OpenAI, Groq, OpenRouter, vLLM)</option>
                <option value="custom">Custom Server</option>
              </select>
            </div>

            {/* Server URL */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">LLM Server Endpoint URL</label>
              <input
                type="text"
                value={formData.llmConfig?.endpointUrl || formData.ollamaUrl}
                onChange={(e) => {
                  const url = e.target.value;
                  setFormData({
                    ...formData,
                    ollamaUrl: url,
                    llmConfig: {
                      ...(formData.llmConfig || { provider: 'ollama', model: formData.ollamaModel }),
                      endpointUrl: url,
                    },
                  });
                }}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                placeholder="http://127.0.0.1:11434 or https://api.openai.com/v1"
              />
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">API Key (Optional for local Ollama)</label>
              <input
                type="password"
                value={formData.llmConfig?.apiKey || ''}
                onChange={(e) => {
                  const key = e.target.value;
                  setFormData({
                    ...formData,
                    llmConfig: {
                      ...(formData.llmConfig || { provider: 'ollama', endpointUrl: formData.ollamaUrl, model: formData.ollamaModel }),
                      apiKey: key,
                    },
                  });
                }}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                placeholder="sk-... (Leave blank for local Ollama)"
              />
            </div>

            {/* Default Model */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Default Model</label>
              <input
                type="text"
                value={formData.llmConfig?.model || formData.ollamaModel}
                onChange={(e) => {
                  const m = e.target.value;
                  setFormData({
                    ...formData,
                    ollamaModel: m,
                    llmConfig: {
                      ...(formData.llmConfig || { provider: 'ollama', endpointUrl: formData.ollamaUrl }),
                      model: m,
                    },
                  });
                }}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                placeholder="qwen2.5:3b or gpt-4o-mini"
              />
            </div>
          </div>

          {/* Editor & General Behavior */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Editor & System
            </h3>

            {/* Default View Mode */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Default View on Open</label>
              <select
                value={formData.defaultView}
                onChange={(e) => setFormData({ ...formData, defaultView: e.target.value as any })}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="split">Split View (Editor + Preview)</option>
                <option value="preview">Preview Only</option>
                <option value="editor">Editor Only</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Editor Font Size: {formData.fontSize}px</label>
              <input
                type="range"
                min={11}
                max={28}
                value={formData.fontSize}
                onChange={(e) => setFormData({ ...formData, fontSize: Number(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="font-semibold text-slate-300">Auto-save changes</label>
              <input
                type="checkbox"
                checked={formData.autoSave}
                onChange={(e) => setFormData({ ...formData, autoSave: e.target.checked })}
                className="w-4 h-4 accent-sky-500 rounded"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="font-semibold text-slate-300 block">Confirm closing multiple tabs</label>
                <span className="text-[10px] text-slate-500">Ask for confirmation when closing all or other tabs</span>
              </div>
              <input
                type="checkbox"
                checked={confirmMultipleTabs}
                onChange={(e) => {
                  const nextVal = e.target.checked;
                  setConfirmMultipleTabs(nextVal);
                  if (nextVal) {
                    localStorage.removeItem('flymd_skip_close_tab_confirm');
                  } else {
                    localStorage.setItem('flymd_skip_close_tab_confirm', 'true');
                  }
                }}
                className="w-4 h-4 accent-sky-500 rounded"
              />
            </div>

            {/* Default Supervised Extensions & File Types */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Default Supervised Extensions for New Folders</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {isAllFiles ? '*.*' : `${currentExts.length} extensions`}
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSetMarkdownOnly}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                    !isAllFiles &&
                    currentExts.length <= 2 &&
                    currentExts.every((e) => e === '.md' || e === '.markdown')
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📝 Markdown Only
                </button>

                <button
                  type="button"
                  onClick={handleSetWebDev}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                    !isAllFiles && currentExts.includes('.html') && currentExts.includes('.js')
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🌐 Web Dev (.html, .css, .js, .ts)
                </button>

                <button
                  type="button"
                  onClick={handleToggleAllFiles}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition flex items-center gap-1 ${
                    isAllFiles
                      ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Asterisk className="w-2.5 h-2.5 text-amber-400" />
                  <span>All Files (*.*)</span>
                </button>
              </div>

              {/* Active Extension Chips */}
              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800">
                {isAllFiles ? (
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-semibold">
                      *.* (All files supervised)
                    </span>
                    <button
                      type="button"
                      onClick={handleSetMarkdownOnly}
                      className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                    >
                      Reset to Markdown only
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 min-h-[26px] items-center">
                    {currentExts.map((ext) => (
                      <span
                        key={ext}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-[10px]"
                      >
                        <span>{ext}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExtension(ext)}
                          title={`Remove ${ext}`}
                          className="hover:text-rose-400 text-slate-400 p-0.5 rounded transition"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick toggle common presets */}
              {!isAllFiles && (
                <div className="flex flex-wrap gap-1">
                  {SETTINGS_COMMON_PRESETS.map((p) => {
                    const isSelected = currentExts.includes(p.ext);
                    return (
                      <button
                        key={p.ext}
                        type="button"
                        onClick={() => handleTogglePreset(p.ext)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition flex items-center gap-1 border ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <span>{p.icon}</span>
                        <span>{p.ext}</span>
                        {isSelected && <Check className="w-2.5 h-2.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Add Custom Extension Tag */}
              {!isAllFiles && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <input
                    type="text"
                    placeholder="Add extension (e.g. py, tsx, yaml, sql...)"
                    value={customExtInput}
                    onChange={(e) => setCustomExtInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExtension();
                      }
                    }}
                    className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddExtension()}
                    disabled={!customExtInput.trim()}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-medium text-xs flex items-center gap-1 transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
