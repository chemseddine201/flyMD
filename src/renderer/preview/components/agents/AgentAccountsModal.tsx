import React, { useEffect, useState } from 'react';
import {
  AgentProfile,
  AgentCredentialConfig,
  AgentCredentialsMap,
} from '../../../../shared/types';
import {
  X,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  Terminal,
  Save,
  ShieldCheck,
  Sparkles,
  Globe,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AgentAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: AgentProfile[];
  onProfilesUpdated: (profiles: AgentProfile[]) => void;
}

const CUSTOM_AGENT_PRESETS = [
  {
    name: 'DeepSeek Web',
    vendor: 'DeepSeek AI',
    webUrl: 'https://chat.deepseek.com',
    accentColor: '#38bdf8',
    description: 'DeepSeek V3 & R1 free web chat for coding and architecture reasoning.',
  },
  {
    name: 'Perplexity AI',
    vendor: 'Perplexity',
    webUrl: 'https://www.perplexity.ai',
    accentColor: '#2dd4bf',
    description: 'Real-time web research and technical documentation synthesis agent.',
  },
  {
    name: 'Bolt.new',
    vendor: 'StackBlitz',
    webUrl: 'https://bolt.new',
    accentColor: '#f59e0b',
    description: 'Full-stack web application builder in the browser.',
  },
  {
    name: 'v0.dev',
    vendor: 'Vercel',
    webUrl: 'https://v0.dev',
    accentColor: '#e2e8f0',
    description: 'UI and React component generation assistant by Vercel.',
  },
  {
    name: 'Windsurf',
    vendor: 'Codeium',
    webUrl: 'https://codeium.com/windsurf',
    loginCommand: 'windsurf',
    accentColor: '#10b981',
    description: 'Agentic IDE with Cascade multi-file flows.',
  },
  {
    name: 'Aider CLI',
    vendor: 'Aider',
    webUrl: 'https://aider.chat',
    loginCommand: 'aider',
    accentColor: '#a78bfa',
    description: 'AI pair programming in your local terminal.',
  },
];

const ACCENT_PALETTE = [
  '#10b981',
  '#38bdf8',
  '#fb923c',
  '#a78bfa',
  '#f472b6',
  '#facc15',
];

