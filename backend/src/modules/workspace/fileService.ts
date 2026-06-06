import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '../../utils/logger'

export class FileService {
  private workspacePath: string | null = null

  setWorkspace(path: string) {
    this.workspacePath = path
    logger.info(`Workspace set: ${path}`)
  }

  getWorkspace() {
    return this.workspacePath
  }

  // 安全检查：确保路径在工作区内
  private validatePath(filePath: string): string {
    if (!this.workspacePath) {
      throw new Error('No workspace open')
    }

    const resolvedPath = path.resolve(this.workspacePath, filePath)
    if (!resolvedPath.startsWith(this.workspacePath)) {
      throw new Error('Access denied: Path outside workspace')
    }

    return resolvedPath
  }

  async readFile(filePath: string): Promise<string> {
    const safePath = this.validatePath(filePath)
    logger.info(`Reading file: ${safePath}`)
    return await fs.readFile(safePath, 'utf-8')
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const safePath = this.validatePath(filePath)
    logger.info(`Writing file: ${safePath}`)

    // 确保目录存在
    const dirPath = path.dirname(safePath)
    await fs.mkdir(dirPath, { recursive: true })

    await fs.writeFile(safePath, content, 'utf-8')
  }

  async deleteFile(filePath: string): Promise<void> {
    const safePath = this.validatePath(filePath)
    logger.info(`Deleting file: ${safePath}`)
    await fs.unlink(safePath)
  }

  async createDirectory(dirPath: string): Promise<void> {
    const safePath = this.validatePath(dirPath)
    logger.info(`Creating directory: ${safePath}`)
    await fs.mkdir(safePath, { recursive: true })
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    const safePath = this.validatePath(dirPath)
    logger.info(`Deleting directory: ${safePath}`)
    await fs.rm(safePath, { recursive: true, force: true })
  }

  async listDirectory(dirPath: string): Promise<Array<{
    name: string
    path: string
    isDirectory: boolean
    size: number
    modified: Date
  }>> {
    const safePath = this.validatePath(dirPath)
    const entries = await fs.readdir(safePath, { withFileTypes: true })

    const result = []
    for (const entry of entries) {
      const fullPath = path.join(safePath, entry.name)
      const stats = await fs.stat(fullPath)

      result.push({
        name: entry.name,
        path: path.relative(this.workspacePath!, fullPath),
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      })
    }

    return result
  }
}

export const fileService = new FileService()
