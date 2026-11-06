import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import { AppContainer } from '../app/container';
import { windowManager } from '../windows';

export function registerSettingsHandlers(container: AppContainer): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, () => container.store.getSettings());

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SAVE, (_event, patch) => {
    const updated = container.store.updateSettings(patch);
    container.broadcaster.broadcastSettings(updated);

    if (patch.theme) {
      const previewWin = windowManager.getPreviewWindow();
      if (previewWin && !previewWin.isDestroyed()) {
        const isLight = patch.theme === 'light' || patch.theme === 'clean-white';
        previewWin.setBackgroundColor(isLight ? '#ffffff' : '#0f172a');
      }
    }

    return updated;
  });
}

