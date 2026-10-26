import { BrowserWindow } from 'electron';
import {
  HistoryItem,
  AppSettings,
  FileOpenResult,
  ScannedMdFile,
} from '../../../shared/types';
import {
  IPC_CHANNELS,
  SupervisedFileEvent,
  FolderLoadedEvent,
} from '../../../shared/ipc';

export interface WindowProvider {
  getFloatWindow(): BrowserWindow | null;
  getPreviewWindow(): BrowserWindow | null;
  createPreviewWindow(): BrowserWindow;
}

export class WindowBroadcaster {
  constructor(private windowProvider: WindowProvider) {}

  public broadcastToAll(channel: string, payload: unknown): void {
    const floatWin = this.windowProvider.getFloatWindow();
    const previewWin = this.windowProvider.getPreviewWindow();

    if (floatWin && !floatWin.isDestroyed()) {
      floatWin.webContents.send(channel, payload);
    }
    if (previewWin && !previewWin.isDestroyed()) {
      previewWin.webContents.send(channel, payload);
    }
  }

  public broadcastHistory(history: HistoryItem[]): void {
    this.broadcastToAll(IPC_CHANNELS.HISTORY.UPDATED, history);
  }

  public broadcastSettings(settings: AppSettings): void {
    this.broadcastToAll(IPC_CHANNELS.SETTINGS.CHANGED, settings);
  }

  public sendFileToPreview(file: FileOpenResult): BrowserWindow {
    const previewWin = this.windowProvider.createPreviewWindow();
    previewWin.webContents.send(IPC_CHANNELS.PREVIEW.FILE_LOADED, file);
    previewWin.show();
    previewWin.focus();
    return previewWin;
  }

  public sendFolderToPreview(event: FolderLoadedEvent): BrowserWindow {
    const previewWin = this.windowProvider.createPreviewWindow();
    previewWin.webContents.send(IPC_CHANNELS.PREVIEW.FOLDER_LOADED, event);
    previewWin.show();
    previewWin.focus();
    return previewWin;
  }

  public broadcastSupervisedFile(event: SupervisedFileEvent): void {
    const previewWin = this.windowProvider.getPreviewWindow();
    if (previewWin && !previewWin.isDestroyed()) {
      previewWin.webContents.send(IPC_CHANNELS.FOLDER.SUPERVISED_FILE_EVENT, event);
    }
  }

  public broadcastSupervisedTree(files: ScannedMdFile[]): void {
    const previewWin = this.windowProvider.getPreviewWindow();
    if (previewWin && !previewWin.isDestroyed()) {
      previewWin.webContents.send(IPC_CHANNELS.FOLDER.SUPERVISED_TREE_UPDATED, files);
    }
  }
}

