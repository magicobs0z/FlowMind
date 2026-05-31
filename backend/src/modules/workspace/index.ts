import { scanDirectory, countFiles, calculateTotalSize } from './fileScanner';
import { detectFromPackageJson, detectFromConfigFiles } from './techStackDetector';
import { analyzeModules, parseDependencies } from './moduleAnalyzer';
import { analyzeGit } from './gitAnalyzer';
import { logger } from '../../utils/logger';
import type { ProjectSummary } from './types';

const WORKSPACE_IDS = new Map<string, string>();

function generateId(projectPath: string): string {
  if (WORKSPACE_IDS.has(projectPath)) {
    return WORKSPACE_IDS.get(projectPath)!;
  }

  const hash = Buffer.from(projectPath).toString('base64').substring(0, 12);
  const id = `ws_${hash}_${Date.now()}`;
  WORKSPACE_IDS.set(projectPath, id);
  return id;
}

async function generateProjectSummary(projectPath: string): Promise<ProjectSummary> {
  logger.info({ path: projectPath }, 'Generating project summary');

  const id = generateId(projectPath);
  const createdAt = new Date().toISOString();

  const fileTree = await scanDirectory(projectPath, projectPath);

  const fileCount = countFiles(fileTree);
  const totalSize = calculateTotalSize(fileTree);

  const techStack = await detectFromPackageJson(projectPath);
  await detectFromConfigFiles(projectPath, techStack);

  const modules = await analyzeModules(projectPath);
  const dependencies = await parseDependencies(projectPath);

  const gitInfo = await analyzeGit(projectPath);

  const summary: ProjectSummary = {
    id,
    path: projectPath,
    techStack,
    modules,
    gitInfo,
    dependencies,
    fileCount,
    totalSize,
    createdAt,
  };

  logger.info(
    {
      id,
      fileCount,
      totalSize,
      techStackLanguages: techStack.language,
      moduleCount: modules.length,
    },
    'Project summary generated successfully',
  );

  return summary;
}

export {
  generateProjectSummary,
  scanDirectory,
  countFiles,
  calculateTotalSize,
  detectFromPackageJson,
  detectFromConfigFiles,
  analyzeModules,
  parseDependencies,
  analyzeGit,
};

export type { ProjectSummary } from './types';
export type { FileNode, TechStackInfo, ModuleInfo, GitInfo } from './types';
