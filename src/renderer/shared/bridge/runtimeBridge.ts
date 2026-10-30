import {
  AppSettings,
  FileOpenResult,
  FolderSupervisionConfig,
  HistoryItem,
  ScannedMdFile,
  TranslationRequest,
  CreateProjectRequest,
  ProjectNode,
  ProjectTreeNode,
  UpdateProjectRequest,
  ProjectMemoryRecord,
  RecallPack,
  MemoryEntryKind,
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

    scanFolder: async (dirPath: string, scanMode?: any, allowedExtensions?: string[]): Promise<ScannedMdFile[]> => {
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

    // Hierarchical Projects & Dual-Layer Memory
    getCurrentWorkingDirectory: async (): Promise<string> => {
      return activeVirtualFolder?.path || '.';
    },
    listProjects: async (workspacePath: string): Promise<ProjectNode[]> => {
      try {
        const key = `flymd_projects_${workspacePath || '.'}`;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    getProjectHierarchy: async (workspacePath: string): Promise<ProjectTreeNode[]> => {
      try {
        const key = `flymd_projects_${workspacePath || '.'}`;
        const raw = localStorage.getItem(key);
        const list: ProjectNode[] = raw ? JSON.parse(raw) : [];
        const map = new Map<string, ProjectTreeNode>();
        for (const p of list) {
          map.set(p.id, { ...p, children: [] });
        }
        const roots: ProjectTreeNode[] = [];
        for (const node of map.values()) {
          if (node.parent_id && map.has(node.parent_id)) {
            map.get(node.parent_id)!.children.push(node);
          } else {
            roots.push(node);
          }
        }
        return roots;
      } catch {
        return [];
      }
    },
    createProject: async (workspacePath: string, req: CreateProjectRequest): Promise<ProjectNode> => {
      const now = Date.now();
      const node: ProjectNode = {
        id: `proj-${now}`,
        parent_id: req.parent_id || null,
        name: req.name.trim(),
        description: (req.description || '').trim(),
        scope_paths: req.scope_paths || [],
        status: 'idle',
        active_debate_id: null,
        active_pipeline_id: null,
        created_at: now,
        updated_at: now,
      };
      const key = `flymd_projects_${workspacePath || '.'}`;
      const raw = localStorage.getItem(key);
      const list: ProjectNode[] = raw ? JSON.parse(raw) : [];
      list.push(node);
      localStorage.setItem(key, JSON.stringify(list));
      return node;
    },
    updateProject: async (workspacePath: string, projectId: string, req: UpdateProjectRequest): Promise<ProjectNode> => {
      const key = `flymd_projects_${workspacePath || '.'}`;
      const raw = localStorage.getItem(key);
      const list: ProjectNode[] = raw ? JSON.parse(raw) : [];
      const found = list.find((p) => p.id === projectId);
      if (!found) throw new Error(`Project ${projectId} not found.`);
      if (req.name !== undefined) found.name = req.name.trim();
      if (req.description !== undefined) found.description = req.description.trim();
      if (req.scope_paths !== undefined) found.scope_paths = req.scope_paths;
      if (req.status !== undefined) found.status = req.status;
      found.updated_at = Date.now();
      localStorage.setItem(key, JSON.stringify(list));
      return found;
    },
    deleteProject: async (workspacePath: string, projectId: string): Promise<boolean> => {
      const key = `flymd_projects_${workspacePath || '.'}`;
      const raw = localStorage.getItem(key);
      const list: ProjectNode[] = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((p) => p.id !== projectId && p.parent_id !== projectId);
      localStorage.setItem(key, JSON.stringify(filtered));
      return true;
    },
    getMasterMemory: async (workspacePath: string): Promise<string> => {
      const key = `flymd_master_memory_${workspacePath || '.'}`;
      return localStorage.getItem(key) || '# Master Shared Memory\n\nNo invariants recorded yet.\n';
    },
    updateMasterMemory: async (workspacePath: string, content: string): Promise<void> => {
      const key = `flymd_master_memory_${workspacePath || '.'}`;
      localStorage.setItem(key, content);
    },
    getProjectMemory: async (_workspacePath: string, projectId: string): Promise<ProjectMemoryRecord[]> => {
      const key = `flymd_project_memory_${projectId}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    },
    appendProjectMemory: async (
      _workspacePath: string,
      projectId: string,
      authorRole: string,
      kind: MemoryEntryKind,
      summary: string,
      details?: string,
      tags?: string[]
    ): Promise<ProjectMemoryRecord> => {
      const key = `flymd_project_memory_${projectId}`;
      const raw = localStorage.getItem(key);
      const records: ProjectMemoryRecord[] = raw ? JSON.parse(raw) : [];
      const rec: ProjectMemoryRecord = {
        id: `mem-${Date.now()}`,
        project_id: projectId,
        timestamp: Date.now(),
        author_role: authorRole,
        kind,
        summary,
        details: details || null,
        tags: tags || [],
      };
      records.push(rec);
      localStorage.setItem(key, JSON.stringify(records));
      return rec;
    },
    generateRecallPack: async (workspacePath: string, projectId: string): Promise<RecallPack> => {
      const masterKey = `flymd_master_memory_${workspacePath || '.'}`;
      const masterContent = localStorage.getItem(masterKey) || '';
      const memKey = `flymd_project_memory_${projectId}`;
      const memRaw = localStorage.getItem(memKey);
      const memRecords: ProjectMemoryRecord[] = memRaw ? JSON.parse(memRaw) : [];
      const scoped = memRecords.map((r) => `- [${r.kind}] ${r.summary}`).join('\n');
      return {
        project_id: projectId,
        master_invariants: masterContent,
        scoped_context: scoped,
        estimated_tokens: Math.ceil((masterContent.length + scoped.length) / 4),
        rendered_markdown: `## Master Memory\n${masterContent}\n\n## Scoped Memory\n${scoped}`,
      };
    },
    rollupProject: async (workspacePath: string, projectId: string, summary: string): Promise<void> => {
      const masterKey = `flymd_master_memory_${workspacePath || '.'}`;
      const current = localStorage.getItem(masterKey) || '';
      localStorage.setItem(masterKey, `${current}\n\n### Rollup ${projectId}\n${summary}\n`);
    },
  };

  (window as any).electronAPI = bridge;
}
