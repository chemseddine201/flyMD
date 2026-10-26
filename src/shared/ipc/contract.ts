import {
  FileOpenResult,
  HistoryItem,
  AppSettings,
  OllamaModel,
  TranslationRequest,
  FolderSupervisionConfig,
  ScannedMdFile,
} from '../types';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface FileSaveResponse {
  success: boolean;
  error?: string;
  path?: string;
}

export interface LlmTestConnectionResult {
  success: boolean;
  message: string;
  models?: OllamaModel[];
}

export interface LlmGetModelsResult {
  success: boolean;
  models: OllamaModel[];
  error?: string;
}

export interface TranslationDoneEvent {
  success: boolean;
  text?: string;
  error?: string;
}

export interface SupervisedFileEvent {
  file: ScannedMdFile;
  isNew: boolean;
  autoOpen: boolean;
}

export interface FolderLoadedEvent {
  folderPath: string;
  folderName: string;
  files: ScannedMdFile[];
}
