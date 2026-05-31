import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../../utils/logger';
import type { GitInfo } from './types';

let isomorphicGit: typeof import('isomorphic-git') | null = null;

async function loadIsomorphicGit(): Promise<typeof import('isomorphic-git') | null> {
  if (isomorphicGit !== null) {
    return isomorphicGit;
  }

  try {
    isomorphicGit = await import('isomorphic-git');
    return isomorphicGit;
  } catch {
    logger.warn('isomorphic-git not installed, git analysis will be limited');
    return null;
  }
}

function createEmptyGitInfo(): GitInfo {
  return {
    branch: 'unknown',
    currentCommit: 'unknown',
    commitCount: 0,
    lastCommitDate: '',
    lastCommitMessage: '',
    author: '',
    totalBranches: 0,
  };
}

async function analyzeGit(projectPath: string): Promise<GitInfo> {
  const gitDir = join(projectPath, '.git');

  if (!existsSync(gitDir)) {
    logger.info({ path: projectPath }, 'No .git directory found, skipping git analysis');
    return createEmptyGitInfo();
  }

  const git = await loadIsomorphicGit();
  if (!git) {
    logger.warn('isomorphic-git not available');
    return createEmptyGitInfo();
  }

  const fs = await import('fs/promises');

  try {
    const currentBranch = await git.currentBranch({
      fs,
      dir: projectPath,
      fullname: true,
    });

    const branchName = currentBranch || 'HEAD';

    const log = await git.log({
      fs,
      dir: projectPath,
      depth: 1,
    });

    let lastCommitDate = '';
    let lastCommitMessage = '';
    let author = '';
    let currentCommit = '';

    if (log.length > 0) {
      const latestCommit = log[0];
      if (latestCommit) {
        currentCommit = (latestCommit.commit as any).oid || '';
        lastCommitDate = new Date(latestCommit.commit.committer.timestamp).toISOString();
        lastCommitMessage = latestCommit.commit.message;
        author = latestCommit.commit.author.name;
      }
    }

    const branches = await git.listBranches({
      fs,
      dir: projectPath,
    });

    const totalBranches = branches.length;

    let commitCount = 0;
    try {
      const allLog = await git.log({
        fs,
        dir: projectPath,
      });
      commitCount = allLog.length;
    } catch {
      logger.warn('Failed to count all commits');
    }

    return {
      branch: branchName.replace('refs/heads/', ''),
      currentCommit: currentCommit.substring(0, 7),
      commitCount,
      lastCommitDate,
      lastCommitMessage,
      author,
      totalBranches,
    };
  } catch (error) {
    logger.error({ err: error, path: projectPath }, 'Failed to analyze git repository');
    return createEmptyGitInfo();
  }
}

export {
  analyzeGit,
};
