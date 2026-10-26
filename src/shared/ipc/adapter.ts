import {
  FileOpenResult,
  HistoryItem,
  AppSettings,
  OllamaModel,
  TranslationRequest,
  FolderSupervisionConfig,
  ScannedMdFile,
} from '../types';
import {
  FileSaveResponse,
  FileFilter,
  LlmGetModelsResult,
  LlmTestConnectionResult,
  TranslationDoneEvent,
  SupervisedFileEvent,
  FolderLoadedEvent,
} from './contract';

export interface IAppIpcAdapter {
  // File operations
  openFileDialog(): Promise<FileOpenResult | null>;
  readFile(filePath: string): Promise<FileOpenResult>;
  saveFile(filePath: string, content: string): Promise<FileSaveResponse>;
  saveFileDialog(
    defaultName: string,
    content: string,
    filters?: FileFilter[]
  ): Promise<FileSaveResponse>;
  exportPdf(defaultName: string, htmlContent: string): Promise<FileSaveResponse>;
  getPathForFile(file: File): string;

  // History operations
  getHistory(): Promise<HistoryItem[]>;
  addHistory(item: { path: string; name: string; preview?: string; size?: number }): Promise<HistoryItem[]>;
  removeHistory(id: string): Promise<HistoryItem[]>;
  clearHistory(): Promise<void>;
  onHistoryUpdated(callback: (history: HistoryItem[]) => void): () => void;

  // Float Hub & Window Management
  toggleFloatAlwaysOnTop(): Promise<boolean>;
  getFloatAlwaysOnTop(): Promise<boolean>;
  togglePreviewAlwaysOnTop(): Promise<boolean>;
  getPreviewAlwaysOnTop(): Promise<boolean>;
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
  moveFloatWindow(deltaX: number, deltaY: number): void;
  getFloatPosition(): Promise<{ x: number; y: number }>;
  setFloatPosition(x: number, y: number): void;
  setFloatExpanded(expanded: boolean): void;

  // Preview & Navigation
  openInPreview(filePath: string): Promise<any>;
  onFileLoaded(callback: (file: FileOpenResult) => void): () => void;
  onFolderLoaded(callback: (data: FolderLoadedEvent) => void): () => void;

  getOllamaModels(configOrUrl?: any): Promise<LlmGetModelsResult>;
  testLlmConnection(config: any): Promise<LlmTestConnectionResult>;
  startTranslation(req: TranslationRequest): void;
  abortTranslation(): void;
  onTranslationChunk(callback: (chunk: string) => void): () => void;
  onTranslationComplete(callback: (result: TranslationDoneEvent) => void): () => void;

  // Settings
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void;

  // Folder Supervision & Tree Scan
  openFolderDialog(): Promise<string | null>;
  scanFolder(dirPath: string, scanMode?: any): Promise<ScannedMdFile[]>;
  setSupervision(config: FolderSupervisionConfig): Promise<boolean>;
  getSupervision(): Promise<FolderSupervisionConfig | null>;
  onSupervisedFileEvent(callback: (data: SupervisedFileEvent) => void): () => void;
  onSupervisedTreeUpdated(callback: (files: ScannedMdFile[]) => void): () => void;
}

