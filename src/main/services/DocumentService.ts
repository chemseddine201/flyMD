import * as fs from 'fs';
import * as path from 'path';
import { FileOpenResult, Result, ok, err } from '../../shared/types';
import { JsonStore } from '../infrastructure/persistence/JsonStore';
import { WindowBroadcaster } from '../infrastructure/electron/WindowBroadcaster';
import { folderScanner } from '../scanner';

export class DocumentService {
  constructor(
    private store: JsonStore,
    private broadcaster: WindowBroadcaster
  ) {}

  public async readFile(filePath: string): Promise<Result<FileOpenResult>> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const stat = await fs.promises.stat(filePath);
      const name = path.basename(filePath);

      const history = this.store.addHistory({
        path: filePath,
        name,
        size: stat.size,
        preview: content.slice(0, 150),
      });
      this.broadcaster.broadcastHistory(history);

      return ok({
        path: filePath,
        name,
        content,
        lastModified: stat.mtimeMs,
      });
    } catch (error: any) {
      return err(new Error(error?.message || 'Failed to read file'));
    }
  }

  public async saveFile(filePath: string, content: string): Promise<Result<{ path: string }>> {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      const stat = await fs.promises.stat(filePath);
      const name = path.basename(filePath);

      const history = this.store.addHistory({
        path: filePath,
        name,
        size: stat.size,
        preview: content.slice(0, 150),
      });
      this.broadcaster.broadcastHistory(history);

      return ok({ path: filePath });
    } catch (error: any) {
      return err(new Error(error?.message || 'Failed to save file'));
    }
  }

  public async openPath(targetPath: string): Promise<Result<FileOpenResult | { folderPath: string }>> {
    try {
      const stat = await fs.promises.stat(targetPath);

      if (stat.isDirectory()) {
        const files = await folderScanner.scanDirectory(targetPath);
        this.broadcaster.sendFolderToPreview({
          folderPath: targetPath,
          folderName: path.basename(targetPath),
          files,
        });
        return ok({ folderPath: targetPath });
      }

      const fileResult = await this.readFile(targetPath);
      if (fileResult.success) {
        this.broadcaster.sendFileToPreview(fileResult.data);
      }
      return fileResult;
    } catch (error: any) {
      return err(new Error(error?.message || 'Failed to open path'));
    }
  }
}

