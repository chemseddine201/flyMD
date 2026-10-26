import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import { AppContainer } from '../app/container';
import { TranslationRequest } from '../../shared/types';

export function registerLlmHandlers(container: AppContainer): void {
  ipcMain.handle(IPC_CHANNELS.LLM.GET_MODELS, async (_event, configOrUrl?: any) => {
    return await container.translationService.listModels(configOrUrl);
  });

  ipcMain.handle(IPC_CHANNELS.LLM.TEST_CONNECTION, async (_event, config: any) => {
    return await container.translationService.testConnection(config);
  });

  ipcMain.on(IPC_CHANNELS.LLM.TRANSLATE_START, async (event, req: TranslationRequest) => {
    const callerId = String(event.sender.id);
    const result = await container.translationService.translate(
      req,
      (chunk: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.LLM.TRANSLATE_CHUNK, chunk);
        }
      },
      callerId
    );

    if (!event.sender.isDestroyed()) {
      event.sender.send(IPC_CHANNELS.LLM.TRANSLATE_DONE, {
        success: result.success,
        text: result.result,
        error: result.error,
      });
    }
  });

  ipcMain.on(IPC_CHANNELS.LLM.TRANSLATE_ABORT, (event) => {
    const callerId = String(event.sender.id);
    container.translationService.abort(callerId);
  });
}

