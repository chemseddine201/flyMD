import { jsonStore, JsonStore } from '../infrastructure/persistence/JsonStore';
import { WindowBroadcaster } from '../infrastructure/electron/WindowBroadcaster';
import { windowManager } from '../windows';
import { DocumentService } from '../services/DocumentService';
import { WorkspaceService } from '../services/WorkspaceService';
import { TranslationService } from '../services/llm/TranslationService';

export class AppContainer {
  public readonly store: JsonStore;
  public readonly broadcaster: WindowBroadcaster;
  public readonly documentService: DocumentService;
  public readonly workspaceService: WorkspaceService;
  public readonly translationService: TranslationService;

  constructor() {
    this.store = jsonStore;
    this.broadcaster = new WindowBroadcaster(windowManager);
    this.documentService = new DocumentService(this.store, this.broadcaster);
    this.workspaceService = new WorkspaceService(this.store, this.broadcaster);
    this.translationService = new TranslationService(this.store);
  }
}

export const container = new AppContainer();

