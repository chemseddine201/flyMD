import { ScannedMdFile } from '../../../shared/types';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  relativePath: string;
  depth: number;
  file?: ScannedMdFile;
  children: FileTreeNode[];
  hasNewDescendant: boolean;
  fileCount: number;
}

/**
 * Builds a hierarchical system folder/file tree from a flat list of ScannedMdFile items.
 * Folders are sorted before files at each level.
 */
export function buildFileTree(files: ScannedMdFile[]): FileTreeNode[] {
  const rootChildren: FileTreeNode[] = [];
  const folderMap = new Map<string, FileTreeNode>();

  for (const file of files) {
    const normalizedRel = (file.relativePath || file.name).replace(/\\/g, '/');
    const segments = normalizedRel.split('/').filter(Boolean);

    let currentLevel = rootChildren;
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (isLast) {
        currentLevel.push({
          id: file.path,
          name: segment,
          type: 'file',
          relativePath: normalizedRel,
          depth: i,
          file,
          children: [],
          hasNewDescendant: Boolean(file.isNew),
          fileCount: 1,
        });
      } else {
        const folderKey = currentPath.toLowerCase();
        let folderNode = folderMap.get(folderKey);
        if (!folderNode) {
          folderNode = {
            id: `folder:${currentPath}`,
            name: segment,
            type: 'folder',
            relativePath: currentPath,
            depth: i,
            children: [],
            hasNewDescendant: false,
            fileCount: 0,
          };
          folderMap.set(folderKey, folderNode);
          currentLevel.push(folderNode);
        }
        currentLevel = folderNode.children;
      }
    }
  }

  // Recursively sort (folders first, then files alphabetically) and compute aggregates
  const finalizeNodes = (nodes: FileTreeNode[]): void => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    for (const node of nodes) {
      if (node.type === 'folder') {
        finalizeNodes(node.children);
        node.hasNewDescendant = node.children.some(
          (c) => c.hasNewDescendant || Boolean(c.file?.isNew)
        );
        node.fileCount = node.children.reduce(
          (sum, c) => sum + (c.type === 'file' ? 1 : c.fileCount),
          0
        );
      }
    }
  };

  finalizeNodes(rootChildren);
  return rootChildren;
}

/**
 * Collects all folder IDs in a tree (useful for Expand All).
 */
export function collectAllFolderIds(nodes: FileTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: FileTreeNode[]) => {
    for (const n of list) {
      if (n.type === 'folder') {
        ids.push(n.id);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

