export interface ScannedMdFile {
  path: string;
  name: string;
  relativePath: string;
  createdAt: number;
  modifiedAt: number;
  size: number;
  isNew?: boolean;
}

export type ScanDepthMode = 'full-tree' | 'shallow';

export interface FolderSupervisionConfig {
  path: string;
  name: string;
  enabled: boolean;
  autoOpenNew: boolean;
  scanMode?: ScanDepthMode; // 'full-tree' = recursive subfolders; 'shallow' = specified folder only
}

