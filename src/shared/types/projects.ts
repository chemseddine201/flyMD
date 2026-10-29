export type ProjectStatus =
  | 'idle'
  | 'debating'
  | 'report_ready'
  | 'pipeline_running'
  | 'completed';

export interface ProjectNode {
  id: string;
  parent_id?: string | null;
  name: string;
  description: string;
  scope_paths: string[];
  status: ProjectStatus;
  active_debate_id?: string | null;
  active_pipeline_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface ProjectTreeNode extends ProjectNode {
  children: ProjectTreeNode[];
}

export interface CreateProjectRequest {
  parent_id?: string | null;
  name: string;
  description?: string;
  scope_paths?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  scope_paths?: string[];
  status?: ProjectStatus;
  active_debate_id?: string | null;
  active_pipeline_id?: string | null;
}

export type MemoryEntryKind =
  | 'decision'
  | 'invariant'
  | 'deliverable'
  | 'audit_note';

export interface ProjectMemoryRecord {
  id: string;
  project_id: string;
  timestamp: number;
  author_role: string;
  kind: MemoryEntryKind;
  summary: string;
  details?: string | null;
  tags: string[];
}

export interface RecallPack {
  project_id: string;
  master_invariants: string;
  scoped_context: string;
  estimated_tokens: number;
  rendered_markdown: string;
}
