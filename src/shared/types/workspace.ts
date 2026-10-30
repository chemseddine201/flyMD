export interface ScannedMdFile {
  path: string;
  name: string;
  relativePath: string;
  createdAt: number;
  modifiedAt: number;
  size: number;
  isNew?: boolean;
  sourceAgent?: string;
  checklistTotal?: number;
  checklistDone?: number;
}

export type ScanDepthMode = 'full-tree' | 'shallow';

export interface FolderSupervisionConfig {
  path: string;
  name: string;
  enabled: boolean;
  autoOpenNew: boolean;
  scanMode?: ScanDepthMode;
  collectExternalAgentArtifacts?: boolean;
  allowedExtensions?: string[];
}

