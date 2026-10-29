import React, { useEffect, useRef, useState } from 'react';
import {
  usePreviewStore,
  selectActiveTab,
} from './store';
import {
  FileOpenResult,
  FolderSupervisionConfig,
  ScanDepthMode,
  ScannedMdFile,
  AppTheme,
  PreviewWidthMode,
  AccessibilityConfig,
  AgentProfile,
  AgentTaskRecord,
  AgentCheckpoint,
} from '../../shared/types';
import { resolveDirection } from '../../shared/utils';
import { exportService, ExportFormatId } from './services/export';
import { TitleBar } from './components/TitleBar';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { OllamaModal } from './components/OllamaModal';
import { SettingsModal } from './components/SettingsModal';
import { SupervisionModal } from './components/SupervisionModal';
import { SaveExportModal } from './components/SaveExportModal';
import { AccessibilityModal } from './components/accessibility/AccessibilityModal';
import { AppContextMenu } from './components/AppContextMenu';
import {
  AgentAccountsModal,
  AgentDispatchModal,
  CouncilModal,
  AgentDock,
} from './components/agents';
import { useHotkeys } from '../shared/hooks/useHotkeys';
import { useFileDrop } from '../shared/hooks/useFileDrop';
import { useIpcEvent } from '../shared/hooks/useIpcEvent';
import { THEME_CLASSES } from '../../shared/constants';
import { undo, redo } from '@codemirror/commands';
import { scheduleBadgeClear } from './store/utils/badgeTimers';

