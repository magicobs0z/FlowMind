import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../../utils/logger';
import type { ModuleInfo } from './types';

interface PackageJson {
  name?: string;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const MODULE_DIR_PATTERNS = [
  'src',
  'lib',
  'packages',
  'apps',
  'modules',
  'features',
  'components',
  'services',
  'api',
  'routes',
  'controllers',
  'models',
  'utils',
  'helpers',
  'shared',
  'common',
  'core',
];

function detectModuleType(dirName: string): ModuleInfo['type'] {
  const lowerName = dirName.toLowerCase();

  if (lowerName.includes('feature')) {
    return 'feature';
  }
  if (lowerName.includes('component')) {
    return 'component';
  }
  if (lowerName.includes('package')) {
    return 'package';
  }
  if (lowerName.includes('lib')) {
    return 'library';
  }

  return 'module';
}

async function parseDependencies(projectPath: string): Promise<Record<string, string>> {
  const packageJsonPath = join(projectPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(content);

    return {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to parse package.json dependencies');
    return {};
  }
}

async function analyzeModules(projectPath: string): Promise<ModuleInfo[]> {
  const modules: ModuleInfo[] = [];
  const { readdir } = await import('fs/promises');

  async function scanForModules(dirPath: string, depth: number = 0): Promise<void> {
    if (depth > 3) {
      return;
    }

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === 'coverage' ||
          entry.name === '.next'
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          const entryPath = join(dirPath, entry.name);
          const isModuleDir = MODULE_DIR_PATTERNS.includes(entry.name.toLowerCase());

          if (isModuleDir || depth > 0) {
            const subEntries = await readdir(entryPath, { withFileTypes: true });
            const files: string[] = [];

            for (const subEntry of subEntries) {
              if (subEntry.isDirectory()) {
                const subDirPackageJson = join(entryPath, subEntry.name, 'package.json');
                if (existsSync(subDirPackageJson)) {
                  modules.push({
                    name: subEntry.name,
                    path: join(entryPath, subEntry.name),
                    type: 'package',
                    files: [],
                  });
                }
              } else {
                files.push(join(entryPath, subEntry.name));
              }
            }

            if (files.length > 0 || isModuleDir) {
              const existingModule = modules.find((m) => m.path === entryPath);
              if (!existingModule) {
                modules.push({
                  name: entry.name,
                  path: entryPath,
                  type: detectModuleType(entry.name),
                  files,
                });
              }
            }
          }

          await scanForModules(entryPath, depth + 1);
        }
      }
    } catch (error) {
      logger.error({ err: error, path: dirPath }, 'Failed to scan for modules');
    }
  }

  await scanForModules(projectPath);

  if (modules.length === 0) {
    try {
      const entries = await readdir(projectPath, { withFileTypes: true });
      const srcPath = join(projectPath, 'src');

      if (existsSync(srcPath)) {
        const srcEntries = await readdir(srcPath, { withFileTypes: true });
        const files: string[] = [];

        for (const entry of srcEntries) {
          files.push(join(srcPath, entry.name));
        }

        modules.push({
          name: 'src',
          path: srcPath,
          type: 'module',
          files,
        });
      } else {
        const files: string[] = [];
        for (const entry of entries) {
          if (entry.isFile()) {
            files.push(join(projectPath, entry.name));
          }
        }

        if (files.length > 0) {
          modules.push({
            name: 'root',
            path: projectPath,
            type: 'module',
            files,
          });
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to analyze root module');
    }
  }

  return modules;
}

export {
  parseDependencies,
  analyzeModules,
};
