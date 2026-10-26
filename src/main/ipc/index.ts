import { AppContainer, container } from '../app/container';
import { registerFileHandlers } from './fileHandlers';
import { registerHistoryHandlers } from './historyHandlers';
import { registerWindowHandlers } from './windowHandlers';
import { registerSettingsHandlers } from './settingsHandlers';
import { registerWorkspaceHandlers } from './workspaceHandlers';
import { registerLlmHandlers } from './llmHandlers';

export function registerIpcHandlers(appContainer: AppContainer = container): void {
  registerFileHandlers(appContainer);
  registerHistoryHandlers(appContainer);
  registerWindowHandlers(appContainer);
  registerSettingsHandlers(appContainer);
  registerWorkspaceHandlers(appContainer);
  registerLlmHandlers(appContainer);
}

