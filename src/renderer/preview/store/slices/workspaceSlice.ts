import { StateCreator } from 'zustand';
import { ScannedMdFile, ScanDepthMode, FolderSupervisionConfig } from '../../../../shared/types';
import { PreviewStoreState } from '../usePreviewStore';

export type SidebarExplorerMode = 'tree' | 'list';

export interface WorkspaceSlice {
  folderPath: string;
  folderName: string;
  folderFiles: ScannedMdFile[];
  scanMode: ScanDepthMode;
  sidebarExplorerMode: SidebarExplorerMode;
  supervisionConfig: FolderSupervisionConfig | null;
  showFolderPrompt: boolean;
  pendingFolderPath: string;

  setFolder: (folderPath: string, folderName: string, files: ScannedMdFile[]) => void;
  setFolderFiles: (files: ScannedMdFile[]) => void;
  setScanMode: (mode: ScanDepthMode) => void;
  setSidebarExplorerMode: (mode: SidebarExplorerMode) => void;
  setSupervisionConfig: (cfg: FolderSupervisionConfig | null) => void;
  setPendingFolder: (path: string, showPrompt: boolean) => void;
  markFileAsNew: (file: ScannedMdFile | string) => void;
  clearFileNewBadge: (filePath: string) => void;
}

export const createWorkspaceSlice: StateCreator<PreviewStoreState, [], [], WorkspaceSlice> = (set) => ({
  folderPath: '',
  folderName: '',
  folderFiles: [],
  scanMode: 'full-tree',
  sidebarExplorerMode: 'tree',
  supervisionConfig: null,
  showFolderPrompt: false,
  pendingFolderPath: '',

  setFolder: (folderPath, folderName, files) => {
    set({ folderPath, folderName, folderFiles: files });
  },

  setFolderFiles: (files) => {
    set({ folderFiles: files });
  },

  setScanMode: (scanMode) => {
    set({ scanMode });
  },

  setSidebarExplorerMode: (sidebarExplorerMode) => {
    set({ sidebarExplorerMode });
  },

  setSupervisionConfig: (supervisionConfig) => {
    set({
      supervisionConfig,
      scanMode: supervisionConfig?.scanMode || 'full-tree',
    });
  },

  setPendingFolder: (pendingFolderPath, showFolderPrompt) => {
    set({ pendingFolderPath, showFolderPrompt });
  },

  markFileAsNew: (fileOrPath) => {
    set((state) => {
      const targetPath = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath.path;
      const exists = state.folderFiles.some(
        (f) => f.path.toLowerCase() === targetPath.toLowerCase()
      );
      if (!exists && typeof fileOrPath !== 'string') {
        return {
          folderFiles: [{ ...fileOrPath, isNew: true }, ...state.folderFiles],
        };
      }
      return {
        folderFiles: state.folderFiles.map((f) =>
          f.path.toLowerCase() === targetPath.toLowerCase() ? { ...f, isNew: true } : f
        ),
      };
    });
  },

  clearFileNewBadge: (filePath) => {
    set((state) => ({
      folderFiles: state.folderFiles.map((f) =>
        f.path.toLowerCase() === filePath.toLowerCase() && f.isNew ? { ...f, isNew: false } : f
      ),
    }));
  },
});
