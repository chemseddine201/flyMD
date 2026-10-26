import { TextDirection } from '../utils/direction';

export interface TabItem {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  isNew?: boolean;
  lastModified?: number;
  direction?: TextDirection;
}

export interface FileOpenResult {
  path: string;
  name: string;
  content: string;
  lastModified?: number;
}
