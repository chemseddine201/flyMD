import { IAppIpcAdapter } from './adapter';
import {
  FileOpenResult,
  HistoryItem,
  AppSettings,
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

/**
 * Electron adapter delegating to window.electronAPI exposed by preload.
 */
class ElectronIpcAdapter implements IAppIpcAdapter {
  private get api() {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return (window as any).electronAPI;
    }
    throw new Error('electronAPI is not available on window');
  }

  openFileDialog(): Promise<FileOpenResult | null> {
    return this.api.openFileDialog();
  }
  readFile(filePath: string): Promise<FileOpenResult> {
    return this.api.readFile(filePath);
  }
  saveFile(filePath: string, content: string): Promise<FileSaveResponse> {
    return this.api.saveFile(filePath, content);
  }
  saveFileDialog(
    defaultName: string,
    content: string,
    filters?: FileFilter[]
  ): Promise<FileSaveResponse> {
    return this.api.saveFileDialog(defaultName, content, filters);
  }
  exportPdf(defaultName: string, htmlContent: string): Promise<FileSaveResponse> {
    return this.api.exportPdf(defaultName, htmlContent);
  }
  getPathForFile(file: File): string {
    return this.api.getPathForFile(file);
  }

  getHistory(): Promise<HistoryItem[]> {
    return this.api.getHistory();
  }
  addHistory(item: { path: string; name: string; preview?: string; size?: number }): Promise<HistoryItem[]> {
    return this.api.addHistory(item);
  }
  removeHistory(id: string): Promise<HistoryItem[]> {
    return this.api.removeHistory(id);
  }
  clearHistory(): Promise<void> {
    return this.api.clearHistory();
  }
  onHistoryUpdated(callback: (history: HistoryItem[]) => void): () => void {
    return this.api.onHistoryUpdated(callback);
  }

  toggleFloatAlwaysOnTop(): Promise<boolean> {
    return this.api.toggleFloatAlwaysOnTop();
  }
  getFloatAlwaysOnTop(): Promise<boolean> {
    return this.api.getFloatAlwaysOnTop();
  }
  togglePreviewAlwaysOnTop(): Promise<boolean> {
    return this.api.togglePreviewAlwaysOnTop();
  }
  getPreviewAlwaysOnTop(): Promise<boolean> {
    return this.api.getPreviewAlwaysOnTop();
  }
  minimizeWindow(): void {
    this.api.minimizeWindow();
  }
  maximizeWindow(): void {
    this.api.maximizeWindow();
  }
  closeWindow(): void {
    this.api.closeWindow();
  }
  moveFloatWindow(deltaX: number, deltaY: number): void {
    this.api.moveFloatWindow(deltaX, deltaY);
  }
  getFloatPosition(): Promise<{ x: number; y: number }> {
    return this.api.getFloatPosition();
  }
  setFloatPosition(x: number, y: number): void {
    this.api.setFloatPosition(x, y);
  }
  setFloatExpanded(expanded: boolean): void {
    this.api.setFloatExpanded(expanded);
  }

  openInPreview(filePath: string): Promise<any> {
    return this.api.openInPreview(filePath);
  }
  onFileLoaded(callback: (file: FileOpenResult) => void): () => void {
    return this.api.onFileLoaded(callback);
  }
  onFolderLoaded(callback: (data: FolderLoadedEvent) => void): () => void {
    return this.api.onFolderLoaded(callback);
  }

  getOllamaModels(configOrUrl?: any): Promise<LlmGetModelsResult> {
    return this.api.getOllamaModels(configOrUrl);
  }
  testLlmConnection(config: any): Promise<LlmTestConnectionResult> {
    return this.api.testLlmConnection(config);
  }
  startTranslation(req: TranslationRequest): void {
    this.api.startTranslation(req);
  }
  abortTranslation(): void {
    this.api.abortTranslation();
  }
  onTranslationChunk(callback: (chunk: string) => void): () => void {
    return this.api.onTranslationChunk(callback);
  }
  onTranslationComplete(callback: (result: TranslationDoneEvent) => void): () => void {
    return this.api.onTranslationComplete(callback);
  }

  getSettings(): Promise<AppSettings> {
    return this.api.getSettings();
  }
  saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return this.api.saveSettings(settings);
  }
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void {
    return this.api.onSettingsChanged(callback);
  }

  openFolderDialog(): Promise<string | null> {
    return this.api.openFolderDialog();
  }
  scanFolder(dirPath: string, scanMode?: any): Promise<ScannedMdFile[]> {
    return this.api.scanFolder(dirPath, scanMode);
  }
  setSupervision(config: FolderSupervisionConfig): Promise<boolean> {
    return this.api.setSupervision(config);
  }
  getSupervision(): Promise<FolderSupervisionConfig | null> {
    return this.api.getSupervision();
  }
  onSupervisedFileEvent(callback: (data: SupervisedFileEvent) => void): () => void {
    return this.api.onSupervisedFileEvent(callback);
  }
  onSupervisedTreeUpdated(callback: (files: ScannedMdFile[]) => void): () => void {
    return this.api.onSupervisedTreeUpdated(callback);
  }
}

