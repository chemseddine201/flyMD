import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  HistoryItem,
  AppSettings,
  OllamaModel,
  TranslationRequest,
  FileOpenResult,
  ScannedMdFile,
  FolderSupervisionConfig,
  AgentProfile,
  AgentCredentialConfig,
  AgentCredentialsMap,
  AgentTaskRequest,
  AgentTaskRecord,
  AgentCheckpoint,
  AgentStreamEvent,
} from '../shared/types';
import {
  IPC_CHANNELS,
  FileSaveResponse,
  FileFilter,
  LlmGetModelsResult,
  LlmTestConnectionResult,
  TranslationDoneEvent,
  SupervisedFileEvent,
  FolderLoadedEvent,
} from '../shared/ipc';

const electronAPI = {
  // File operations
  openFileDialog: (): Promise<FileOpenResult | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE.OPEN_DIALOG),
  readFile: (filePath: string): Promise<FileOpenResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE.READ, filePath),
  saveFile: (filePath: string, content: string): Promise<FileSaveResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE.SAVE, filePath, content),
  saveFileDialog: (
    defaultName: string,
    content: string,
    filters?: FileFilter[]
  ): Promise<FileSaveResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE.SAVE_DIALOG, defaultName, content, filters),
  exportPdf: (defaultName: string, htmlContent: string): Promise<FileSaveResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE.EXPORT_PDF, defaultName, htmlContent),
  getPathForFile: (file: File): string => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch {
      // fallback
    }
    return (file as any).path || '';
  },

  // History operations
  getHistory: (): Promise<HistoryItem[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY.GET),
  addHistory: (item: { path: string; name: string; preview?: string; size?: number }): Promise<HistoryItem[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY.ADD, item),
  removeHistory: (id: string): Promise<HistoryItem[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY.REMOVE, id),
  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY.CLEAR),
  onHistoryUpdated: (callback: (history: HistoryItem[]) => void) => {
    const handler = (_: any, data: HistoryItem[]) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.HISTORY.UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.HISTORY.UPDATED, handler);
  },

  // Float Hub & Window Management
  toggleFloatAlwaysOnTop: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.FLOAT_TOGGLE_PIN),
  getFloatAlwaysOnTop: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.FLOAT_GET_PIN),
  togglePreviewAlwaysOnTop: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.PREVIEW_TOGGLE_PIN),
  getPreviewAlwaysOnTop: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.PREVIEW_GET_PIN),
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW.MINIMIZE),
  maximizeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW.MAXIMIZE),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW.CLOSE),
  moveFloatWindow: (deltaX: number, deltaY: number) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW.FLOAT_MOVE, deltaX, deltaY),
  getFloatPosition: (): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.FLOAT_GET_POSITION),
  setFloatPosition: (x: number, y: number) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW.FLOAT_SET_POSITION, x, y),
  setFloatExpanded: (expanded: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW.FLOAT_SET_EXPANDED, expanded),
  hideFloatWindow: () =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW.FLOAT_HIDE),
  saveFloatPosition: () =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW.FLOAT_SAVE_POSITION),

  // Preview & Navigation
  openInPreview: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PREVIEW.OPEN_FILE, filePath),
  onFileLoaded: (callback: (file: FileOpenResult) => void) => {
    const handler = (_: any, data: FileOpenResult) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.PREVIEW.FILE_LOADED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PREVIEW.FILE_LOADED, handler);
  },
  onFolderLoaded: (callback: (data: FolderLoadedEvent) => void) => {
    const handler = (_: any, data: FolderLoadedEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.PREVIEW.FOLDER_LOADED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PREVIEW.FOLDER_LOADED, handler);
  },

  getOllamaModels: (configOrUrl?: any): Promise<LlmGetModelsResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM.GET_MODELS, configOrUrl),
  testLlmConnection: (config: any): Promise<LlmTestConnectionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM.TEST_CONNECTION, config),
  startTranslation: (req: TranslationRequest) =>
    ipcRenderer.send(IPC_CHANNELS.LLM.TRANSLATE_START, req),
  abortTranslation: () =>
    ipcRenderer.send(IPC_CHANNELS.LLM.TRANSLATE_ABORT),
  onTranslationChunk: (callback: (chunk: string) => void) => {
    const handler = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on(IPC_CHANNELS.LLM.TRANSLATE_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LLM.TRANSLATE_CHUNK, handler);
  },
  onTranslationComplete: (callback: (result: TranslationDoneEvent) => void) => {
    const handler = (_: any, res: TranslationDoneEvent) => callback(res);
    ipcRenderer.on(IPC_CHANNELS.LLM.TRANSLATE_DONE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LLM.TRANSLATE_DONE, handler);
  },

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SAVE, settings),
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    const handler = (_: any, s: AppSettings) => callback(s);
    ipcRenderer.on(IPC_CHANNELS.SETTINGS.CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS.CHANGED, handler);
  },

  // Folder Supervision & Tree Scan
  openFolderDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FOLDER.OPEN_DIALOG),
  scanFolder: (dirPath: string, scanMode?: any): Promise<ScannedMdFile[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.FOLDER.SCAN, dirPath, scanMode),
  setSupervision: (config: FolderSupervisionConfig): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.FOLDER.SET_SUPERVISION, config),
  getSupervision: (): Promise<FolderSupervisionConfig | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FOLDER.GET_SUPERVISION),
  onSupervisedFileEvent: (callback: (data: SupervisedFileEvent) => void) => {
    const handler = (_: any, data: SupervisedFileEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.FOLDER.SUPERVISED_FILE_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.FOLDER.SUPERVISED_FILE_EVENT, handler);
  },
  onSupervisedTreeUpdated: (callback: (files: ScannedMdFile[]) => void) => {
    const handler = (_: any, data: ScannedMdFile[]) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.FOLDER.SUPERVISED_TREE_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.FOLDER.SUPERVISED_TREE_UPDATED, handler);
  },

  // Multi-Agent Workspace Supervisor
  discoverAgents: (): Promise<AgentProfile[]> =>
    ipcRenderer.invoke('agent:discover'),
  saveAgentCredential: (agentId: string, credential: AgentCredentialConfig): Promise<AgentProfile[]> =>
    ipcRenderer.invoke('agent:save-credential', agentId, credential),
  getAgentCredentials: (): Promise<AgentCredentialsMap> =>
    ipcRenderer.invoke('agent:get-credentials'),
  launchAgentLogin: (agentId: string): Promise<string> =>
    ipcRenderer.invoke('agent:launch-login', agentId),
  launchAgentWebAuth: (agentId: string, taskPrompt?: string, taskId?: string): Promise<string> =>
    ipcRenderer.invoke('agent:launch-web-auth', agentId, taskPrompt, taskId),
  dispatchAgentTask: (request: AgentTaskRequest): Promise<AgentTaskRecord> =>
    ipcRenderer.invoke('agent:dispatch-task', request),
  getAgentTasks: (): Promise<AgentTaskRecord[]> =>
    ipcRenderer.invoke('agent:get-tasks'),
  cancelAgentTask: (taskId: string): Promise<AgentTaskRecord[]> =>
    ipcRenderer.invoke('agent:cancel-task', taskId),
  clearAgentTasks: (): Promise<AgentTaskRecord[]> =>
    ipcRenderer.invoke('agent:clear-tasks'),
  getAgentCheckpoints: (): Promise<AgentCheckpoint[]> =>
    ipcRenderer.invoke('agent:get-checkpoints'),
  restoreAgentCheckpoint: (checkpointId: string): Promise<string> =>
    ipcRenderer.invoke('agent:restore-checkpoint', checkpointId),
  removeAgentProfile: (agentId: string): Promise<AgentProfile[]> =>
    ipcRenderer.invoke('agent:remove-profile', agentId),
  completeWebTaskWithReply: (taskId: string, replyMarkdown: string): Promise<AgentTaskRecord> =>
    ipcRenderer.invoke('agent:complete-web-task', taskId, replyMarkdown),
  onAgentProfilesUpdated: (callback: (profiles: AgentProfile[]) => void) => {
    const handler = (_: any, data: AgentProfile[]) => callback(data);
    ipcRenderer.on('agent:profiles-updated', handler);
    return () => ipcRenderer.removeListener('agent:profiles-updated', handler);
  },
  onAgentTasksUpdated: (callback: (tasks: AgentTaskRecord[]) => void) => {
    const handler = (_: any, data: AgentTaskRecord[]) => callback(data);
    ipcRenderer.on('agent:tasks-updated', handler);
    return () => ipcRenderer.removeListener('agent:tasks-updated', handler);
  },
  onAgentCheckpointsUpdated: (callback: (checkpoints: AgentCheckpoint[]) => void) => {
    const handler = (_: any, data: AgentCheckpoint[]) => callback(data);
    ipcRenderer.on('agent:checkpoints-updated', handler);
    return () => ipcRenderer.removeListener('agent:checkpoints-updated', handler);
  },
  onAgentStream: (callback: (evt: AgentStreamEvent) => void) => {
    const handler = (_: any, data: AgentStreamEvent) => callback(data);
    ipcRenderer.on('agent:stream', handler);
    return () => ipcRenderer.removeListener('agent:stream', handler);
  },
};

export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
