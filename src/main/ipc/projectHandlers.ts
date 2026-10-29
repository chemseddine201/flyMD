import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  CreateProjectRequest,
  ProjectNode,
  ProjectTreeNode,
  UpdateProjectRequest,
  ProjectMemoryRecord,
  RecallPack,
  MemoryEntryKind,
} from '../../shared/types';
import { AppContainer } from '../app/container';

function resolveWs(workspacePath: string): string {
  if (!workspacePath || workspacePath.trim() === '' || workspacePath.trim() === '.') {
    return process.cwd();
  }
  return workspacePath;
}

function getProjectsDir(workspacePath: string): string {
  const ws = resolveWs(workspacePath);
  return path.join(ws, '.flymd', 'projects');
}

function getMasterMemoryPath(workspacePath: string): string {
  const ws = resolveWs(workspacePath);
  return path.join(ws, '.flymd', 'MASTER_MEMORY.md');
}

function loadAllProjects(workspacePath: string): ProjectNode[] {
  const pDir = getProjectsDir(workspacePath);
  if (!fs.existsSync(pDir)) return [];
  const projects: ProjectNode[] = [];
  try {
    const entries = fs.readdirSync(pDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const jsonPath = path.join(pDir, entry.name, 'project.json');
        if (fs.existsSync(jsonPath)) {
          try {
            const raw = fs.readFileSync(jsonPath, 'utf8');
            const parsed = JSON.parse(raw);
            projects.push(parsed);
          } catch (e) {
            console.warn('[ProjectHandlers] Failed to read project JSON:', jsonPath, e);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ProjectHandlers] Failed reading projects dir:', pDir, err);
  }
  projects.sort((a, b) => a.created_at - b.created_at);
  return projects;
}

function buildHierarchy(projects: ProjectNode[]): ProjectTreeNode[] {
  const map = new Map<string, ProjectTreeNode>();
  for (const p of projects) {
    map.set(p.id, { ...p, children: [] });
  }
  const roots: ProjectTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function registerProjectHandlers(_container?: AppContainer): void {
  ipcMain.handle('workspace:get-cwd', () => {
    return process.cwd();
  });

  ipcMain.handle('projects:list', (_event, workspacePath: string): ProjectNode[] => {
    return loadAllProjects(workspacePath);
  });

  ipcMain.handle(
    'projects:get-hierarchy',
    (_event, workspacePath: string): ProjectTreeNode[] => {
      const all = loadAllProjects(workspacePath);
      return buildHierarchy(all);
    }
  );

  ipcMain.handle(
    'projects:create',
    (_event, workspacePath: string, req: CreateProjectRequest): ProjectNode => {
      const ws = resolveWs(workspacePath);
      const now = Date.now();
      const id = `proj-${now}`;

      const node: ProjectNode = {
        id,
        parent_id: req.parent_id || null,
        name: req.name.trim(),
        description: (req.description || '').trim(),
        scope_paths: req.scope_paths || [],
        status: 'idle',
        active_debate_id: null,
        active_pipeline_id: null,
        created_at: now,
        updated_at: now,
      };

      const pDir = path.join(getProjectsDir(ws), id);
      fs.mkdirSync(pDir, { recursive: true });

      const jsonPath = path.join(pDir, 'project.json');
      fs.writeFileSync(jsonPath, JSON.stringify(node, null, 2), 'utf8');

      // Initialize scoped memory
      const memPath = path.join(pDir, 'memory.jsonl');
      const initialRecord: ProjectMemoryRecord = {
        id: `mem-${now}`,
        project_id: id,
        timestamp: now,
        author_role: 'system',
        kind: 'decision',
        summary: `Created project node \`${node.name}\` (${id})`,
        details: node.description || undefined,
        tags: ['lifecycle', 'init'],
      };
      fs.writeFileSync(memPath, JSON.stringify(initialRecord) + '\n', 'utf8');

      return node;
    }
  );

  ipcMain.handle(
    'projects:update',
    (
      _event,
      workspacePath: string,
      projectId: string,
      req: UpdateProjectRequest
    ): ProjectNode => {
      const ws = resolveWs(workspacePath);
      const jsonPath = path.join(getProjectsDir(ws), projectId, 'project.json');
      if (!fs.existsSync(jsonPath)) {
        throw new Error(`Project ${projectId} not found on disk.`);
      }

      const raw = fs.readFileSync(jsonPath, 'utf8');
      const current: ProjectNode = JSON.parse(raw);

      if (req.name !== undefined) current.name = req.name.trim();
      if (req.description !== undefined) current.description = req.description.trim();
      if (req.scope_paths !== undefined) current.scope_paths = req.scope_paths;
      if (req.status !== undefined) current.status = req.status;
      if (req.active_debate_id !== undefined) current.active_debate_id = req.active_debate_id;
      if (req.active_pipeline_id !== undefined) current.active_pipeline_id = req.active_pipeline_id;
      current.updated_at = Date.now();

      fs.writeFileSync(jsonPath, JSON.stringify(current, null, 2), 'utf8');
      return current;
    }
  );

  ipcMain.handle(
    'projects:delete',
    (_event, workspacePath: string, projectId: string): boolean => {
      const ws = resolveWs(workspacePath);
      const pDir = path.join(getProjectsDir(ws), projectId);
      if (fs.existsSync(pDir)) {
        fs.rmSync(pDir, { recursive: true, force: true });
      }
      return true;
    }
  );

  ipcMain.handle(
    'projects:get-master-memory',
    (_event, workspacePath: string): string => {
      const mPath = getMasterMemoryPath(workspacePath);
      if (fs.existsSync(mPath)) {
        return fs.readFileSync(mPath, 'utf8');
      }
      const defaultContent = `# Workspace Master Shared Memory\n\n> Global architectural invariants, cross-project API contracts, and high-level milestones.\n\n## 1. System Invariants & Architecture Contracts\n- All projects run in isolated process trees with PID tracking.\n- Deliverables require verified evidence before marked completed.\n\n## 2. Completed Projects & Rollup Summaries\n_No projects rolled up yet._\n`;
      fs.mkdirSync(path.dirname(mPath), { recursive: true });
      fs.writeFileSync(mPath, defaultContent, 'utf8');
      return defaultContent;
    }
  );

  ipcMain.handle(
    'projects:update-master-memory',
    (_event, workspacePath: string, content: string): void => {
      const mPath = getMasterMemoryPath(workspacePath);
      fs.mkdirSync(path.dirname(mPath), { recursive: true });
      fs.writeFileSync(mPath, content, 'utf8');
    }
  );

  ipcMain.handle(
    'projects:get-project-memory',
    (_event, workspacePath: string, projectId: string): ProjectMemoryRecord[] => {
      const ws = resolveWs(workspacePath);
      const memPath = path.join(getProjectsDir(ws), projectId, 'memory.jsonl');
      if (!fs.existsSync(memPath)) return [];
      const lines = fs.readFileSync(memPath, 'utf8').split('\n');
      const records: ProjectMemoryRecord[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            records.push(JSON.parse(trimmed));
          } catch {}
        }
      }
      return records;
    }
  );

  ipcMain.handle(
    'projects:append-memory',
    (
      _event,
      workspacePath: string,
      projectId: string,
      authorRole: string,
      kind: MemoryEntryKind,
      summary: string,
      details?: string,
      tags?: string[]
    ): ProjectMemoryRecord => {
      const ws = resolveWs(workspacePath);
      const pDir = path.join(getProjectsDir(ws), projectId);
      fs.mkdirSync(pDir, { recursive: true });
      const memPath = path.join(pDir, 'memory.jsonl');
      const record: ProjectMemoryRecord = {
        id: `mem-${Date.now()}`,
        project_id: projectId,
        timestamp: Date.now(),
        author_role: authorRole,
        kind,
        summary,
        details: details || null,
        tags: tags || [],
      };
      fs.appendFileSync(memPath, JSON.stringify(record) + '\n', 'utf8');
      return record;
    }
  );

  ipcMain.handle(
    'projects:generate-recall-pack',
    (
      _event,
      workspacePath: string,
      projectId: string,
      _maxTokens?: number
    ): RecallPack => {
      const ws = resolveWs(workspacePath);
      const mPath = getMasterMemoryPath(ws);
      const masterContent = fs.existsSync(mPath) ? fs.readFileSync(mPath, 'utf8') : '';

      const memPath = path.join(getProjectsDir(ws), projectId, 'memory.jsonl');
      const scopedLines = fs.existsSync(memPath) ? fs.readFileSync(memPath, 'utf8') : '';

      const rendered = `## Master Memory Invariants\n${masterContent}\n\n## Scoped Project Memory\n${scopedLines}`;
      return {
        project_id: projectId,
        master_invariants: masterContent,
        scoped_context: scopedLines,
        estimated_tokens: Math.ceil(rendered.length / 4),
        rendered_markdown: rendered,
      };
    }
  );

  ipcMain.handle(
    'projects:rollup',
    (_event, workspacePath: string, projectId: string, summary: string): void => {
      const mPath = getMasterMemoryPath(workspacePath);
      const entry = `\n### Rollup for \`${projectId}\` (${new Date().toISOString()})\n${summary}\n`;
      fs.mkdirSync(path.dirname(mPath), { recursive: true });
      fs.appendFileSync(mPath, entry, 'utf8');
    }
  );
}

