import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import { AppContainer } from '../app/container';
import { windowManager } from '../windows';

export function registerWindowHandlers(container: AppContainer): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW.FLOAT_TOGGLE_PIN, () => windowManager.toggleFloatAlwaysOnTop());

  ipcMain.handle(IPC_CHANNELS.WINDOW.FLOAT_GET_PIN, () => {
    const win = windowManager.getFloatWindow();
    return win ? win.isAlwaysOnTop() : container.store.getSettings().floatAlwaysOnTop;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.PREVIEW_TOGGLE_PIN, () => windowManager.togglePreviewAlwaysOnTop());

  ipcMain.handle(IPC_CHANNELS.WINDOW.PREVIEW_GET_PIN, () => {
    const win = windowManager.getPreviewWindow();
    return win ? win.isAlwaysOnTop() : container.store.getSettings().previewAlwaysOnTop;
  });

  ipcMain.on(IPC_CHANNELS.WINDOW.MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW.MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on(IPC_CHANNELS.WINDOW.CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW.FLOAT_MOVE, (_event, deltaX: number, deltaY: number) => {
    windowManager.moveFloatWindow(deltaX, deltaY);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.FLOAT_GET_POSITION, () => {
    return windowManager.getFloatPosition();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW.FLOAT_SET_POSITION, (_event, x: number, y: number) => {
    windowManager.setFloatPosition(x, y);
  });

  ipcMain.on(IPC_CHANNELS.WINDOW.FLOAT_HIDE, () => {
    windowManager.getFloatWindow()?.hide();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW.FLOAT_SAVE_POSITION, () => {
    const pos = windowManager.getFloatPosition();
    if (pos) {
      container.store.setFloatBounds(pos);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PREVIEW.OPEN_FILE, async (_event, targetPath: string) => {
    await container.documentService.openPath(targetPath);
  });
}

