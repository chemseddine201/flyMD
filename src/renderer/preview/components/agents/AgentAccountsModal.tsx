import React, { useEffect, useState } from 'react';
import {
  AgentProfile,
  AgentCredentialConfig,
  AgentCredentialsMap,
} from '../../../../shared/types';
import {
  X,
  KeyRound,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface AgentAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: AgentProfile[];
  onProfilesUpdated: (profiles: AgentProfile[]) => void;
}

export const AgentAccountsModal: React.FC<AgentAccountsModalProps> = ({
  isOpen,
  onClose,
  profiles,
  onProfilesUpdated,
}) => {
  const [credentials, setCredentials] = useState<AgentCredentialsMap>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string>('claude-code');
  const [isScanning, setIsScanning] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

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

  const currentCred: AgentCredentialConfig = credentials[selectedProfile.id] || {};

  const updateCredField = (patch: Partial<AgentCredentialConfig>) => {
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
      setStatusBanner('Scanned system PATH and IDE directories for installed agents.');
      setTimeout(() => setStatusBanner(null), 3500);
    } finally {
      setIsScanning(false);
    }
  };

  const handleOfficialLogin = async (agent: AgentProfile) => {
    try {
      const msg = await window.electronAPI.launchAgentLogin(agent.id);
      const updated = await window.electronAPI.discoverAgents();
      onProfilesUpdated(updated);
      setStatusBanner(msg);
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err: any) {
      setStatusBanner(`Login notice: ${err?.message || String(err)}`);
    }
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await window.electronAPI.saveAgentCredential(
      selectedProfile.id,
      currentCred
    );
    onProfilesUpdated(updated);
    setStatusBanner(`Saved connection settings for ${selectedProfile.name}`);
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const renderStatusBadge = (agent: AgentProfile) => {
    if (agent.authStatus === 'connected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> Connected
        </span>
      );
    }
    if (agent.authStatus === 'api-key-ready') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
          <KeyRound className="w-3 h-3" /> API Key Ready
        </span>
      );
    }
    if (agent.installed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <AlertCircle className="w-3 h-3" /> Installed • Login Optional
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        Workflow Bridge Ready
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-slate-100 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Connect AI Coding Agents & IDEs
              </h2>
              <p className="text-[11px] text-slate-400">
                Log in with your official agent accounts or add API keys so FlyMD can hand off Markdown plans & tasks seamlessly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRescan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-slate-200 font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-sky-400' : ''}`} />
              <span>Re-Scan Installed Tools</span>
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
          <div className="px-6 py-2 bg-sky-500/15 border-b border-sky-500/30 text-sky-200 flex items-center gap-2 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Agent List */}
          <div className="w-72 border-r border-slate-800 bg-slate-950/50 p-3 space-y-1.5 overflow-y-auto shrink-0">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Supported Agents ({profiles.length})
            </div>
            {profiles.map((agent) => {
              const isSelected = agent.id === selectedProfile.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-slate-800/90 border-sky-500/50 shadow-md'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: agent.accentColor }}
                      />
                      <span className="font-bold text-slate-100 text-xs">
                        {agent.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{agent.vendor}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    {renderStatusBadge(agent)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Agent Details & Login Form */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
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
                    by {selectedProfile.vendor}
                  </span>
                </div>
                <p className="text-slate-300 mt-1 text-xs leading-relaxed">
                  {selectedProfile.description}
                </p>
              </div>
              {renderStatusBadge(selectedProfile)}
            </div>

            {/* Step 1: One-Click Official Account Login */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                    Option 1: Connect Official Subscription Account (Recommended)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sign in using {selectedProfile.name}&apos;s official login flow ({selectedProfile.loginCommand || 'native session'}). No password is ever stored by FlyMD.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOfficialLogin(selectedProfile)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md shadow-sky-600/20 transition flex items-center gap-1.5 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Login to {selectedProfile.shortName}</span>
                </button>
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Detected Executable:</span>
                  <code className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-200 font-mono">
                    {selectedProfile.detectedBinaryPath || 'Using Workspace Workflow Bridge'}
                  </code>
                </div>
              </div>
            </div>

            {/* Step 2: API Key & Custom Configuration */}
            <form onSubmit={handleSaveCredential} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3.5">
              <h4 className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Option 2: Direct API Key & Custom Path (Optional)
              </h4>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">
                  Account Label / Nickname
                </label>
                <input
                  type="text"
                  value={currentCred.connectedAccountLabel || ''}
                  onChange={(e) => updateCredField({ connectedAccountLabel: e.target.value })}
                  placeholder={`e.g. My ${selectedProfile.shortName} Pro Account`}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              {selectedProfile.envKeyName && (
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">
                    {selectedProfile.envKeyName} (Passed automatically when launching {selectedProfile.shortName})
                  </label>
                  <input
                    type="password"
                    value={currentCred.apiKey || ''}
                    onChange={(e) => updateCredField({ apiKey: e.target.value })}
                    placeholder={`Enter ${selectedProfile.envKeyName} (optional if logged in via Option 1)`}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">
                  Custom CLI / IDE Executable Path (Leave blank for auto-detection)
                </label>
                <input
                  type="text"
                  value={currentCred.customBinaryPath || ''}
                  onChange={(e) => updateCredField({ customBinaryPath: e.target.value })}
                  placeholder={selectedProfile.detectedBinaryPath || `e.g. C:\\Program Files\\${selectedProfile.shortName}\\${selectedProfile.binaryNames[0]}.exe`}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(currentCred.oauthVerified)}
                    onChange={(e) => updateCredField({ oauthVerified: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span>Mark official account session as verified & connected</span>
                </label>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Connection</span>
                </button>
              </div>
            </form>

            {/* Watched Artifact Folders Info */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                <strong className="text-slate-200">Supervised Artifact Folders:</strong>{' '}
                {selectedProfile.artifactWatchPaths.join(', ')}
              </span>
              <span className="text-emerald-400 font-medium">Auto-Synced ✓</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
