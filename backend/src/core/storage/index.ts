import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';

/**
 * FlowMind 文件存储系统
 * 所有数据持久化到应用安装目录下的 data/ 文件夹
 * 避免存储到 C 盘用户目录，适合 Windows 桌面应用部署
 */

const APP_ROOT = process.cwd();
const DATA_DIR = path.join(APP_ROOT, 'data');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info({ dir }, 'Created storage directory');
  }
}

// 初始化存储目录
ensureDir(DATA_DIR);

export interface StorageOptions {
  pretty?: boolean;
  encoding?: BufferEncoding;
}

class Storage {
  private baseDir: string;

  constructor(baseDir: string = DATA_DIR) {
    this.baseDir = baseDir;
    ensureDir(this.baseDir);
  }

  /**
   * 获取存储目录路径
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * 获取模块专用存储目录
   */
  getModuleDir(moduleName: string): string {
    const dir = path.join(this.baseDir, moduleName);
    ensureDir(dir);
    return dir;
  }

  /**
   * 获取文件完整路径
   */
  resolvePath(moduleName: string, filename: string): string {
    const dir = this.getModuleDir(moduleName);
    return path.join(dir, filename);
  }

  /**
   * 写入 JSON 数据
   */
  writeJson<T>(moduleName: string, filename: string, data: T, options: StorageOptions = {}): void {
    const filePath = this.resolvePath(moduleName, filename);
    const json = options.pretty !== false
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);

    try {
      fs.writeFileSync(filePath, json, options.encoding || 'utf-8');
      logger.debug({ module: moduleName, file: filename }, 'Data saved');
    } catch (error) {
      logger.error({ module: moduleName, file: filename, error }, 'Failed to save data');
      throw error;
    }
  }

  /**
   * 读取 JSON 数据
   */
  readJson<T>(moduleName: string, filename: string, defaultValue?: T): T | undefined {
    const filePath = this.resolvePath(moduleName, filename);

    try {
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      logger.error({ module: moduleName, file: filename, error }, 'Failed to read data');
      return defaultValue;
    }
  }

  /**
   * 删除文件
   */
  delete(moduleName: string, filename: string): boolean {
    const filePath = this.resolvePath(moduleName, filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug({ module: moduleName, file: filename }, 'Data deleted');
        return true;
      }
      return false;
    } catch (error) {
      logger.error({ module: moduleName, file: filename, error }, 'Failed to delete data');
      return false;
    }
  }

  /**
   * 检查文件是否存在
   */
  exists(moduleName: string, filename: string): boolean {
    const filePath = this.resolvePath(moduleName, filename);
    return fs.existsSync(filePath);
  }

  /**
   * 列出模块下的所有文件
   */
  listFiles(moduleName: string): string[] {
    const dir = this.getModuleDir(moduleName);

    try {
      return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    } catch (error) {
      logger.error({ module: moduleName, error }, 'Failed to list files');
      return [];
    }
  }

  /**
   * 追加写入（用于日志类数据）
   */
  append(moduleName: string, filename: string, data: string): void {
    const filePath = this.resolvePath(moduleName, filename);

    try {
      fs.appendFileSync(filePath, data + '\n', 'utf-8');
    } catch (error) {
      logger.error({ module: moduleName, file: filename, error }, 'Failed to append data');
      throw error;
    }
  }

  /**
   * 读取原始文本
   */
  readText(moduleName: string, filename: string, defaultValue?: string): string | undefined {
    const filePath = this.resolvePath(moduleName, filename);

    try {
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      logger.error({ module: moduleName, file: filename, error }, 'Failed to read text');
      return defaultValue;
    }
  }

  /**
   * 写入原始文本
   */
  writeText(moduleName: string, filename: string, content: string): void {
    const filePath = this.resolvePath(moduleName, filename);

    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      logger.debug({ module: moduleName, file: filename }, 'Text saved');
    } catch (error) {
      logger.error({ module: moduleName, file: filename, error }, 'Failed to save text');
      throw error;
    }
  }
}

export const storage = new Storage();

/**
 * 为指定模块创建存储访问器
 */
export function createModuleStorage(moduleName: string) {
  return {
    writeJson: <T>(filename: string, data: T, options?: StorageOptions) =>
      storage.writeJson(moduleName, filename, data, options),
    readJson: <T>(filename: string, defaultValue?: T) =>
      storage.readJson<T>(moduleName, filename, defaultValue),
    delete: (filename: string) => storage.delete(moduleName, filename),
    exists: (filename: string) => storage.exists(moduleName, filename),
    listFiles: () => storage.listFiles(moduleName),
    append: (filename: string, data: string) => storage.append(moduleName, filename, data),
    readText: (filename: string, defaultValue?: string) => storage.readText(moduleName, filename, defaultValue),
    writeText: (filename: string, content: string) => storage.writeText(moduleName, filename, content),
    resolvePath: (filename: string) => storage.resolvePath(moduleName, filename),
  };
}
