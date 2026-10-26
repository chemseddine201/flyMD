import React, { useState } from 'react';
import { ScannedMdFile, FolderSupervisionConfig, ScanDepthMode } from '../../../shared/types';
import { formatRelativeTime } from '../../../shared/utils';
import { SidebarExplorerMode } from '../store/slices/workspaceSlice';
import { AppSystemFolderTree } from './sidebar/AppSystemFolderTree';
import {
  FolderTree,
  FileText,
  Search,
  RefreshCw,
  Settings,
  X,
  List,
  Network,
} from 'lucide-react';

interface ProjectSidebarProps {
  folderName: string;
  folderPath: string;
  files: ScannedMdFile[];
  supervisionConfig: FolderSupervisionConfig | null;
  onSelectFile: (filePath: string) => void;
  onRefreshFolder: () => void;
  onOpenSupervisionSettings: () => void;
  onCloseSidebar: () => void;
  currentActiveFilePath?: string;
  onChangeScanMode?: (mode: ScanDepthMode) => void;
  explorerMode?: SidebarExplorerMode;
  onChangeExplorerMode?: (mode: SidebarExplorerMode) => void;
  onOpenFolder?: () => void;
  colorBlindSafe?: boolean;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  folderName,
  folderPath,
  files,
  supervisionConfig,
  onSelectFile,
  onRefreshFolder,
  onOpenSupervisionSettings,
  onCloseSidebar,
  currentActiveFilePath,
  onChangeScanMode,
  explorerMode = 'tree',
  onChangeExplorerMode,
  onOpenFolder,
  colorBlindSafe = false,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [localExplorerMode, setLocalExplorerMode] = useState<SidebarExplorerMode>(explorerMode);

  const activeExplorerMode = onChangeExplorerMode ? explorerMode : localExplorerMode;
  const handleSetExplorerMode = (mode: SidebarExplorerMode) => {
    if (onChangeExplorerMode) {
      onChangeExplorerMode(mode);
    } else {
      setLocalExplorerMode(mode);
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.relativePath.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-72 h-full flex flex-col bg-slate-900/95 border-r border-slate-800 text-xs select-none shrink-0 overflow-hidden">
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderTree className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold text-slate-100 truncate text-[12px]" title={folderPath}>
              {folderName}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onRefreshFolder}
              title="Rescan folder"
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenSupervisionSettings}
              title="Supervision settings"
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onCloseSidebar}
              title="Close sidebar"
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[10px]">
          <button
            type="button"
            onClick={() => handleSetExplorerMode('tree')}
            title="System Folder Tree View"
            className={`flex-1 py-1 px-2 rounded-md transition flex items-center justify-center gap-1.5 font-medium ${
              activeExplorerMode === 'tree'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3 h-3" />
            <span>Tree View</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetExplorerMode('list')}
            title="Flat Chronological Files List"
            className={`flex-1 py-1 px-2 rounded-md transition flex items-center justify-center gap-1.5 font-medium ${
              activeExplorerMode === 'list'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3 h-3" />
            <span>Files List</span>
          </button>
        </div>

        {onChangeScanMode && (
          <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[10px]">
            <button
              type="button"
              onClick={() => onChangeScanMode('full-tree')}
              title="Scan and collect all Markdown files across all subfolders"
              className={`flex-1 py-1 px-2 rounded-md transition flex items-center justify-center gap-1 font-medium ${
                supervisionConfig?.scanMode !== 'shallow'
                  ? 'bg-slate-800 text-sky-300 border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🌳</span>
              <span>Full Tree</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeScanMode('shallow')}
              title="Scan only Markdown files directly in root folder"
              className={`flex-1 py-1 px-2 rounded-md transition flex items-center justify-center gap-1 font-medium ${
                supervisionConfig?.scanMode === 'shallow'
                  ? 'bg-slate-800 text-sky-300 border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📁</span>
              <span>Root Only</span>
            </button>
          </div>
        )}

        <div
          onClick={onOpenSupervisionSettings}
          className="flex items-center justify-between px-2 py-1 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700 transition"
        >
          <div className="flex items-center gap-1.5">
            {supervisionConfig?.enabled ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400">Supervising</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-[10px] text-slate-400">No Watcher</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            {supervisionConfig?.autoOpenNew ? 'Auto-open (bg)' : 'Dot only'}
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filter files & folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-sky-500 placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="px-3 py-1.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <span>{filteredFiles.length} MD files</span>
        <span>{activeExplorerMode === 'tree' ? 'Folder Hierarchy' : 'Sorted by newest'}</span>
      </div>

      {!folderPath ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3 text-amber-400 shadow-inner">
            <FolderTree className="w-6 h-6" />
          </div>
          <p className="font-semibold text-slate-200 text-xs mb-1">No Folder Opened</p>
          <p className="text-[11px] text-slate-500 mb-4 max-w-[200px]">
            Open a folder to browse Markdown files and enable live folder supervision.
          </p>
          {onOpenFolder && (
            <button
              onClick={onOpenFolder}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-xs shadow-md shadow-sky-600/20 transition flex items-center gap-1.5"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Open Folder</span>
            </button>
          )}
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="py-12 px-4 text-center text-slate-500 text-xs">
          {searchQuery ? 'No matching files found' : 'No Markdown files found in this folder'}
        </div>
      ) : activeExplorerMode === 'tree' ? (
        <AppSystemFolderTree
          files={filteredFiles}
          currentActiveFilePath={currentActiveFilePath}
          onSelectFile={onSelectFile}
          searchQuery={searchQuery}
          colorBlindSafe={colorBlindSafe}
        />
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-1">
          {filteredFiles.map((file) => {
            const isSelected = Boolean(
              currentActiveFilePath &&
                file.path.toLowerCase() === currentActiveFilePath.toLowerCase()
            );
            return (
              <div
                key={file.path}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/flymd-file',
                    JSON.stringify({
                      filePath: file.path,
                      fileName: file.name,
                      sourceAgent: file.sourceAgent,
                    })
                  );
                }}
                onClick={() => onSelectFile(file.path)}
                title="Click to open • Drag onto an Agent in the bottom dock to hand off"
                className={`group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition ${
                  isSelected
                    ? 'bg-sky-500/15 border border-sky-500/30 text-sky-200'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="relative mt-0.5 shrink-0">
                  <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                  {file.isNew && (
                    <span
                      title="New / recently created file"
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-slate-900"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`font-medium truncate text-[11px] ${
                        isSelected ? 'text-sky-300 font-semibold' : 'group-hover:text-slate-100'
                      }`}
                    >
                      {file.name}
                    </p>
                    {file.sourceAgent && (
                      <span className="text-[9px] font-semibold px-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                        {file.sourceAgent}
                      </span>
                    )}
                    {typeof file.checklistTotal === 'number' && file.checklistTotal > 0 && (
                      <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/15 text-emerald-300 shrink-0">
                        {file.checklistDone || 0}/{file.checklistTotal}
                      </span>
                    )}
                    {file.isNew && colorBlindSafe && (
                      <span className="text-[9px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 uppercase tracking-wider">
                        NEW
                      </span>
                    )}
                    <span className="text-[9px] text-slate-500 shrink-0 font-mono">
                      {formatRelativeTime(Math.max(file.createdAt, file.modifiedAt))}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate font-mono opacity-80" title={file.relativePath}>
                    {file.relativePath}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
