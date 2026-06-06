export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  status?: 'new' | 'modified' | 'deleted' | 'unchanged';
}

export interface TechStackInfo {
  frontend: string[];
  backend: string[];
  database: string[];
  testing: string[];
  devtools: string[];
  language: string[];
  framework: string[];
}

export interface ModuleInfo {
  name: string;
  path: string;
  type: 'feature' | 'module' | 'package' | 'component' | 'library';
  files: string[];
}

export interface GitInfo {
  branch: string;
  currentCommit: string;
  commitCount: number;
  lastCommitDate: string;
  lastCommitMessage: string;
  author: string;
  totalBranches: number;
}

export interface ProjectSummary {
  id: string;
  path: string;
  name: string;
  techStack: TechStackInfo;
  modules: ModuleInfo[];
  gitInfo: GitInfo;
  dependencies: Record<string, string>;
  fileCount: number;
  totalSize: number;
  fileTree: FileNode[];
  createdAt: string;
}
