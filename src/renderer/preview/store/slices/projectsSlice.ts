import { StateCreator } from 'zustand';
import {
  ProjectNode,
  ProjectTreeNode,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectMemoryRecord,
  RecallPack,
  MemoryEntryKind,
} from '../../../../shared/types';

export interface ProjectsSlice {
  projects: ProjectNode[];
  projectHierarchy: ProjectTreeNode[];
  selectedProjectId: string | null;
  activeProject: ProjectNode | null;
  masterMemory: string;
  projectMemories: Record<string, ProjectMemoryRecord[]>;
  activeRecallPack: RecallPack | null;
  isProjectsLoading: boolean;
  projectsError: string | null;

  loadProjects: (workspacePath: string) => Promise<void>;
  loadHierarchy: (workspacePath: string) => Promise<void>;
  selectProject: (projectId: string | null) => void;
  createProject: (
    workspacePath: string,
    req: CreateProjectRequest
  ) => Promise<ProjectNode | null>;
  updateProject: (
    workspacePath: string,
    projectId: string,
    req: UpdateProjectRequest
  ) => Promise<ProjectNode | null>;
  deleteProject: (
    workspacePath: string,
    projectId: string
  ) => Promise<boolean>;
  loadMasterMemory: (workspacePath: string) => Promise<void>;
  saveMasterMemory: (workspacePath: string, content: string) => Promise<void>;
  loadProjectMemory: (
    workspacePath: string,
    projectId: string
  ) => Promise<void>;
  appendProjectMemory: (
    workspacePath: string,
    projectId: string,
    authorRole: string,
    kind: MemoryEntryKind,
    summary: string,
    details?: string,
    tags?: string[]
  ) => Promise<ProjectMemoryRecord | null>;
  generateRecallPack: (
    workspacePath: string,
    projectId: string,
    maxTokens?: number
  ) => Promise<RecallPack | null>;
  rollupProject: (
    workspacePath: string,
    projectId: string,
    summary: string
  ) => Promise<void>;
}

export const createProjectsSlice: StateCreator<ProjectsSlice> = (set, get) => ({
  projects: [],
  projectHierarchy: [],
  selectedProjectId: null,
  activeProject: null,
  masterMemory: '',
  projectMemories: {},
  activeRecallPack: null,
  isProjectsLoading: false,
  projectsError: null,

  loadProjects: async (workspacePath: string) => {
    if (!window.electronAPI?.listProjects) return;
    try {
      set({ isProjectsLoading: true, projectsError: null });
      const projects = await window.electronAPI.listProjects(workspacePath);
      set({ projects: projects || [] });
      await get().loadHierarchy(workspacePath);
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to load projects:', e);
      set({ projectsError: String(e) });
    } finally {
      set({ isProjectsLoading: false });
    }
  },

  loadHierarchy: async (workspacePath: string) => {
    if (!window.electronAPI?.getProjectHierarchy) return;
    try {
      const hierarchy = await window.electronAPI.getProjectHierarchy(workspacePath);
      set({ projectHierarchy: hierarchy || [] });
      const { selectedProjectId, projects } = get();
      if (selectedProjectId) {
        const found = projects.find((p) => p.id === selectedProjectId) || null;
        set({ activeProject: found });
      }
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to load hierarchy:', e);
    }
  },

  selectProject: (projectId: string | null) => {
    const { projects } = get();
    const active = projectId ? projects.find((p) => p.id === projectId) || null : null;
    set({ selectedProjectId: projectId, activeProject: active, activeRecallPack: null });
  },

  createProject: async (workspacePath: string, req: CreateProjectRequest) => {
    if (!window.electronAPI?.createProject) return null;
    try {
      set({ isProjectsLoading: true, projectsError: null });
      const created = await window.electronAPI.createProject(workspacePath, req);
      await get().loadProjects(workspacePath);
      get().selectProject(created.id);
      return created;
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to create project:', e);
      set({ projectsError: String(e) });
      return null;
    } finally {
      set({ isProjectsLoading: false });
    }
  },

  updateProject: async (
    workspacePath: string,
    projectId: string,
    req: UpdateProjectRequest
  ) => {
    if (!window.electronAPI?.updateProject) return null;
    try {
      const updated = await window.electronAPI.updateProject(
        workspacePath,
        projectId,
        req
      );
      await get().loadProjects(workspacePath);
      return updated;
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to update project:', e);
      set({ projectsError: String(e) });
      return null;
    }
  },

  deleteProject: async (workspacePath: string, projectId: string) => {
    if (!window.electronAPI?.deleteProject) return false;
    try {
      set({ isProjectsLoading: true, projectsError: null });
      const success = await window.electronAPI.deleteProject(
        workspacePath,
        projectId
      );
      if (get().selectedProjectId === projectId) {
        set({ selectedProjectId: null, activeProject: null });
      }
      await get().loadProjects(workspacePath);
      return success;
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to delete project:', e);
      set({ projectsError: String(e) });
      return false;
    } finally {
      set({ isProjectsLoading: false });
    }
  },

  loadMasterMemory: async (workspacePath: string) => {
    if (!window.electronAPI?.getMasterMemory) return;
    try {
      const content = await window.electronAPI.getMasterMemory(workspacePath);
      set({ masterMemory: content || '' });
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to load master memory:', e);
    }
  },

  saveMasterMemory: async (workspacePath: string, content: string) => {
    if (!window.electronAPI?.updateMasterMemory) return;
    try {
      await window.electronAPI.updateMasterMemory(workspacePath, content);
      set({ masterMemory: content });
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to save master memory:', e);
      set({ projectsError: String(e) });
    }
  },

  loadProjectMemory: async (workspacePath: string, projectId: string) => {
    if (!window.electronAPI?.getProjectMemory) return;
    try {
      const records = await window.electronAPI.getProjectMemory(
        workspacePath,
        projectId
      );
      set((state) => ({
        projectMemories: {
          ...state.projectMemories,
          [projectId]: records || [],
        },
      }));
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to load project memory:', e);
    }
  },

  appendProjectMemory: async (
    workspacePath: string,
    projectId: string,
    authorRole: string,
    kind: MemoryEntryKind,
    summary: string,
    details?: string,
    tags?: string[]
  ) => {
    if (!window.electronAPI?.appendProjectMemory) return null;
    try {
      const record = await window.electronAPI.appendProjectMemory(
        workspacePath,
        projectId,
        authorRole,
        kind,
        summary,
        details,
        tags
      );
      await get().loadProjectMemory(workspacePath, projectId);
      return record;
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to append project memory:', e);
      set({ projectsError: String(e) });
      return null;
    }
  },

  generateRecallPack: async (
    workspacePath: string,
    projectId: string,
    maxTokens?: number
  ) => {
    if (!window.electronAPI?.generateRecallPack) return null;
    try {
      const pack = await window.electronAPI.generateRecallPack(
        workspacePath,
        projectId,
        maxTokens
      );
      set({ activeRecallPack: pack });
      return pack;
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to generate recall pack:', e);
      return null;
    }
  },

  rollupProject: async (
    workspacePath: string,
    projectId: string,
    summary: string
  ) => {
    if (!window.electronAPI?.rollupProject) return;
    try {
      await window.electronAPI.rollupProject(workspacePath, projectId, summary);
      await get().loadMasterMemory(workspacePath);
      await get().loadProjects(workspacePath);
    } catch (e: any) {
      console.error('[ProjectsSlice] Failed to rollup project:', e);
      set({ projectsError: String(e) });
    }
  },
});
