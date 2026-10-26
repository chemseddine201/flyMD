import { container } from './app/container';
import { FolderSupervisionConfig, ScanDepthMode, ScannedMdFile } from '../shared/types';

export const folderScanner = {
  getCurrentConfig: (): FolderSupervisionConfig | null => container.workspaceService.getCurrentConfig(),
  scanDirectory: (rootPath: string, scanMode?: ScanDepthMode): Promise<ScannedMdFile[]> =>
    container.workspaceService.scanDirectory(rootPath, scanMode),
  stopWatching: (): void => container.workspaceService.stopWatching(),
  setSupervision: (config: FolderSupervisionConfig): Promise<void> => container.workspaceService.setSupervision(config),
};

export class FolderScanner {
  getCurrentConfig() {
    return folderScanner.getCurrentConfig();
  }
  scanDirectory(rootPath: string, scanMode?: ScanDepthMode) {
    return folderScanner.scanDirectory(rootPath, scanMode);
  }
  stopWatching() {
    return folderScanner.stopWatching();
  }
  setSupervision(config: FolderSupervisionConfig) {
    return folderScanner.setSupervision(config);
  }
}
