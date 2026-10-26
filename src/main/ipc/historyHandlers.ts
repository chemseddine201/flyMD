import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import { AppContainer } from '../app/container';

export function registerHistoryHandlers(container: AppContainer): void {
  ipcMain.handle(IPC_CHANNELS.HISTORY.GET, () => container.store.getHistory());

  ipcMain.handle(IPC_CHANNELS.HISTORY.ADD, (_event, item) => {
    const updated = container.store.addHistory(item);
    container.broadcaster.broadcastHistory(updated);
    return updated;
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY.REMOVE, (_event, id: string) => {
    const updated = container.store.removeHistory(id);
    container.broadcaster.broadcastHistory(updated);
    return updated;
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY.CLEAR, () => {
    container.store.clearHistory();
    container.broadcaster.broadcastHistory([]);
  });
}

