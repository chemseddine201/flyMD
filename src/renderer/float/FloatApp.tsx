import React, { useEffect, useState } from 'react';
import { HistoryItem, ScannedMdFile, AgentTaskRecord } from '../../shared/types';
import { CircleHub } from './components/CircleHub';
import { useIpcEvent } from '../shared/hooks/useIpcEvent';

export const FloatApp: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isPinned, setIsPinned] = useState(true);
  const [hasNewFilesDot, setHasNewFilesDot] = useState(false);
  const [runningAgentsCount, setRunningAgentsCount] = useState(0);

  useEffect(() => {
    window.electronAPI.getHistory().then(setHistory);
    window.electronAPI.getFloatAlwaysOnTop().then(setIsPinned);
    window.electronAPI.getAgentTasks?.().then((tasks) => {
      if (Array.isArray(tasks)) {
        setRunningAgentsCount(tasks.filter((t) => t.status === 'running').length);
      }
    }).catch(() => {});
  }, []);

  useIpcEvent<HistoryItem[]>(window.electronAPI.onHistoryUpdated, (items) => {
    setHistory(items);
  });

  useIpcEvent<AgentTaskRecord[]>(window.electronAPI.onAgentTasksUpdated, (tasks) => {
    if (Array.isArray(tasks)) {
      setRunningAgentsCount(tasks.filter((t) => t.status === 'running').length);
    }
  });

  useIpcEvent<{ file: ScannedMdFile; isNew: boolean }>(window.electronAPI.onSupervisedFileEvent, (data) => {
    if (data.isNew) {
      setHasNewFilesDot(true);
    }
  });

  const handleTogglePin = async () => {
    const next = await window.electronAPI.toggleFloatAlwaysOnTop();
    setIsPinned(next);
  };

  const handleOpenFile = async () => {
    await window.electronAPI.openFileDialog();
  };

  const handleOpenFolder = async () => {
    const folderPath = await window.electronAPI.openFolderDialog();
    if (folderPath) {
      await window.electronAPI.openInPreview(folderPath);
    }
  };

  const handleSelectHistoryFile = async (path: string) => {
    setHasNewFilesDot(false);
    await window.electronAPI.openInPreview(path);
  };

  const handleRemoveHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await window.electronAPI.removeHistory(id);
    setHistory(updated);
  };

  const handleClearHistory = async () => {
    await window.electronAPI.clearHistory();
    setHistory([]);
  };

  const handleFileDrop = async (filePath: string) => {
    setHasNewFilesDot(false);
    await window.electronAPI.openInPreview(filePath);
  };

  const handleHideToTray = async () => {
    if ((window.electronAPI as any)?.hideFloatWindow) {
      await (window.electronAPI as any).hideFloatWindow();
    }
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="w-full h-full flex flex-col items-center justify-end pb-5 bg-transparent select-none overflow-hidden"
    >
      <CircleHub
        history={history}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onSelectHistoryFile={handleSelectHistoryFile}
        onRemoveHistoryItem={handleRemoveHistoryItem}
        onClearHistory={handleClearHistory}
        onFileDrop={handleFileDrop}
        onHideToTray={handleHideToTray}
        hasNewFilesDot={hasNewFilesDot}
        runningAgentsCount={runningAgentsCount}
      />
    </div>
  );
};
