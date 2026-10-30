import * as fs from 'fs';
import * as path from 'path';
import { ScannedMdFile, FolderSupervisionConfig, ScanDepthMode } from '../../shared/types';
import { MD_REGEX } from '../../shared/constants';
import { JsonStore } from '../infrastructure/persistence/JsonStore';
import { WindowBroadcaster } from '../infrastructure/electron/WindowBroadcaster';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.vscode',
  '.idea',
  '.cursor',
  'dist',
  'dist-electron',
  'build',
  'release',
  '.vendor',
  'vendor',
  'coverage',
  '.next',
  '.nuxt',
]);

function isAllowedFile(filename: string, allowedExtensions?: string[]): boolean {
  if (filename.startsWith('.')) return false;
  if (!allowedExtensions || allowedExtensions.length === 0) {
    return MD_REGEX.test(filename);
  }
  if (allowedExtensions.some((ext) => ext === '*' || ext === '*.*')) {
    return true;
  }
  const lower = filename.toLowerCase();
  return allowedExtensions.some((ext) => {
    const clean = ext.trim().toLowerCase();
    if (!clean) return false;
    const dotExt = clean.startsWith('.') ? clean : `.${clean}`;
    return lower.endsWith(dotExt);
  });
}

export class WorkspaceService {
  private activeWatcher: fs.FSWatcher | null = null;
  private currentConfig: FolderSupervisionConfig | null = null;
  private knownFiles: Map<string, number> = new Map();
  private sessionStartTime: number = Date.now();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private store: JsonStore,
    private broadcaster: WindowBroadcaster
  ) {
    // Restore persisted supervision config if enabled
    const saved = this.store.getSupervisionConfig();
    if (saved && saved.enabled) {
      void this.setSupervision(saved);
    }
  }

  public getCurrentConfig(): FolderSupervisionConfig | null {
    return this.currentConfig || this.store.getSupervisionConfig();
  }

  public async scanDirectory(
    rootPath: string,
    scanMode: ScanDepthMode = 'full-tree',
    allowedExtensions?: string[]
  ): Promise<ScannedMdFile[]> {
    const effectiveExts =
      allowedExtensions && allowedExtensions.length > 0
        ? allowedExtensions
        : this.getCurrentConfig()?.allowedExtensions || ['.md', '.markdown'];

    const results: ScannedMdFile[] = [];

    if (scanMode === 'shallow') {
      await this.scanShallow(rootPath, results, effectiveExts);
    } else {
      await this.walk(rootPath, rootPath, results, effectiveExts);
    }

    // Sort newest first: compare the most recent of (createdAt, modifiedAt)
    results.sort((a, b) => {
      const timeA = Math.max(a.createdAt, a.modifiedAt);
      const timeB = Math.max(b.createdAt, b.modifiedAt);
      return timeB - timeA;
    });

    this.knownFiles.clear();
    for (const f of results) {
      this.knownFiles.set(f.path, f.modifiedAt);
    }

    return results;
  }

  private async scanShallow(rootPath: string, results: ScannedMdFile[], allowedExts: string[]) {
    try {
      const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && isAllowedFile(entry.name, allowedExts)) {
          const fullPath = path.join(rootPath, entry.name);
          try {
            const stat = await fs.promises.stat(fullPath);
            const isRecent = stat.birthtimeMs >= this.sessionStartTime || stat.mtimeMs >= this.sessionStartTime;

            results.push({
              path: fullPath,
              name: entry.name,
              relativePath: entry.name,
              createdAt: stat.birthtimeMs,
              modifiedAt: stat.mtimeMs,
              size: stat.size,
              isNew: isRecent,
            });
          } catch {
            // Ignore locked files
          }
        }
      }
    } catch (err) {
      console.warn(`[WorkspaceService] Error scanning directory shallow ${rootPath}:`, err);
    }
  }

  private async walk(currentDir: string, rootPath: string, results: ScannedMdFile[], allowedExts: string[]) {
    try {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            await this.walk(fullPath, rootPath, results, allowedExts);
          }
        } else if (entry.isFile()) {
          if (isAllowedFile(entry.name, allowedExts)) {
            try {
              const stat = await fs.promises.stat(fullPath);
              const relativePath = path.relative(rootPath, fullPath);
              const isRecent = stat.birthtimeMs >= this.sessionStartTime || stat.mtimeMs >= this.sessionStartTime;

              results.push({
                path: fullPath,
                name: entry.name,
                relativePath: relativePath || entry.name,
                createdAt: stat.birthtimeMs,
                modifiedAt: stat.mtimeMs,
                size: stat.size,
                isNew: isRecent,
              });
            } catch {
              // Ignore locked files
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[WorkspaceService] Error scanning directory ${currentDir}:`, err);
    }
  }

  public stopWatching(): void {
    if (this.activeWatcher) {
      try {
        this.activeWatcher.close();
      } catch {
        // ignore
      }
      this.activeWatcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  public async setSupervision(config: FolderSupervisionConfig): Promise<void> {
    this.stopWatching();
    this.currentConfig = config;
    this.store.setSupervisionConfig(config.enabled ? config : null);

    if (!config.enabled || !config.path || !fs.existsSync(config.path)) {
      return;
    }

    try {
      const isShallow = config.scanMode === 'shallow';
      this.activeWatcher = fs.watch(config.path, { recursive: !isShallow }, (_eventType, filename) => {
        if (!filename) return;
        if (!isAllowedFile(filename, config.allowedExtensions)) return;

        const parts = filename.split(/[\\/]/);
        if (isShallow && parts.length > 1) {
          return;
        }

        if (parts.some((p) => IGNORED_DIRS.has(p) || p.startsWith('.'))) {
          return;
        }

        const fullPath = path.join(config.path, filename);

        if (this.debounceTimers.has(fullPath)) {
          clearTimeout(this.debounceTimers.get(fullPath)!);
        }

        const timer = setTimeout(async () => {
          this.debounceTimers.delete(fullPath);
          await this.handleFileEvent(fullPath, config);
        }, 300);

        this.debounceTimers.set(fullPath, timer);
      });

      console.log(
        `[WorkspaceService] Now supervising ${config.path} (mode: ${config.scanMode || 'full-tree'}, autoOpen: ${config.autoOpenNew})`
      );
    } catch (err) {
      console.error('[WorkspaceService] Failed to start watcher:', err);
    }
  }

  private async handleFileEvent(fullPath: string, config: FolderSupervisionConfig): Promise<void> {
    try {
      const scanMode = config.scanMode || 'full-tree';
      const exists = fs.existsSync(fullPath);
      if (!exists) {
        this.knownFiles.delete(fullPath);
        const updated = await this.scanDirectory(config.path, scanMode);
        this.broadcaster.broadcastSupervisedTree(updated);
        return;
      }

      const stat = await fs.promises.stat(fullPath);
      const isKnown = this.knownFiles.has(fullPath);
      this.knownFiles.set(fullPath, stat.mtimeMs);

      const fileItem: ScannedMdFile = {
        path: fullPath,
        name: path.basename(fullPath),
        relativePath: path.relative(config.path, fullPath),
        createdAt: stat.birthtimeMs,
        modifiedAt: stat.mtimeMs,
        size: stat.size,
        isNew: true,
      };

      this.broadcaster.broadcastSupervisedFile({
        file: fileItem,
        isNew: !isKnown,
        autoOpen: config.autoOpenNew,
      });

      const updated = await this.scanDirectory(config.path, scanMode);
      this.broadcaster.broadcastSupervisedTree(updated);
    } catch (err) {
      console.warn('[WorkspaceService] Error handling file event:', err);
    }
  }
}