/**
 * Pake / Tauri adapter delegating to Tauri v2 core API.
 */
class TauriIpcAdapter implements IAppIpcAdapter {
  private tauri: any;

  constructor() {
    this.tauri = (window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__;
  }

  private async invoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
    if (this.tauri?.core?.invoke) {
      return this.tauri.core.invoke(cmd, args);
    }
    throw new Error(`Tauri invoke is not available for command: ${cmd}`);
  }

  private listen<T>(event: string, callback: (payload: T) => void): () => void {
    let unlistenFn: (() => void) | null = null;
    if (this.tauri?.event?.listen) {
      this.tauri.event.listen(event, (e: any) => callback(e.payload)).then((unlisten: () => void) => {
        unlistenFn = unlisten;
      });
    }
    return () => {
      if (unlistenFn) unlistenFn();
    };
  }

  async openFileDialog(): Promise<FileOpenResult | null> {
    return this.invoke('flymd_open_file_dialog');
  }
  async readFile(filePath: string): Promise<FileOpenResult> {
    return this.invoke('flymd_read_file', { filePath });
  }
  async saveFile(filePath: string, content: string): Promise<FileSaveResponse> {
    return this.invoke('flymd_save_file', { filePath, content });
  }
  async saveFileDialog(defaultName: string, content: string, filters?: FileFilter[]): Promise<FileSaveResponse> {
    return this.invoke('flymd_save_file_dialog', { defaultName, content, filters });
  }
  async exportPdf(defaultName: string, htmlContent: string): Promise<FileSaveResponse> {
    return this.invoke('flymd_export_pdf', { defaultName, htmlContent });
  }
  getPathForFile(file: File): string {
    return (file as any).path || '';
  }

  async getHistory(): Promise<HistoryItem[]> {
    return this.invoke('flymd_get_history');
  }
  async addHistory(item: { path: string; name: string; preview?: string; size?: number }): Promise<HistoryItem[]> {
    return this.invoke('flymd_add_history', { item });
  }
  async removeHistory(id: string): Promise<HistoryItem[]> {
    return this.invoke('flymd_remove_history', { id });
  }
  async clearHistory(): Promise<void> {
    return this.invoke('flymd_clear_history');
  }
  onHistoryUpdated(callback: (history: HistoryItem[]) => void): () => void {
    return this.listen('flymd://history-updated', callback);
  }

