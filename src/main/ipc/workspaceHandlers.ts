import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import { AppContainer } from '../app/container';
import { FolderSupervisionConfig, ScannedMdFile, ScanDepthMode } from '../../shared/types';

export function registerWorkspaceHandlers(container: AppContainer): void {
  ipcMain.handle(IPC_CHANNELS.FOLDER.OPEN_DIALOG, async (event): Promise<string | null> => {
    const parentWin = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Select Project / Markdown Folder',
      properties: ['openDirectory'],
    };

    const result = parentWin
      ? await dialog.showOpenDialog(parentWin, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC_CHANNELS.FOLDER.SCAN,
    async (_event, folderPath: string, scanMode?: ScanDepthMode, allowedExtensions?: string[]): Promise<ScannedMdFile[]> => {
      return await container.workspaceService.scanDirectory(folderPath, scanMode, allowedExtensions);
    }
  );

  ipcMain.handle(IPC_CHANNELS.FOLDER.SET_SUPERVISION, async (_event, config: FolderSupervisionConfig) => {
    await container.workspaceService.setSupervision(config);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.FOLDER.GET_SUPERVISION, () => {
    return container.workspaceService.getCurrentConfig();
  });
}

