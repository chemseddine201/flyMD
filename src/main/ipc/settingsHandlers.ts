import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import { AppContainer } from '../app/container';

export function registerSettingsHandlers(container: AppContainer): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, () => container.store.getSettings());

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SAVE, (_event, patch) => {
    const updated = container.store.updateSettings(patch);
    container.broadcaster.broadcastSettings(updated);
    return updated;
  });
}