  async toggleFloatAlwaysOnTop(): Promise<boolean> {
    return this.invoke('flymd_float_toggle_pin');
  }
  async getFloatAlwaysOnTop(): Promise<boolean> {
    return this.invoke('flymd_float_get_pin');
  }
  async togglePreviewAlwaysOnTop(): Promise<boolean> {
    return this.invoke('flymd_preview_toggle_pin');
  }
  async getPreviewAlwaysOnTop(): Promise<boolean> {
    return this.invoke('flymd_preview_get_pin');
  }
  minimizeWindow(): void {
    this.invoke('flymd_window_minimize').catch(console.error);
  }
  maximizeWindow(): void {
    this.invoke('flymd_window_maximize').catch(console.error);
  }
  closeWindow(): void {
    this.invoke('flymd_window_close').catch(console.error);
  }
  moveFloatWindow(deltaX: number, deltaY: number): void {
    this.invoke('flymd_float_move', { deltaX, deltaY }).catch(console.error);
  }
  async getFloatPosition(): Promise<{ x: number; y: number }> {
    return this.invoke('flymd_float_get_position');
  }
  setFloatPosition(x: number, y: number): void {
    this.invoke('flymd_float_set_position', { x, y }).catch(console.error);
  }
  setFloatExpanded(expanded: boolean): void {
    this.invoke('flymd_float_set_expanded', { expanded }).catch(console.error);
  }

  async openInPreview(filePath: string): Promise<any> {
    return this.invoke('flymd_open_in_preview', { filePath });
  }
  onFileLoaded(callback: (file: FileOpenResult) => void): () => void {
    return this.listen('flymd://file-loaded', callback);
  }
  onFolderLoaded(callback: (data: FolderLoadedEvent) => void): () => void {
    return this.listen('flymd://folder-loaded', callback);
  }

  async getOllamaModels(configOrUrl?: any): Promise<LlmGetModelsResult> {
    return this.invoke('flymd_get_models', { config: configOrUrl });
  }
  async testLlmConnection(config: any): Promise<LlmTestConnectionResult> {
    return this.invoke('flymd_test_llm_connection', { config });
  }
  startTranslation(req: TranslationRequest): void {
    this.invoke('flymd_start_translation', { req }).catch(console.error);
  }
  abortTranslation(): void {
    this.invoke('flymd_abort_translation').catch(console.error);
  }
  onTranslationChunk(callback: (chunk: string) => void): () => void {
    return this.listen('flymd://translation-chunk', callback);
  }
  onTranslationComplete(callback: (result: TranslationDoneEvent) => void): () => void {
    return this.listen('flymd://translation-done', callback);
  }

  async getSettings(): Promise<AppSettings> {
    return this.invoke('flymd_get_settings');
  }
  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return this.invoke('flymd_save_settings', { settings });
  }
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void {
    return this.listen('flymd://settings-changed', callback);
  }

  async openFolderDialog(): Promise<string | null> {
    return this.invoke('flymd_open_folder_dialog');
  }
  async scanFolder(dirPath: string, scanMode?: any): Promise<ScannedMdFile[]> {
    return this.invoke('flymd_scan_folder', { dirPath, scanMode });
  }
  async setSupervision(config: FolderSupervisionConfig): Promise<boolean> {
    return this.invoke('flymd_set_supervision', { config });
  }
  async getSupervision(): Promise<FolderSupervisionConfig | null> {
    return this.invoke('flymd_get_supervision');
  }
  onSupervisedFileEvent(callback: (data: SupervisedFileEvent) => void): () => void {
    return this.listen('flymd://supervised-file-event', callback);
  }
  onSupervisedTreeUpdated(callback: (files: ScannedMdFile[]) => void): () => void {
    return this.listen('flymd://supervised-tree-updated', callback);
  }
}

let activeAdapter: IAppIpcAdapter | null = null;

export function getAppIpc(): IAppIpcAdapter {
  if (activeAdapter) return activeAdapter;

  const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__);
  if (isTauri) {
    activeAdapter = new TauriIpcAdapter();
  } else {
    activeAdapter = new ElectronIpcAdapter();
  }
  return activeAdapter;
}

