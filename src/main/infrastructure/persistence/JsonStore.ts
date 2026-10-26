import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppSettings, HistoryItem, WindowState, FolderSupervisionConfig } from '../../../shared/types';
import { DEFAULT_SETTINGS, DEFAULT_WINDOW_BOUNDS, TIMINGS } from '../../../shared/constants';
import { createId } from '../../../shared/utils';

export interface StoreSchema {
  schemaVersion: number;
  settings: AppSettings;
  history: HistoryItem[];
  floatBounds: { x?: number; y?: number };
  previewBounds: WindowState;
  supervisionConfig: FolderSupervisionConfig | null;
}

const CURRENT_SCHEMA_VERSION = 2;

function createDefaultData(): StoreSchema {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    history: [],
    floatBounds: {},
    previewBounds: {
      width: DEFAULT_WINDOW_BOUNDS.preview.width,
      height: DEFAULT_WINDOW_BOUNDS.preview.height,
    },
    supervisionConfig: null,
  };
}

export class JsonStore {
  private filePath = '';
  private data: StoreSchema = createDefaultData();
  private initialized = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private isSaving = false;
  private pendingSave = false;

  constructor() {
    // If electron is already ready, init immediately
    if (app && typeof app.isReady === 'function' && app.isReady()) {
      this.ensureInit();
    }
  }

  public ensureInit(): void {
    if (this.initialized) return;
    try {
      if (app && typeof app.getPath === 'function') {
        const userDataPath = app.getPath('userData');
        if (userDataPath) {
          this.filePath = path.join(userDataPath, 'fly-md-store.json');
          this.data = this.load();
          this.initialized = true;
        }
      }
    } catch (err) {
      console.warn('[JsonStore] Deferred initialization until app is ready:', err);
    }
  }

  private load(): StoreSchema {
    const fallback = createDefaultData();
    try {
      if (this.filePath && fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return this.migrate(parsed, fallback);
      }
    } catch (err) {
      console.error('[JsonStore] Failed to load store, recovering with defaults:', err);
    }
    return fallback;
  }

  private migrate(parsed: any, fallback: StoreSchema): StoreSchema {
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }

    const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
    const migrated: StoreSchema = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings: { ...fallback.settings, ...(parsed.settings || {}) },
      history: Array.isArray(parsed.history) ? parsed.history : [],
      floatBounds: parsed.floatBounds || {},
      previewBounds: parsed.previewBounds || fallback.previewBounds,
      supervisionConfig: parsed.supervisionConfig || null,
    };

    if (!migrated.settings.llmConfig) {
      migrated.settings.llmConfig = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.llmConfig));
    }

    if (version < CURRENT_SCHEMA_VERSION) {
      this.scheduleSave();
    }

    return migrated;
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, TIMINGS.STORE_DEBOUNCE_MS);
  }

  public async flush(): Promise<void> {
    this.ensureInit();
    if (!this.filePath) return;

    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }

    this.isSaving = true;
    const tempFile = `${this.filePath}.${Date.now()}.tmp`;
    const serialized = JSON.stringify(this.data, null, 2);

    try {
      await fs.promises.writeFile(tempFile, serialized, 'utf-8');
      await fs.promises.rename(tempFile, this.filePath);
    } catch (err) {
      console.error('[JsonStore] Atomic write failed:', err);
      try {
        if (fs.existsSync(tempFile)) {
          await fs.promises.unlink(tempFile);
        }
      } catch {
        // cleanup ignore
      }
    } finally {
      this.isSaving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        void this.flush();
      }
    }
  }

  public flushSync(): void {
    this.ensureInit();
    if (!this.filePath) return;
    try {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[JsonStore] Synchronous flush failed:', err);
    }
  }

  // --- Getters and Setters ---

  public getSettings(): AppSettings {
    this.ensureInit();
    return { ...this.data.settings };
  }

  public updateSettings(patch: Partial<AppSettings>): AppSettings {
    this.ensureInit();
    this.data.settings = { ...this.data.settings, ...patch };
    this.scheduleSave();
    return { ...this.data.settings };
  }

  public getHistory(): HistoryItem[] {
    this.ensureInit();
    return [...this.data.history];
  }

  public addHistory(item: { path: string; name: string; preview?: string; size?: number }): HistoryItem[] {
    this.ensureInit();
    const filtered = this.data.history.filter((h) => h.path.toLowerCase() !== item.path.toLowerCase());
    const newItem: HistoryItem = {
      id: createId('hist'),
      path: item.path,
      name: item.name,
      lastOpened: Date.now(),
      preview: item.preview,
      size: item.size,
    };
    this.data.history = [newItem, ...filtered].slice(0, 30);
    this.scheduleSave();
    return [...this.data.history];
  }

  public removeHistory(id: string): HistoryItem[] {
    this.ensureInit();
    this.data.history = this.data.history.filter((h) => h.id !== id);
    this.scheduleSave();
    return [...this.data.history];
  }

  public clearHistory(): void {
    this.ensureInit();
    this.data.history = [];
    this.scheduleSave();
  }

  public getFloatBounds(): { x?: number; y?: number } {
    this.ensureInit();
    return { ...this.data.floatBounds };
  }

  public setFloatBounds(bounds: { x?: number; y?: number }): void {
    this.ensureInit();
    this.data.floatBounds = { ...this.data.floatBounds, ...bounds };
    this.scheduleSave();
  }

  public getPreviewBounds(): WindowState {
    this.ensureInit();
    return { ...this.data.previewBounds };
  }

  public setPreviewBounds(bounds: WindowState): void {
    this.ensureInit();
    this.data.previewBounds = { ...this.data.previewBounds, ...bounds };
    this.scheduleSave();
  }

  public getSupervisionConfig(): FolderSupervisionConfig | null {
    this.ensureInit();
    return this.data.supervisionConfig ? { ...this.data.supervisionConfig } : null;
  }

  public setSupervisionConfig(config: FolderSupervisionConfig | null): void {
    this.ensureInit();
    this.data.supervisionConfig = config ? { ...config } : null;
    this.scheduleSave();
  }
}

export const jsonStore = new JsonStore();

