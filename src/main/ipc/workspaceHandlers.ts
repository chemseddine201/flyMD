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

  ipcMain.handle('agent:fetch-models', async (_event, agentId: string) => {
    const norm = (agentId || '').trim().toLowerCase();
    if (norm === 'antigravity' || norm === 'gemini-antigravity' || norm === 'gemini' || norm === 'agy') {
      try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync(process.platform === 'win32' ? 'cmd.exe' : 'agy', process.platform === 'win32' ? ['/c', 'agy', 'models'] : ['models'], {
          timeout: 8000,
          windowsHide: true,
        });
        const order: string[] = [];
        const nameMap = new Map<string, string>();
        const effortsMap = new Map<string, string[]>();
        for (const line of String(stdout || '').split(/\r?\n/)) {
          const idx = line.indexOf('\t');
          if (idx === -1) continue;
          const slug = line.slice(0, idx).trim();
          const label = line.slice(idx + 1).trim();
          if (!slug) continue;
          let baseSlug = slug;
          let parsedEffort: string | null = null;
          for (const effSuffix of ['low', 'medium', 'high', 'xhigh', 'max']) {
            if (slug.endsWith(`-${effSuffix}`)) {
              baseSlug = slug.slice(0, -(effSuffix.length + 1));
              parsedEffort = effSuffix;
              break;
            }
          }
          let cleanLabel = label.replace(/\s*\((Low|Medium|High|X-High|Max)\)\s*$/i, '').trim();
          if (!order.includes(baseSlug)) order.push(baseSlug);
          if (!nameMap.has(baseSlug)) nameMap.set(baseSlug, cleanLabel || baseSlug);
          const list = effortsMap.get(baseSlug) || [];
          if (parsedEffort && !list.includes(parsedEffort)) list.push(parsedEffort);
          effortsMap.set(baseSlug, list);
        }
        if (order.length > 0) {
          const canonical = ['low', 'medium', 'high', 'xhigh', 'max'];
          return order.map((id) => {
            const effs = (effortsMap.get(id) || ['low', 'medium', 'high']).sort(
              (a, b) => canonical.indexOf(a) - canonical.indexOf(b)
            );
            const defaultEffortLevel = effs.includes('high') ? 'high' : effs.includes('medium') ? 'medium' : effs[0] || 'medium';
            const displayName = nameMap.get(id) || id;
            return {
              id,
              displayName,
              supportsReasoning: true,
              supportedEffortLevels: effs,
              defaultEffortLevel,
              description: `${displayName} (Live Antigravity CLI subscription model)`,
            };
          });
        }
      } catch {
        // Fallback below
      }
      return [
        { id: 'gemini-4-argon', displayName: 'Gemini 4 Argon', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high' },
        { id: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high' },
        { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high' },
        { id: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high' },
        { id: 'gpt-oss-120b', displayName: 'GPT-OSS 120B', supportsReasoning: true, supportedEffortLevels: ['medium'], defaultEffortLevel: 'medium' },
      ];
    }
    if (norm === 'claude-code' || norm === 'claude' || norm === 'anthropic') {
      return [
        { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffortLevel: 'high' },
        { id: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffortLevel: 'high' },
        { id: 'opus', displayName: 'Claude Opus (Latest Alias)', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffortLevel: 'high' },
        { id: 'sonnet', displayName: 'Claude Sonnet (Latest Alias)', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffortLevel: 'high' },
        { id: 'haiku', displayName: 'Claude Haiku (Fast Alias)', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'medium' },
      ];
    }
    if (norm === 'codex' || norm === 'openai') {
      return [
        { id: 'o3-mini', displayName: 'OpenAI o3-mini', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high' },
        { id: 'o3', displayName: 'OpenAI o3', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high', 'xhigh'], defaultEffortLevel: 'high' },
        { id: 'gpt-4o', displayName: 'GPT-4o', supportsReasoning: false, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'medium' },
      ];
    }
    return [
      { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high' },
      { id: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high' },
      { id: 'gemini-4-argon', displayName: 'Gemini 4 Argon', supportsReasoning: true, supportedEffortLevels: ['low', 'medium', 'high'], defaultEffortLevel: 'high' },
    ];
  });
}

