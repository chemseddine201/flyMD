import {
  AppSettings,
  FileOpenResult,
  FolderSupervisionConfig,
  HistoryItem,
  ScannedMdFile,
  TranslationRequest,
} from '../../../shared/types';
import {
  FileFilter,
  FileSaveResponse,
  FolderLoadedEvent,
  LlmGetModelsResult,
  LlmTestConnectionResult,
  SupervisedFileEvent,
  TranslationDoneEvent,
} from '../../../shared/ipc';
import { DEFAULT_SETTINGS } from '../../../shared/constants';

type Listener<T> = (data: T) => void;

class EventEmitter<T> {
  private listeners = new Set<Listener<T>>();

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(data: T): void {
    this.listeners.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('Bridge event error:', err);
      }
    });
  }
}

/**
 * Initializes a resilient runtime bridge if window.electronAPI is undefined.
 * This ensures FlyMD runs flawlessly in Pake, Tauri, or standalone WebView2 environments.
 */
export function ensureRuntimeBridge(): void {
  if (typeof window === 'undefined') return;

  if ((window as any).electronAPI) {
    // Already defined by Electron preload
    return;
  }

  console.log('[FlyMD] Initializing Pake/Web standalone runtime bridge...');

  const settingsEmitter = new EventEmitter<AppSettings>();
  const historyEmitter = new EventEmitter<HistoryItem[]>();
  const fileLoadedEmitter = new EventEmitter<FileOpenResult>();
  const folderLoadedEmitter = new EventEmitter<FolderLoadedEvent>();
  const supervisedFileEmitter = new EventEmitter<SupervisedFileEvent>();
  const supervisedTreeEmitter = new EventEmitter<ScannedMdFile[]>();
  const translationChunkEmitter = new EventEmitter<string>();
  const translationDoneEmitter = new EventEmitter<TranslationDoneEvent>();

  // Helper for localStorage
  const storage = {
    getSettings(): AppSettings {
      try {
        const raw = localStorage.getItem('flymd_settings');
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } catch (e) {
        console.warn('Failed to parse settings from localStorage', e);
      }
      return { ...DEFAULT_SETTINGS };
    },
    saveSettings(partial: Partial<AppSettings>): AppSettings {
      const current = storage.getSettings();
      const updated = { ...current, ...partial };
      localStorage.setItem('flymd_settings', JSON.stringify(updated));
      settingsEmitter.emit(updated);
      return updated;
    },
    getHistory(): HistoryItem[] {
      try {
        const raw = localStorage.getItem('flymd_history');
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to parse history from localStorage', e);
      }
      return [];
    },
    saveHistory(items: HistoryItem[]): void {
      localStorage.setItem('flymd_history', JSON.stringify(items));
      historyEmitter.emit(items);
    },
  };

  // Virtual in-memory filesystem for Pake / Web folder supervision and tree browsing
  const virtualFileStore = new Map<string, FileOpenResult>();
  let activeVirtualFolder: {
    path: string;
    name: string;
    files: ScannedMdFile[];
    config?: FolderSupervisionConfig;
  } = {
    path: '',
    name: '',
    files: [],
  };

  const bridge = {
    // File operations
    openFileDialog: async (): Promise<FileOpenResult | null> => {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.markdown,.mdown,.mkd,.txt';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          const text = await file.text();
          const result: FileOpenResult = {
            path: file.name,
            name: file.name,
            content: text,
            lastModified: file.lastModified,
          };
          virtualFileStore.set(file.name, result);
          resolve(result);
        };
        input.click();
      });
    },

    readFile: async (filePath: string): Promise<FileOpenResult> => {
      const cached = virtualFileStore.get(filePath);
      if (cached) {
        return cached;
      }
      return {
        path: filePath,
        name: filePath.split(/[/\\]/).pop() || filePath,
        content: '',
        lastModified: Date.now(),
      };
    },

    saveFile: async (filePath: string, content: string): Promise<FileSaveResponse> => {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split(/[/\\]/).pop() || 'document.md';
      a.click();
      URL.revokeObjectURL(url);
      return { success: true, path: filePath };
    },

    saveFileDialog: async (
      defaultName: string,
      content: string,
      _filters?: FileFilter[]
    ): Promise<FileSaveResponse> => {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true, path: defaultName };
    },

    exportPdf: async (defaultName: string, htmlContent: string): Promise<FileSaveResponse> => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
        };
        return { success: true, path: defaultName };
      }
      return { success: false, error: 'Could not open print window' };
    },

    getPathForFile: (file: File): string => {
      return (file as any).path || file.name || '';
    },

    // History
    getHistory: async (): Promise<HistoryItem[]> => {
      return storage.getHistory();
    },

    addHistory: async (item: {
      path: string;
      name: string;
      preview?: string;
      size?: number;
    }): Promise<HistoryItem[]> => {
      const history = storage.getHistory().filter((h) => h.path !== item.path);
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        path: item.path,
        name: item.name,
        lastOpened: Date.now(),
        preview: item.preview,
        size: item.size,
      };
      history.unshift(newItem);
      const trimmed = history.slice(0, 30);
      storage.saveHistory(trimmed);
      return trimmed;
    },

    removeHistory: async (id: string): Promise<HistoryItem[]> => {
      const history = storage.getHistory().filter((h) => h.id !== id);
      storage.saveHistory(history);
      return history;
    },

    clearHistory: async (): Promise<void> => {
      storage.saveHistory([]);
    },

    onHistoryUpdated: (callback: (history: HistoryItem[]) => void) => {
      return historyEmitter.subscribe(callback);
    },

    // Window Management
    toggleFloatAlwaysOnTop: async (): Promise<boolean> => true,
    getFloatAlwaysOnTop: async (): Promise<boolean> => true,
    togglePreviewAlwaysOnTop: async (): Promise<boolean> => false,
    getPreviewAlwaysOnTop: async (): Promise<boolean> => false,
    minimizeWindow: () => {},
    maximizeWindow: () => {},
    closeWindow: () => {
      if (typeof window !== 'undefined' && window.close) {
        window.close();
      }
    },
    moveFloatWindow: () => {},
    getFloatPosition: async () => ({ x: 100, y: 100 }),
    setFloatPosition: () => {},
    setFloatExpanded: () => {},

    // Preview
    openInPreview: async (filePath: string) => {
      if (activeVirtualFolder.path && filePath === activeVirtualFolder.path) {
        folderLoadedEmitter.emit({
          folderPath: activeVirtualFolder.path,
          folderName: activeVirtualFolder.name,
          files: activeVirtualFolder.files,
        });
        return;
      }
      const cached = virtualFileStore.get(filePath);
      if (cached) {
        fileLoadedEmitter.emit(cached);
        return;
      }
      fileLoadedEmitter.emit({
        path: filePath,
        name: filePath.split(/[/\\]/).pop() || filePath,
        content: '',
      });
    },

    onFileLoaded: (callback: (file: FileOpenResult) => void) => {
      return fileLoadedEmitter.subscribe(callback);
    },

    onFolderLoaded: (callback: (data: FolderLoadedEvent) => void) => {
      return folderLoadedEmitter.subscribe(callback);
    },

    // LLM & AI
    getOllamaModels: async (): Promise<LlmGetModelsResult> => {
      return { success: true, models: [] };
    },

    testLlmConnection: async (): Promise<LlmTestConnectionResult> => {
      return { success: false, message: 'Standalone webview mode - connect via API' };
    },

    startTranslation: (_req: TranslationRequest) => {},
    abortTranslation: () => {},

    onTranslationChunk: (callback: (chunk: string) => void) => {
      return translationChunkEmitter.subscribe(callback);
    },

    onTranslationComplete: (callback: (result: TranslationDoneEvent) => void) => {
      return translationDoneEmitter.subscribe(callback);
    },

    // Settings
    getSettings: async (): Promise<AppSettings> => {
      return storage.getSettings();
    },

    saveSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
      return storage.saveSettings(settings);
    },

    onSettingsChanged: (callback: (settings: AppSettings) => void) => {
      return settingsEmitter.subscribe(callback);
    },

    // Supervision & Folder Tree Scanning for Pake / WebView2
    openFolderDialog: async (): Promise<string | null> => {
      // 1. Prefer modern File System Access API (showDirectoryPicker)
      // This avoids the browser "Upload files to this site?" security warning and lets us
      // cleanly skip node_modules and non-markdown directories during traversal.
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
          if (!dirHandle) return null;

          const rootFolder = dirHandle.name || 'Selected Folder';
          const scannedFiles: ScannedMdFile[] = [];

          async function scanHandle(handle: any, currentRelPath: string) {
            for await (const [name, entry] of handle.entries()) {
              if (
                name.startsWith('.') ||
                name === 'node_modules' ||
                name === 'target' ||
                name === 'dist' ||
                name === 'dist-electron' ||
                name === 'vendor' ||
                name === 'build'
              ) {
                continue;
              }

              const rel = currentRelPath ? `${currentRelPath}/${name}` : name;
              if (entry.kind === 'directory') {
                await scanHandle(entry, rel);
              } else if (entry.kind === 'file') {
                if (/\.(md|markdown|mdown|mkd|txt)$/i.test(name)) {
                  try {
                    const file = await entry.getFile();
                    const text = await file.text();
                    const fileResult: FileOpenResult = {
                      path: rel,
                      name,
                      content: text,
                      lastModified: file.lastModified,
                    };
                    virtualFileStore.set(rel, fileResult);

                    scannedFiles.push({
                      path: rel,
                      name,
                      relativePath: rel,
                      modifiedAt: file.lastModified,
                      createdAt: file.lastModified,
                      size: file.size,
                    });
                  } catch (err) {
                    console.warn('Could not read file from handle:', name, err);
                  }
                }
              }
            }
          }

          await scanHandle(dirHandle, '');
          scannedFiles.sort((a, b) => b.modifiedAt - a.modifiedAt);

          activeVirtualFolder = {
            path: rootFolder,
            name: rootFolder,
            files: scannedFiles,
          };

          folderLoadedEmitter.emit({
            folderPath: rootFolder,
            folderName: rootFolder,
            files: scannedFiles,
          });

          return rootFolder;
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            return null;
          }
          console.warn('showDirectoryPicker encountered an error, falling back:', err);
        }
      }

      // 2. Fallback to webkitdirectory input only if showDirectoryPicker is unavailable
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        (input as any).webkitdirectory = true;
        (input as any).directory = true;
        input.multiple = true;

        input.onchange = async () => {
          const fileList = input.files;
          if (!fileList || fileList.length === 0) {
            resolve(null);
            return;
          }

          // Extract folder name from the first relative path segment
          const firstPath = fileList[0].webkitRelativePath || fileList[0].name;
          const rootFolder = firstPath.split('/')[0] || 'Selected Folder';

          const mdRegex = /\.(md|markdown|mdown|mkd|txt)$/i;
          const scannedFiles: ScannedMdFile[] = [];

          for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const relPath = file.webkitRelativePath || file.name;
            if (mdRegex.test(file.name)) {
              try {
                const text = await file.text();
                const fileResult: FileOpenResult = {
                  path: relPath,
                  name: file.name,
                  content: text,
                  lastModified: file.lastModified,
                };
                virtualFileStore.set(relPath, fileResult);

                scannedFiles.push({
                  path: relPath,
                  name: file.name,
                  relativePath: relPath,
                  modifiedAt: file.lastModified,
                  createdAt: file.lastModified,
                  size: file.size,
                });
              } catch (err) {
                console.warn('Failed reading virtual file:', relPath, err);
              }
            }
          }

          // Sort by last modified date descending
          scannedFiles.sort((a, b) => b.modifiedAt - a.modifiedAt);

          activeVirtualFolder = {
            path: rootFolder,
            name: rootFolder,
            files: scannedFiles,
          };

          // Emit folder loaded event to open sidebar and prompt supervision
          folderLoadedEmitter.emit({
            folderPath: rootFolder,
            folderName: rootFolder,
            files: scannedFiles,
          });

          resolve(rootFolder);
        };

        input.click();
      });
    },

    scanFolder: async (dirPath: string, scanMode?: any): Promise<ScannedMdFile[]> => {
      if (!activeVirtualFolder.files || activeVirtualFolder.files.length === 0) {
        return [];
      }

      const mode = scanMode || 'full-tree';
      if (mode === 'root-only') {
        // Files that reside directly in the root directory (only 1 or 2 path segments)
        return activeVirtualFolder.files.filter((f) => {
          const parts = f.relativePath.split('/');
          return parts.length <= 2;
        });
      }

      return [...activeVirtualFolder.files];
    },

    setSupervision: async (config: FolderSupervisionConfig): Promise<boolean> => {
      activeVirtualFolder.config = config;
      try {
        localStorage.setItem('flymd_supervision', JSON.stringify(config));
      } catch (e) {
        console.warn('Failed saving supervision config:', e);
      }
      return true;
    },

    getSupervision: async (): Promise<FolderSupervisionConfig | null> => {
      if (activeVirtualFolder.config) {
        return activeVirtualFolder.config;
      }
      try {
        const raw = localStorage.getItem('flymd_supervision');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return null;
    },
    onSupervisedFileEvent: (callback: (data: SupervisedFileEvent) => void) => {
      return supervisedFileEmitter.subscribe(callback);
    },
    onSupervisedTreeUpdated: (callback: (files: ScannedMdFile[]) => void) => {
      return supervisedTreeEmitter.subscribe(callback);
    },
  };

  (window as any).electronAPI = bridge;
}
