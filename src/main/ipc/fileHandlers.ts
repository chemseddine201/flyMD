import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC_CHANNELS, FileFilter } from '../../shared/ipc';
import { AppContainer } from '../app/container';
import { FileOpenResult } from '../../shared/types';

export function registerFileHandlers(container: AppContainer): void {
  ipcMain.handle(IPC_CHANNELS.FILE.OPEN_DIALOG, async (event): Promise<FileOpenResult | null> => {
    const parentWin = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Open Markdown Document',
      filters: [
        { name: 'Markdown Documents', extensions: ['md', 'markdown', 'mdown', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    };

    const result = parentWin
      ? await dialog.showOpenDialog(parentWin, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const openRes = await container.documentService.readFile(filePath);
    if (!openRes.success) {
      return null;
    }

    container.broadcaster.sendFileToPreview(openRes.data);
    return openRes.data;
  });

  ipcMain.handle(IPC_CHANNELS.FILE.READ, async (_event, filePath: string): Promise<FileOpenResult | null> => {
    const res = await container.documentService.readFile(filePath);
    return res.success ? res.data : null;
  });

  ipcMain.handle(IPC_CHANNELS.FILE.SAVE, async (_event, filePath: string, content: string) => {
    const res = await container.documentService.saveFile(filePath, content);
    return res.success ? { success: true } : { success: false, error: res.error.message };
  });

  ipcMain.handle(
    IPC_CHANNELS.FILE.SAVE_DIALOG,
    async (event, defaultName: string, content: string, customFilters?: FileFilter[]) => {
      const parentWin = BrowserWindow.fromWebContents(event.sender);
      const filters = customFilters && customFilters.length > 0
        ? customFilters
        : [{ name: 'Markdown File', extensions: ['md', 'markdown'] }];

      const saveOptions: Electron.SaveDialogOptions = {
        title: 'Save Document',
        defaultPath: defaultName || 'Untitled.md',
        filters,
      };

      const result = parentWin
        ? await dialog.showSaveDialog(parentWin, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (result.canceled || !result.filePath) {
        return { success: false };
      }

      const saveRes = await container.documentService.saveFile(result.filePath, content);
      if (saveRes.success) {
        return { success: true, path: result.filePath };
      }
      return { success: false, error: saveRes.error.message };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FILE.EXPORT_PDF,
    async (event, defaultName: string, htmlContent: string) => {
      const parentWin = BrowserWindow.fromWebContents(event.sender);
      const saveOptions: Electron.SaveDialogOptions = {
        title: 'Export as PDF',
        defaultPath: defaultName || 'Document.pdf',
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      };

      const result = parentWin
        ? await dialog.showSaveDialog(parentWin, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (result.canceled || !result.filePath) {
        return { success: false };
      }

      let printWin: BrowserWindow | null = null;
      try {
        printWin = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        // Load the HTML content directly
        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

        // Wait brief tick for fonts & styles to settle
        await new Promise((resolve) => setTimeout(resolve, 300));

        const pdfBuffer = await printWin.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: {
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4,
          },
        });

        await fs.promises.writeFile(result.filePath, pdfBuffer);

        // Record in history
        const stat = await fs.promises.stat(result.filePath);
        const history = container.store.addHistory({
          path: result.filePath,
          name: path.basename(result.filePath),
          size: stat.size,
          preview: 'PDF Document Export',
        });
        container.broadcaster.broadcastHistory(history);

        return { success: true, path: result.filePath };
      } catch (err: any) {
        console.error('[PDF Export Error]:', err);
        return { success: false, error: err?.message || 'Failed to generate PDF' };
      } finally {
        if (printWin && !printWin.isDestroyed()) {
          printWin.close();
        }
      }
    }
  );
}