export const PreviewApp: React.FC = () => {
  const store = usePreviewStore();
  const activeTab = selectActiveTab(store);

  const editorRef = useRef<any>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isSupervisionModalOpen, setIsSupervisionModalOpen] = useState(false);
  const [isA11yModalOpen, setIsA11yModalOpen] = useState(false);

  const [saveExportModal, setSaveExportModal] = useState<{
    isOpen: boolean;
    mode: 'save-as' | 'export';
    initialFormat?: ExportFormatId;
  }>({
    isOpen: false,
    mode: 'save-as',
  });

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      store.setSettings(s);
      store.setViewMode(s.defaultView);
    });
    window.electronAPI.getPreviewAlwaysOnTop().then(store.setIsPinned);
    window.electronAPI.getSupervision().then(async (cfg) => {
      if (cfg && cfg.path) {
        store.setSupervisionConfig(cfg);
        const files = await window.electronAPI.scanFolder(cfg.path, cfg.scanMode || 'full-tree');
        store.setFolder(cfg.path, cfg.name, files);
        store.setSidebarCollapsed(false);
      }
    });
    window.electronAPI.discoverAgents?.().then(store.setAgentProfiles).catch(() => {});
    window.electronAPI.getAgentTasks?.().then(store.setAgentTasks).catch(() => {});
    window.electronAPI.getAgentCheckpoints?.().then(store.setAgentCheckpoints).catch(() => {});
  }, []);

  useIpcEvent<FileOpenResult>(window.electronAPI.onFileLoaded, (file) => {
    store.openFileInTab(file, { activate: true });
    if (file.path && !store.folderPath) {
      const parentDir = file.path.replace(/[\\/][^\\/]+$/, '');
      if (parentDir && parentDir !== file.path) {
        const folderName = parentDir.split(/[\\/]/).pop() || 'Folder';
        window.electronAPI.scanFolder(parentDir, 'full-tree').then((files) => {
          if (files && files.length > 0) {
            store.setFolder(parentDir, folderName, files);
          }
        }).catch(() => {});
      }
    }
  });

  useIpcEvent<{ folderPath?: string; path?: string; folderName?: string; name?: string; files: ScannedMdFile[] }>(
    window.electronAPI.onFolderLoaded,
    (data) => {
      const fPath = data.folderPath || data.path || '';
      const fName = data.folderName || data.name || 'Folder';
      store.setFolder(fPath, fName, data.files || []);
      store.setSidebarCollapsed(false);
      setIsSupervisionModalOpen(true);
    }
  );

  useIpcEvent<{ file: ScannedMdFile; isNew: boolean; autoOpen: boolean }>(
    window.electronAPI.onSupervisedFileEvent,
    async (data) => {
      if (data.isNew) {
        store.markFileAsNew(data.file);
      }
      if (data.autoOpen || data.isNew) {
        const res = await window.electronAPI.readFile(data.file.path);
        if (res) {
          store.openFileInTab({ ...res, isNew: true }, { activate: false });
        }
      }
    }
  );

  useIpcEvent<ScannedMdFile[]>(window.electronAPI.onSupervisedTreeUpdated, (files) => {
    store.setFolderFiles(files);
  });

  useIpcEvent(window.electronAPI.onSettingsChanged, (s) => {
    store.setSettings(s);
  });

  useIpcEvent<AgentProfile[]>(window.electronAPI.onAgentProfilesUpdated, (profiles) => {
    if (Array.isArray(profiles)) {
      store.setAgentProfiles(profiles);
    }
  });

  useIpcEvent<AgentTaskRecord[]>(window.electronAPI.onAgentTasksUpdated, (tasks) => {
    if (Array.isArray(tasks)) {
      store.setAgentTasks(tasks);
    }
  });

  useIpcEvent<AgentCheckpoint[]>(window.electronAPI.onAgentCheckpointsUpdated, (checkpoints) => {
    if (Array.isArray(checkpoints)) {
      store.setAgentCheckpoints(checkpoints);
    }
  });

  useFileDrop({
    onFileDrop: async (filePath) => {
      await window.electronAPI.openInPreview(filePath);
    },
  });

  const handleOpen = async () => {
    const res = await window.electronAPI.openFileDialog();
    if (res) {
      store.openFileInTab(res, { activate: true });
    }
  };

  const handleOpenFolder = async () => {
    const selected = await window.electronAPI.openFolderDialog();
    if (selected) {
      const folderName = selected.split(/[\\/]/).pop() || 'Folder';
      const files = await window.electronAPI.scanFolder(selected, 'full-tree');
      store.setFolder(selected, folderName, files || []);
      store.setSidebarCollapsed(false);
      await window.electronAPI.openInPreview(selected);
    }
  };

  const handleSave = async () => {
    if (!activeTab) return;
    if (!activeTab.filePath) {
      handleOpenSaveAsDialog();
      return;
    }
    const res = await window.electronAPI.saveFile(activeTab.filePath, activeTab.content);
    if (res.success) {
      store.markActiveSaved();
    } else {
      alert(`Save failed: ${res.error}`);
    }
  };

  const handleOpenSaveAsDialog = () => {
    if (!activeTab) return;
    setSaveExportModal({
      isOpen: true,
      mode: 'save-as',
    });
  };

  const handleOpenExportDialog = (format?: ExportFormatId) => {
    if (!activeTab) return;
    setSaveExportModal({
      isOpen: true,
      mode: 'export',
      initialFormat: format || 'html',
    });
  };

  const handleConfirmSaveAs = async (targetFileName: string) => {
    const content = activeTab?.content || '';
    const res = await window.electronAPI.saveFileDialog(targetFileName, content);
    if (res.success && res.path) {
      store.markActiveSaved(res.path);
      store.setStatusMessage(`Saved file as ${targetFileName}`);
    }
  };

  const handleConfirmExport = async (targetFileName: string, format: ExportFormatId) => {
    if (!activeTab) return;
    const effectiveDir = resolveDirection(activeTab.direction, activeTab.content);
    const result = await exportService.exportDocument(format, {
      title: targetFileName,
      markdown: activeTab.content,
      direction: effectiveDir,
      theme: store.settings.theme,
    });

    if (result.success && result.path) {
      store.setStatusMessage(`Exported to ${result.path}`);
    } else if (result.error) {
      alert(`Export failed: ${result.error}`);
    }
  };

  const handleDirectExport = async (format: ExportFormatId) => {
    handleOpenExportDialog(format);
  };

  const handleQuickCopy = () => {
    if (activeTab?.content) {
      navigator.clipboard.writeText(activeTab.content);
    }
  };

  const handleTogglePin = async () => {
    const next = await window.electronAPI.togglePreviewAlwaysOnTop();
    store.setIsPinned(next);
  };

  const handleUndo = () => {
    if (!editorRef.current) return;
    if (editorRef.current.isWysiwyg) {
      editorRef.current.undo();
    } else {
      undo(editorRef.current);
    }
  };

  const handleRedo = () => {
    if (!editorRef.current) return;
    if (editorRef.current.isWysiwyg) {
      editorRef.current.redo();
    } else {
      redo(editorRef.current);
    }
  };

  const handleFormat = (prefix: string, suffix = '', defaultPlaceholder = '') => {
    if (!editorRef.current) return;
    if (editorRef.current.isWysiwyg) {
      editorRef.current.format(prefix, suffix, defaultPlaceholder);
      return;
    }
    const view = editorRef.current;
    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to) || defaultPlaceholder;
    const replacement = `${prefix}${selectedText}${suffix}`;

    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + prefix.length + selectedText.length },
    });
    view.focus();
  };

  useEffect(() => {
    const theme = store.settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const a11y = store.settings.a11yConfig;
    if (a11y?.highContrast) {
      document.documentElement.setAttribute('data-a11y-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-a11y-high-contrast');
    }
    if (a11y?.dyslexicFont) {
      document.documentElement.setAttribute('data-a11y-dyslexic', 'true');
    } else {
      document.documentElement.removeAttribute('data-a11y-dyslexic');
    }
    if (a11y?.largePrint) {
      document.documentElement.setAttribute('data-a11y-large-print', 'true');
    } else {
      document.documentElement.removeAttribute('data-a11y-large-print');
    }
    if (a11y?.reducedMotion) {
      document.documentElement.setAttribute('data-a11y-reduced-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-a11y-reduced-motion');
    }
    if (a11y?.colorBlindSafe) {
      document.documentElement.setAttribute('data-a11y-color-blind', 'true');
    } else {
      document.documentElement.removeAttribute('data-a11y-color-blind');
    }
  }, [store.settings.theme, store.settings.a11yConfig]);

  const handleToggleTheme = () => {
    const themes: AppTheme[] = [
      'dark',
      'light',
      'tokyo-night',
      'catppuccin',
      'dracula',
      'sepia',
      'cyber',
      'high-contrast',
    ];
    const curIdx = themes.indexOf(store.settings.theme as AppTheme);
    const nextTheme = themes[(curIdx + 1) % themes.length];
    window.electronAPI.saveSettings({ theme: nextTheme });
  };

  const handleIncreaseFont = () => {
    const cur = store.settings.fontSize || 15;
    if (cur < 32) {
      window.electronAPI.saveSettings({ fontSize: cur + 1 });
    }
  };

  const handleDecreaseFont = () => {
    const cur = store.settings.fontSize || 15;
    if (cur > 11) {
      window.electronAPI.saveSettings({ fontSize: cur - 1 });
    }
  };

  const handleResetFont = () => {
    window.electronAPI.saveSettings({ fontSize: 15 });
  };

  const handleChangeWidthMode = (mode: PreviewWidthMode) => {
    window.electronAPI.saveSettings({ previewWidthMode: mode });
  };

  const handleUpdateA11yConfig = (patch: Partial<AccessibilityConfig>) => {
    window.electronAPI.saveSettings({
      a11yConfig: {
        ...(store.settings.a11yConfig || {
          highContrast: false,
          dyslexicFont: false,
          largePrint: false,
          reducedMotion: false,
          colorBlindSafe: false,
        }),
        ...patch,
      },
    });
  };

  const handleConfirmSupervision = async (config: FolderSupervisionConfig) => {
    store.setSupervisionConfig(config);
    await window.electronAPI.setSupervision(config);
    if (config.path) {
      const files = await window.electronAPI.scanFolder(config.path, config.scanMode || 'full-tree');
      store.setFolderFiles(files);
    }
  };

  const handleChangeScanMode = async (mode: ScanDepthMode) => {
    if (!store.folderPath) return;
    const updatedConfig: FolderSupervisionConfig = {
      ...(store.supervisionConfig || {
        path: store.folderPath,
        name: store.folderName,
        enabled: true,
        autoOpenNew: false,
      }),
      scanMode: mode,
    };
    store.setSupervisionConfig(updatedConfig);
    await window.electronAPI.setSupervision(updatedConfig);
    const files = await window.electronAPI.scanFolder(store.folderPath, mode);
    store.setFolderFiles(files);
  };

  const handleRefreshFolder = async () => {
    if (store.folderPath) {
      const files = await window.electronAPI.scanFolder(store.folderPath, store.scanMode);
      store.setFolderFiles(files);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  useHotkeys({
    onSave: handleSave,
    onSaveAs: handleOpenSaveAsDialog,
    onOpenFile: handleOpen,
    onOpenFolder: handleOpenFolder,
    onNewTab: () => store.addTab(),
    onCloseTab: () => {
      if (store.activeTabId) {
        store.closeTab(store.activeTabId);
      }
    },
    onToggleSidebar: () => store.toggleSidebar(),
    onTranslate: () => store.setShowOllamaModal(true),
    onToggleDirection: () => store.toggleActiveDirection(),
  });

  const words = activeTab?.content ? activeTab.content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  const themeClass = THEME_CLASSES[store.settings.theme] || THEME_CLASSES.dark;

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`h-screen w-screen flex flex-col select-none overflow-hidden ${themeClass}`}
    >
      <TitleBar
        fileName={activeTab ? activeTab.fileName : 'FlyMD'}
        filePath={activeTab ? activeTab.filePath : ''}
        isDirty={activeTab ? activeTab.isDirty : false}
        isPinned={store.isPinned}
        onTogglePin={handleTogglePin}
        onMinimize={() => window.electronAPI.minimizeWindow()}
        onMaximize={() => window.electronAPI.maximizeWindow()}
        onClose={() => window.electronAPI.closeWindow()}
      />

      <TabBar
        tabs={store.tabs}
        activeTabId={store.activeTabId}
        onSelectTab={store.setActiveTabId}
        onCloseTab={(id) => store.closeTab(id)}
        onCloseOthers={(id) => store.closeOtherTabs(id)}
        onCloseAll={() => store.closeAllTabs()}
        onCloseTabsToRight={(id) => store.closeTabsToRight(id)}
        onNewTab={() => store.addTab()}
        onAssignTabToAgent={(tab) => {
          store.openDispatchModal({
            targetAgentId: 'claude-code',
            sourceFilePath: tab.filePath,
            sourceFileName: tab.fileName,
            markdownContent: tab.content,
          });
        }}
        colorBlindSafe={store.settings.a11yConfig?.colorBlindSafe}
        isAgentsMode={store.viewMode === 'agents'}
        onToggleAgentsStudio={() =>
          store.setViewMode(store.viewMode === 'agents' ? 'wysiwyg' : 'agents')
        }
      />

      <Toolbar
        viewMode={store.viewMode}
        onChangeViewMode={store.setViewMode}
        onNew={() => store.addTab()}
        onOpen={handleOpen}
        onOpenFolder={handleOpenFolder}
        onToggleSidebar={store.toggleSidebar}
        isSidebarOpen={!store.sidebarCollapsed}
        onSave={handleSave}
        onSaveAs={handleOpenSaveAsDialog}
        onExport={handleDirectExport}
        onOpenExportDialog={handleOpenExportDialog}
        onQuickCopy={handleQuickCopy}
        onFormat={handleFormat}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenTranslate={() => store.setShowOllamaModal(true)}
        onOpenSettings={() => store.setShowSettings(true)}
        onOpenAccessibility={() => setIsA11yModalOpen(true)}
        currentTheme={store.settings.theme}
        onToggleTheme={handleToggleTheme}
        wordCount={words}
        readingTimeMin={readingTimeMin}
        ollamaModel={store.settings.ollamaModel}
        direction={activeTab?.direction}
        content={activeTab?.content}
        onToggleDirection={store.toggleActiveDirection}
        isOutlineOpen={store.outlineOpen}
        onToggleOutline={store.toggleOutlineOpen}
      />

      <WorkspaceLayout
        viewMode={store.viewMode}
        activeTab={activeTab}
        onContentChange={store.updateActiveContent}
        settings={store.settings}
        editorRef={editorRef}
        previewContainerRef={previewContainerRef}
        isSidebarOpen={!store.sidebarCollapsed}
        folderPath={store.folderPath}
        folderName={store.folderName}
        folderFiles={store.folderFiles}
        supervisionConfig={store.supervisionConfig}
        explorerMode={store.sidebarExplorerMode}
        onChangeExplorerMode={store.setSidebarExplorerMode}
        onSelectFile={async (fPath) => {
          const existingTab = store.tabs.find(
            (t) => t.filePath && t.filePath.toLowerCase() === fPath.toLowerCase()
          );
          const isFileNew = store.folderFiles.some(
            (f) => f.path.toLowerCase() === fPath.toLowerCase() && f.isNew
          );
          const isTabNew = existingTab?.isNew;

          const res = await window.electronAPI.readFile(fPath);
          if (res) {
            store.openFileInTab(
              { ...res, isNew: isFileNew || isTabNew },
              { activate: true }
            );
          }

          if (isFileNew || isTabNew) {
            const targetTabId = existingTab?.id;
            if (targetTabId) {
              scheduleBadgeClear(`tab_${targetTabId}`, () => {
                store.clearTabNewBadge(targetTabId);
                store.clearFileNewBadge(fPath);
              });
            }
            scheduleBadgeClear(`file_${fPath.toLowerCase()}`, () => {
              store.clearFileNewBadge(fPath);
              store.clearTabNewBadgeByPath(fPath);
            });
          }
        }}
        onRefreshFolder={handleRefreshFolder}
        onOpenSupervisionSettings={() => setIsSupervisionModalOpen(true)}
        onCloseSidebar={() => store.setSidebarCollapsed(true)}
        onChangeScanMode={handleChangeScanMode}
        onOpenFolder={handleOpenFolder}
        onOpenFile={handleOpen}
        onNewFile={() => store.addTab()}
        isOutlineOpen={store.outlineOpen}
        isOutlinePinned={store.outlinePinned}
        onToggleOutlinePin={store.toggleOutlinePinned}
        onCloseOutline={() => store.setOutlineOpen(false)}
        onIncreaseFont={handleIncreaseFont}
        onDecreaseFont={handleDecreaseFont}
        onResetFont={handleResetFont}
        onChangeWidthMode={handleChangeWidthMode}
        onUpdateA11yConfig={handleUpdateA11yConfig}
      />

      <AgentDock />

      <AgentAccountsModal
        isOpen={store.showAgentAccountsModal}
        onClose={() => store.setShowAgentAccountsModal(false)}
        profiles={store.agentProfiles}
        onProfilesUpdated={store.setAgentProfiles}
      />
      <AgentDispatchModal />
      <CouncilModal />

      <SaveExportModal
        isOpen={saveExportModal.isOpen}
        mode={saveExportModal.mode}
        initialFileName={activeTab?.fileName || 'Document.md'}
        initialExportFormat={saveExportModal.initialFormat}
        onClose={() => setSaveExportModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirmSaveAs={handleConfirmSaveAs}
        onConfirmExport={handleConfirmExport}
      />

      <AppContextMenu
        isOpen={contextMenu.isOpen}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCut={() => document.execCommand('cut')}
        onCopy={() => {
          const sel = window.getSelection()?.toString();
          if (sel) {
            navigator.clipboard.writeText(sel);
          } else {
            handleQuickCopy();
          }
        }}
        onPaste={async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (text) handleFormat('', '', text);
          } catch {
            document.execCommand('paste');
          }
        }}
        onSelectAll={() => document.execCommand('selectAll')}
        onSave={handleSave}
        onSaveAs={handleOpenSaveAsDialog}
        onExport={() => handleOpenExportDialog('html')}
        onTranslate={() => store.setShowOllamaModal(true)}
        onToggleOutline={store.toggleOutlineOpen}
      />

      <SupervisionModal
        isOpen={isSupervisionModalOpen}
        onClose={() => setIsSupervisionModalOpen(false)}
        folderPath={store.folderPath}
        folderName={store.folderName}
        initialConfig={store.supervisionConfig}
        onConfirm={handleConfirmSupervision}
      />

      <OllamaModal
        isOpen={store.showOllamaModal}
        onClose={() => store.setShowOllamaModal(false)}
        fullContent={activeTab?.content || ''}
        fileName={activeTab?.fileName || 'Document.md'}
        defaultModel={store.settings.llmConfig?.model || store.settings.ollamaModel}
        initialLlmConfig={store.settings.llmConfig}
        onSaveSettings={(patch) => window.electronAPI.saveSettings(patch)}
        onOpenAsNewTab={store.openTranslationAsNewTab}
        onReplaceContent={store.updateActiveContent}
        onInsertBelow={(newText) => {
          store.updateActiveContent(`${activeTab?.content || ''}\n\n---\n\n${newText}`);
        }}
        onSaveAsNewFile={(suggestedName, newText) => {
          window.electronAPI.saveFileDialog(suggestedName, newText);
        }}
      />

      <SettingsModal
        isOpen={store.showSettings}
        onClose={() => store.setShowSettings(false)}
        settings={store.settings}
        onSave={(patch) => window.electronAPI.saveSettings(patch)}
      />

      <AccessibilityModal
        isOpen={isA11yModalOpen}
        onClose={() => setIsA11yModalOpen(false)}
        config={store.settings.a11yConfig || {
          highContrast: false,
          dyslexicFont: false,
          largePrint: false,
          reducedMotion: false,
          colorBlindSafe: false,
        }}
        onUpdateConfig={handleUpdateA11yConfig}
      />
    </div>
  );
};