export const AgentAccountsModal: React.FC<AgentAccountsModalProps> = ({
  isOpen,
  onClose,
  profiles,
  onProfilesUpdated,
}) => {
  const [credentials, setCredentials] = useState<AgentCredentialsMap>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string>('claude-code');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // New Custom Agent Form State
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomVendor, setNewCustomVendor] = useState('Custom Agent');
  const [newCustomWebUrl, setNewCustomWebUrl] = useState('https://');
  const [newCustomCliCmd, setNewCustomCliCmd] = useState('');
  const [newCustomDesc, setNewCustomDesc] = useState('');
  const [newCustomColor, setNewCustomColor] = useState('#10b981');
  const [hidePredefinedOnCreate, setHidePredefinedOnCreate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      window.electronAPI.getAgentCredentials().then((creds) => {
        setCredentials(creds || {});
      });
      if (profiles.length > 0 && !profiles.some((p) => p.id === selectedAgentId)) {
        setSelectedAgentId(profiles[0].id);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedProfile =
    profiles.find((p) => p.id === selectedAgentId) || profiles[0];

  const currentCred: AgentCredentialConfig =
    (selectedProfile && credentials[selectedProfile.id]) || {};

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const updateCredField = (patch: Partial<AgentCredentialConfig>) => {
    if (!selectedProfile) return;
    setCredentials((prev) => ({
      ...prev,
      [selectedProfile.id]: {
        ...(prev[selectedProfile.id] || {}),
        ...patch,
      },
    }));
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const updated = await window.electronAPI.discoverAgents();
      onProfilesUpdated(updated);
      showToast('Refreshed all built-in and custom agents.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleBrowserWebLogin = async (agent: AgentProfile) => {
    try {
      const msg = await window.electronAPI.launchAgentWebAuth(agent.id);
      const [updated, creds] = await Promise.all([
        window.electronAPI.discoverAgents(),
        window.electronAPI.getAgentCredentials(),
      ]);
      onProfilesUpdated(updated);
      setCredentials(creds || {});
      showToast(msg);
    } catch (err: any) {
      showToast(`Browser notice: ${err?.message || String(err)}`);
    }
  };

  const handleCliTerminalLogin = async (agent: AgentProfile) => {
    try {
      const msg = await window.electronAPI.launchAgentLogin(agent.id);
      const [updated, creds] = await Promise.all([
        window.electronAPI.discoverAgents(),
        window.electronAPI.getAgentCredentials(),
      ]);
      onProfilesUpdated(updated);
      setCredentials(creds || {});
      showToast(msg);
    } catch (err: any) {
      showToast(`CLI Login notice: ${err?.message || String(err)}`);
    }
  };

  const handleToggleAgentEnabled = async (agent: AgentProfile) => {
    const existing = credentials[agent.id] || {};
    const nextDisabled = agent.enabled;
    const updatedCred: AgentCredentialConfig = {
      ...existing,
      disabled: nextDisabled,
    };
    setCredentials((prev) => ({ ...prev, [agent.id]: updatedCred }));
    const updated = await window.electronAPI.saveAgentCredential(agent.id, updatedCred);
    onProfilesUpdated(updated);
    showToast(
      nextDisabled
        ? `Hidden ${agent.name} from the active dock.`
        : `Enabled ${agent.name} in the active dock.`
    );
  };

  const handleUseOnlyCustomAgents = async () => {
    const customExists = profiles.some((p) => p.isCustom);
    if (!customExists) {
      setIsCreatingCustom(true);
      showToast('Create your first Custom Agent below to use it instead of predefined agents!');
      return;
    }
    let latestProfiles = profiles;
    for (const p of profiles) {
      if (!p.isCustom) {
        const existing = credentials[p.id] || {};
        latestProfiles = await window.electronAPI.saveAgentCredential(p.id, {
          ...existing,
          disabled: true,
        });
      } else {
        const existing = credentials[p.id] || {};
        latestProfiles = await window.electronAPI.saveAgentCredential(p.id, {
          ...existing,
          disabled: false,
        });
      }
    }
    const creds = await window.electronAPI.getAgentCredentials();
    setCredentials(creds || {});
    onProfilesUpdated(latestProfiles);
    showToast('Hidden predefined agents — now showing only your Custom Agents!');
  };

  const handleShowAllAgents = async () => {
    let latestProfiles = profiles;
    for (const p of profiles) {
      const existing = credentials[p.id] || {};
      if (existing.disabled) {
        latestProfiles = await window.electronAPI.saveAgentCredential(p.id, {
          ...existing,
          disabled: false,
        });
      }
    }
    const creds = await window.electronAPI.getAgentCredentials();
    setCredentials(creds || {});
    onProfilesUpdated(latestProfiles);
    showToast('All predefined and custom agents are now visible.');
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    const updated = await window.electronAPI.saveAgentCredential(
      selectedProfile.id,
      currentCred
    );
    onProfilesUpdated(updated);
    showToast(`Saved settings for ${selectedProfile.name}`);
  };

  const handleCreateCustomAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCustomName.trim();
    if (!cleanName) return;

    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const customId = `custom-${slug || Date.now()}`;

    const newCred: AgentCredentialConfig = {
      isCustomAgent: true,
      customName: cleanName,
      customVendor: newCustomVendor.trim() || 'Custom Agent',
      customDescription:
        newCustomDesc.trim() ||
        `Custom agent (${cleanName}) configured for Markdown handoffs.`,
      customAccentColor: newCustomColor,
      customWebUrl:
        newCustomWebUrl.trim() && newCustomWebUrl.trim() !== 'https://'
          ? newCustomWebUrl.trim()
          : undefined,
      customBinaryPath: newCustomCliCmd.trim() || undefined,
      customLoginCommand: newCustomCliCmd.trim() || undefined,
      webSessionVerified: Boolean(
        newCustomWebUrl.trim() && newCustomWebUrl.trim() !== 'https://'
      ),
      disabled: false,
    };

    let updated = await window.electronAPI.saveAgentCredential(customId, newCred);

    if (hidePredefinedOnCreate) {
      for (const p of updated) {
        if (!p.isCustom) {
          const existing = credentials[p.id] || {};
          updated = await window.electronAPI.saveAgentCredential(p.id, {
            ...existing,
            disabled: true,
          });
        }
      }
    }

    const creds = await window.electronAPI.getAgentCredentials();
    setCredentials(creds || {});
    onProfilesUpdated(updated);
    setIsCreatingCustom(false);
    setSelectedAgentId(customId);
    setNewCustomName('');
    setNewCustomDesc('');
    setNewCustomCliCmd('');
    setNewCustomWebUrl('https://');
    showToast(`Created custom agent "${cleanName}"!`);
  };

  const handleDeleteCustomAgent = async (agent: AgentProfile) => {
    if (!agent.isCustom) return;
    const updated = await window.electronAPI.removeAgentProfile(agent.id);
    const creds = await window.electronAPI.getAgentCredentials();
    setCredentials(creds || {});
    onProfilesUpdated(updated);
    if (updated.length > 0) {
      setSelectedAgentId(updated[0].id);
    }
    showToast(`Removed custom agent "${agent.name}".`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/90 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Manage AI Agents, Browser Login &amp; Custom Agents
              </h2>
              <p className="text-[11px] text-slate-300">
                Use built-in agents or create your own Custom Agents. Sign in via your normal Web Browser (Free Tier) or local CLI.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingCustom(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Agent</span>
            </button>
            <button
              type="button"
              onClick={handleRescan}
              disabled={isScanning}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-slate-200 transition"
              title="Refresh Agents"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="px-6 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-200 flex items-center gap-2 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Agent List + Quick Filter Buttons */}
          <div className="w-72 border-r border-slate-800 bg-slate-950/60 p-3 flex flex-col gap-2 overflow-y-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsCreatingCustom(true)}
              className={`w-full p-2.5 rounded-xl border text-left font-bold flex items-center justify-center gap-1.5 transition ${
                isCreatingCustom
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Create New Custom Agent</span>
            </button>

            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Your Agents ({profiles.filter((p) => p.enabled).length} active)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUseOnlyCustomAgents}
                  className="text-[10px] text-emerald-400 hover:underline"
                  title="Hide predefined agents and show only your Custom Agents"
                >
                  Custom Only
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={handleShowAllAgents}
                  className="text-[10px] text-sky-400 hover:underline"
                >
                  Show All
                </button>
              </div>
            </div>

            <div className="space-y-1.5 flex-1 overflow-y-auto pr-0.5">
              {profiles.map((agent) => {
                const isSelected = !isCreatingCustom && agent.id === selectedProfile?.id;
                return (
                  <div
                    key={agent.id}
                    onClick={() => {
                      setIsCreatingCustom(false);
                      setSelectedAgentId(agent.id);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-slate-800/95 border-sky-500/60 shadow-md'
                        : agent.enabled
                        ? 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/40'
                        : 'bg-slate-950/40 border-slate-900 opacity-50 hover:opacity-80'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: agent.accentColor }}
                        />
                        <span className="font-bold text-slate-100 truncate">
                          {agent.name}
                        </span>
                        {agent.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {agent.webUrl || agent.loginCommand || agent.vendor}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAgentEnabled(agent);
                      }}
                      title={
                        agent.enabled
                          ? 'Visible in Dock (Click to hide)'
                          : 'Hidden from Dock (Click to show)'
                      }
                      className={`p-1.5 rounded-lg border transition ${
                        agent.enabled
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {agent.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Either Create Custom Agent OR Edit Selected Agent */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isCreatingCustom ? (
              <form onSubmit={handleCreateCustomAgent} className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      Add Your Own Custom AI Agent
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Add any web AI chat (DeepSeek, Perplexity, Bolt, v0, Qwen, local web UI) or any local CLI/IDE tool.
                    </p>
                  </div>
                </div>

                {/* 1-Click Quick Templates */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Quick 1-Click Templates (Optional — Click to Fill)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CUSTOM_AGENT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setNewCustomName(preset.name);
                          setNewCustomVendor(preset.vendor);
                          setNewCustomWebUrl(preset.webUrl);
                          setNewCustomCliCmd(preset.loginCommand || '');
                          setNewCustomDesc(preset.description);
                          setNewCustomColor(preset.accentColor);
                        }}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition flex items-center gap-2"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{preset.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{preset.vendor}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-200 font-semibold mb-1">
                      Agent Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCustomName}
                      onChange={(e) => setNewCustomName(e.target.value)}
                      placeholder="e.g. DeepSeek Chat, My Custom Bot, Windsurf..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-200 font-semibold mb-1">
                      Provider / Label
                    </label>
                    <input
                      type="text"
                      value={newCustomVendor}
                      onChange={(e) => setNewCustomVendor(e.target.value)}
                      placeholder="e.g. Custom Web Agent, Local Agent..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-200 font-semibold mb-1">
                    Web Chat URL (Opens in your default browser for Free Tier)
                  </label>
                  <input
                    type="text"
                    value={newCustomWebUrl}
                    onChange={(e) => setNewCustomWebUrl(e.target.value)}
                    placeholder="https://chat.deepseek.com or http://localhost:3000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-200 font-semibold mb-1">
                    Local CLI Command or Executable Path (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCustomCliCmd}
                    onChange={(e) => setNewCustomCliCmd(e.target.value)}
                    placeholder="Leave blank if using Web Browser mode, or enter e.g. aider / windsurf"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="block text-slate-200 font-semibold mb-1.5">
                      Badge Color
                    </label>
                    <div className="flex items-center gap-2">
                      {ACCENT_PALETTE.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewCustomColor(col)}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            newCustomColor === col
                              ? 'border-white scale-110'
                              : 'border-transparent opacity-70'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-200 bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800">
                    <input
                      type="checkbox"
                      checked={hidePredefinedOnCreate}
                      onChange={(e) => setHidePredefinedOnCreate(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <span>Use this Custom Agent instead of predefined agents</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreatingCustom(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save &amp; Add Custom Agent</span>
                  </button>
                </div>
              </form>
            ) : selectedProfile ? (
              <div className="space-y-5">
                {/* Selected Agent Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: selectedProfile.accentColor }}
                      />
                      <h3 className="text-base font-bold text-white">
                        {selectedProfile.name}
                      </h3>
                      <span className="text-xs text-slate-400">
                        ({selectedProfile.vendor})
                      </span>
                    </div>
                    <p className="text-slate-300 mt-1 text-xs">
                      {selectedProfile.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAgentEnabled(selectedProfile)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                        selectedProfile.enabled
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {selectedProfile.enabled ? (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Shown in Dock
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Hidden from Dock
                        </>
                      )}
                    </button>

                    {selectedProfile.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomAgent(selectedProfile)}
                        className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300"
                        title="Delete Custom Agent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Method 1: System Default Browser Sign-In (Free Tier) */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-950 to-sky-950/40 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-emerald-400" />
                          1. Use in System Default Browser (Free Tier • Easiest)
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          No CMD • Free Tier
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Opens <code className="text-emerald-300">{selectedProfile.webUrl || 'https://claude.ai'}</code> directly in your system default browser (Chrome, Edge, Brave, Firefox) where your free account is already signed in!
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBrowserWebLogin(selectedProfile)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 shrink-0"
                    >
                      <Globe className="w-4 h-4" />
                      <span>Open {selectedProfile.shortName} in Browser</span>
                    </button>
                  </div>
                </div>

                {/* Method 2: Interactive CLI Login Terminal */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-sky-400" />
                      2. Official CLI Terminal Login (For Local CLI Users)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Opens an interactive terminal window to run{' '}
                      <code className="text-sky-300">
                        {selectedProfile.loginCommand || selectedProfile.binaryNames[0] || 'CLI login'}
                      </code>
                      .
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCliTerminalLogin(selectedProfile)}
                    className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-bold transition flex items-center gap-1.5 shrink-0"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Launch CLI Login Window</span>
                  </button>
                </div>

                {/* Method 3: Customize Web URL, CLI Command & Optional API Key */}
                <form
                  onSubmit={handleSaveCredential}
                  className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3"
                >
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    3. Customize Agent URL, CLI Command or API Key
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 text-[11px] block mb-1">
                        Web Chat URL (Opened in Default Browser)
                      </label>
                      <input
                        type="text"
                        value={currentCred.customWebUrl ?? selectedProfile.webUrl ?? ''}
                        onChange={(e) => updateCredField({ customWebUrl: e.target.value })}
                        placeholder="https://claude.ai/new"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[11px] block mb-1">
                        CLI Login / Launch Command
                      </label>
                      <input
                        type="text"
                        value={
                          currentCred.customLoginCommand ??
                          selectedProfile.loginCommand ??
                          ''
                        }
                        onChange={(e) =>
                          updateCredField({ customLoginCommand: e.target.value })
                        }
                        placeholder="e.g. claude login"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 text-[11px] block mb-1">
                        Custom Executable Path (Optional)
                      </label>
                      <input
                        type="text"
                        value={currentCred.customBinaryPath || ''}
                        onChange={(e) =>
                          updateCredField({ customBinaryPath: e.target.value })
                        }
                        placeholder={
                          selectedProfile.detectedBinaryPath ||
                          'Auto-detected from PATH'
                        }
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[11px] block mb-1">
                        Developer API Key (Optional)
                      </label>
                      <input
                        type="password"
                        value={currentCred.apiKey || ''}
                        onChange={(e) => updateCredField({ apiKey: e.target.value })}
                        placeholder="Not needed for Browser Free Tier"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl shadow-sm transition"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Agent Settings</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
