import React, { useState, useEffect, useMemo } from 'react';
import { ScannedMdFile } from '../../../../shared/types';
import { formatRelativeTime } from '../../../../shared/utils';
import { buildFileTree, collectAllFolderIds, FileTreeNode } from '../../utils/fileTree';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Globe,
  Code,
  Braces,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';

interface AppSystemFolderTreeProps {
  files: ScannedMdFile[];
  currentActiveFilePath?: string;
  onSelectFile: (filePath: string) => void;
  onContextMenuFile?: (e: React.MouseEvent, file: ScannedMdFile) => void;
  searchQuery?: string;
  colorBlindSafe?: boolean;
}

const renderFileIcon = (fileName: string, isSelected: boolean) => {
  const lower = fileName.toLowerCase();
  const ext = lower.split('.').pop() || '';

  if (ext === 'html' || ext === 'htm') {
    return <Globe className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-amber-400 group-hover:text-amber-300'}`} />;
  }
  if (ext === 'css' || ext === 'scss' || ext === 'less') {
    return <FileCode className={`w-3.5 h-3.5 ${isSelected ? 'text-pink-300' : 'text-pink-400 group-hover:text-pink-300'}`} />;
  }
  if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') {
    return <Code className={`w-3.5 h-3.5 ${isSelected ? 'text-yellow-300' : 'text-yellow-400 group-hover:text-yellow-300'}`} />;
  }
  if (ext === 'json' || ext === 'yaml' || ext === 'yml' || ext === 'toml' || ext === 'xml') {
    return <Braces className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-300' : 'text-emerald-400 group-hover:text-emerald-300'}`} />;
  }
  if (ext === 'py' || ext === 'rs' || ext === 'go' || ext === 'php' || ext === 'sh') {
    return <FileCode className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-300' : 'text-cyan-400 group-hover:text-cyan-300'}`} />;
  }
  return <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-slate-400 group-hover:text-sky-300'}`} />;
};

export const AppSystemFolderTree: React.FC<AppSystemFolderTreeProps> = ({
  files,
  currentActiveFilePath,
  onSelectFile,
  onContextMenuFile,
  searchQuery = '',
  colorBlindSafe = false,
}) => {
  const treeNodes = useMemo(() => buildFileTree(files), [files]);
  const allFolderIds = useMemo(() => collectAllFolderIds(treeNodes), [treeNodes]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(allFolderIds));

  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedFolders(new Set(allFolderIds));
    } else {
      setExpandedFolders((prev) => {
        if (prev.size === 0 && allFolderIds.length > 0) {
          return new Set(allFolderIds);
        }
        return prev;
      });
    }
  }, [allFolderIds, searchQuery]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedFolders(new Set(allFolderIds));
  const collapseAll = () => setExpandedFolders(new Set());

  const renderNode = (node: FileTreeNode): React.ReactNode => {
    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.id);
      return (
        <div key={node.id} className="select-none">
          <div
            onClick={() => toggleFolder(node.id)}
            style={{ paddingLeft: `${node.depth * 12 + 6}px` }}
            className="group flex items-center gap-1.5 py-1 pr-2 rounded-md cursor-pointer text-slate-300 hover:bg-slate-800/75 hover:text-slate-100 transition"
          >
            <span className="text-slate-500 group-hover:text-slate-300 shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>

            <div className="relative shrink-0">
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-amber-400/85" />
              )}
              {node.hasNewDescendant && !isExpanded && (
                <span
                  title="Contains newly created Markdown file(s)"
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-pulse"
                />
              )}
            </div>

            <span className="truncate flex-1 font-medium text-[11px]">{node.name}</span>

            {node.hasNewDescendant && !isExpanded && colorBlindSafe && (
              <span className="text-[9px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                NEW
              </span>
            )}

            <span className="text-[9px] text-slate-500 font-mono px-1 rounded bg-slate-900/70">
              {node.fileCount}
            </span>
          </div>

          {isExpanded && (
            <div className="relative">
              <div
                style={{ left: `${node.depth * 12 + 13}px` }}
                className="absolute top-0 bottom-0 w-px bg-slate-800/80 pointer-events-none"
              />
              {node.children.map(renderNode)}
            </div>
          )}
        </div>
      );
    }

    const file = node.file!;
    const isSelected = Boolean(
      currentActiveFilePath &&
        file.path.toLowerCase() === currentActiveFilePath.toLowerCase()
    );

    return (
      <div
        key={node.id}
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
        onContextMenu={(e) => {
          if (onContextMenuFile) {
            e.preventDefault();
            e.stopPropagation();
            onContextMenuFile(e, file);
          }
        }}
        style={{ paddingLeft: `${node.depth * 12 + 22}px` }}
        title={`${file.relativePath} • Right-click to Open in Directory or Delete`}
        className={`group flex items-center gap-2 py-1 pr-2 rounded-md cursor-pointer transition ${
          isSelected
            ? 'bg-sky-500/20 text-sky-200 font-semibold border border-sky-500/30'
            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
        }`}
      >
        <div className="relative shrink-0">
          {renderFileIcon(node.name, isSelected)}
          {file.isNew && (
            <span
              title="New / recently created file"
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-slate-900"
            />
          )}
        </div>

        <span className="truncate flex-1 text-[11px]">{node.name}</span>

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
          <span className="text-[9px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
            NEW
          </span>
        )}

        <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 font-mono">
          {formatRelativeTime(Math.max(file.createdAt, file.modifiedAt))}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {allFolderIds.length > 0 && (
        <div className="px-3 py-1 bg-slate-950/30 border-b border-slate-800/50 flex items-center justify-between text-[10px] text-slate-400">
          <span className="uppercase tracking-wider font-semibold text-[9px] text-slate-500">
            Explorer Tree
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAll}
              title="Expand All Folders"
              className="p-0.5 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            >
              <ChevronsUpDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={collapseAll}
              title="Collapse All Folders"
              className="p-0.5 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            >
              <ChevronsDownUp className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {treeNodes.map(renderNode)}
      </div>
    </div>
  );
};

