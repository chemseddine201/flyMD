import React, { useState, useRef } from 'react';
import { ViewMode } from '../../../shared/constants';
import {
  AppSettings,
  TabItem,
  ScannedMdFile,
  FolderSupervisionConfig,
  ScanDepthMode,
  PreviewWidthMode,
  AccessibilityConfig,
} from '../../../shared/types';
import { SidebarExplorerMode } from '../store/slices/workspaceSlice';
import { ProjectSidebar } from './ProjectSidebar';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownViewer } from './MarkdownViewer';
import { WysiwygEditor } from './WysiwygEditor';
import { EmptyWorkspaceView } from './EmptyWorkspaceView';
import { DocumentOutlinePanel } from './outline/DocumentOutlinePanel';
import { AgentsControlCenter } from './agents';

interface WorkspaceLayoutProps {
  viewMode: ViewMode;
  activeTab?: TabItem | null;
  onContentChange: (newContent: string) => void;
  settings: AppSettings;
  editorRef: React.MutableRefObject<any>;
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  isSidebarOpen: boolean;
  folderPath: string;
  folderName: string;
  folderFiles: ScannedMdFile[];
  supervisionConfig: FolderSupervisionConfig | null;
  explorerMode: SidebarExplorerMode;
  onChangeExplorerMode: (mode: SidebarExplorerMode) => void;
  onSelectFile: (filePath: string) => void;
  onRefreshFolder: () => void;
  onOpenSupervisionSettings: () => void;
  onCloseSidebar: () => void;
  onChangeScanMode: (mode: ScanDepthMode) => void;
  onOpenFolder?: () => void;
  onOpenFile?: () => void;
  onNewFile?: () => void;
  isOutlineOpen: boolean;
  isOutlinePinned: boolean;
  onToggleOutlinePin: () => void;
  onCloseOutline: () => void;
  onIncreaseFont?: () => void;
  onDecreaseFont?: () => void;
  onResetFont?: () => void;
  onChangeWidthMode?: (mode: PreviewWidthMode) => void;
  onUpdateA11yConfig?: (patch: Partial<AccessibilityConfig>) => void;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  viewMode,
  activeTab,
  onContentChange,
  settings,
  editorRef,
  previewContainerRef,
  isSidebarOpen,
  folderPath,
  folderName,
  folderFiles,
  supervisionConfig,
  explorerMode,
  onChangeExplorerMode,
  onSelectFile,
  onRefreshFolder,
  onOpenSupervisionSettings,
  onCloseSidebar,
  onChangeScanMode,
  onOpenFolder,
  onOpenFile,
  onNewFile,
  isOutlineOpen,
  isOutlinePinned,
  onToggleOutlinePin,
  onCloseOutline,
  onIncreaseFont,
  onDecreaseFont,
  onResetFont,
  onChangeWidthMode,
  onUpdateA11yConfig,
}) => {
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const isDraggingSplitter = useRef<boolean>(false);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplitter.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSplitter.current) return;
      const windowWidth = window.innerWidth;
      const newRatio = (moveEvent.clientX / windowWidth) * 100;
      if (newRatio >= 20 && newRatio <= 80) {
        setSplitRatio(newRatio);
      }
    };

    const handleMouseUp = () => {
      isDraggingSplitter.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex-1 w-full flex overflow-hidden relative">
      {isSidebarOpen && (
        <ProjectSidebar
          folderName={folderName || 'Project Explorer'}
          folderPath={folderPath}
          files={folderFiles}
          supervisionConfig={supervisionConfig}
          explorerMode={explorerMode}
          onChangeExplorerMode={onChangeExplorerMode}
          onSelectFile={onSelectFile}
          onRefreshFolder={onRefreshFolder}
          onOpenSupervisionSettings={onOpenSupervisionSettings}
          onCloseSidebar={onCloseSidebar}
          currentActiveFilePath={activeTab?.filePath}
          onChangeScanMode={onChangeScanMode}
          onOpenFolder={onOpenFolder}
          colorBlindSafe={settings.a11yConfig?.colorBlindSafe}
        />
      )}

      <div className="flex-1 h-full flex overflow-hidden relative min-w-0">
        {viewMode === 'agents' ? (
          <AgentsControlCenter
            folderPath={folderPath}
            activeTab={activeTab ? { id: activeTab.id, filePath: activeTab.filePath, title: activeTab.fileName } : undefined}
            supervisionConfig={supervisionConfig || undefined}
          />
        ) : !activeTab ? (
          <EmptyWorkspaceView
            onOpenFile={onOpenFile}
            onOpenFolder={onOpenFolder}
            onNewFile={onNewFile}
          />
        ) : (
          <>
            {viewMode === 'wysiwyg' && (
              <div className="h-full w-full flex flex-col overflow-hidden">
                <WysiwygEditor
                  key={activeTab.id}
                  value={activeTab.content}
                  onChange={onContentChange}
                  fontSize={settings.fontSize}
                  theme={settings.theme}
                  direction={activeTab.direction}
                  editorRef={editorRef}
                />
              </div>
            )}

            {(viewMode === 'split' || viewMode === 'editor') && (
              <div
                style={{ width: viewMode === 'split' ? `${splitRatio}%` : '100%' }}
                className="h-full flex flex-col overflow-hidden"
              >
                <MarkdownEditor
                  key={activeTab.id}
                  value={activeTab.content}
                  onChange={onContentChange}
                  fontSize={settings.fontSize}
                  theme={settings.theme}
                  direction={activeTab.direction}
                  editorRef={editorRef}
                />
              </div>
            )}

            {viewMode === 'split' && (
              <div
                onMouseDown={handleSplitterMouseDown}
                title="Drag to resize panels"
                className="w-1.5 h-full bg-slate-800 hover:bg-sky-500 cursor-col-resize z-20 transition-colors shrink-0"
              />
            )}

            {(viewMode === 'split' || viewMode === 'preview') && (
              <div
                style={{ width: viewMode === 'split' ? `${100 - splitRatio}%` : '100%' }}
                className="h-full flex flex-col overflow-hidden"
              >
                <MarkdownViewer
                  key={activeTab.id}
                  content={activeTab.content}
                  theme={settings.theme}
                  direction={activeTab.direction}
                  containerRef={previewContainerRef}
                  fontSize={settings.fontSize}
                  widthMode={settings.previewWidthMode || 'wide'}
                  onIncreaseFont={onIncreaseFont}
                  onDecreaseFont={onDecreaseFont}
                  onResetFont={onResetFont}
                  onChangeWidthMode={onChangeWidthMode}
                  a11yConfig={settings.a11yConfig}
                  onUpdateA11yConfig={onUpdateA11yConfig}
                />
              </div>
            )}
          </>
        )}
      </div>

      {isOutlineOpen && activeTab && (
        <DocumentOutlinePanel
          content={activeTab.content}
          viewMode={viewMode}
          isLeftSidebarOpen={Boolean(isSidebarOpen && folderPath)}
          isPinned={isOutlinePinned}
          onTogglePin={onToggleOutlinePin}
          onClose={onCloseOutline}
          previewContainerRef={previewContainerRef}
          editorRef={editorRef}
        />
      )}
    </div>
  );
};
