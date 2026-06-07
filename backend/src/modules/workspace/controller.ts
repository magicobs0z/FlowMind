import { Request, Response } from 'express'
import { generateProjectSummary } from './index'
import { HTTP_STATUS, ERROR_CODES } from '../../constants'
import { logger } from '../../utils/logger'
import { fileService } from './fileService'
import * as fs from 'fs'
import * as path from 'path'

const workspaceCache = new Map<string, any>()
export { workspaceCache }

const openWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: projectPath } = req.body

    if (!projectPath || typeof projectPath !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.WORKSPACE_INVALID,
        message: 'Project path is required',
      })
      return
    }

    logger.info({ path: projectPath }, 'Opening workspace')

    // 初始化 .flowmind 目录
    const flowmindDir = path.join(projectPath, '.flowmind')
    if (!fs.existsSync(flowmindDir)) {
      logger.info({ dir: flowmindDir }, 'Creating .flowmind directory')
      fs.mkdirSync(flowmindDir, { recursive: true })
      
      // 可以在这里创建默认配置文件
      const configPath = path.join(flowmindDir, 'config.json')
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({
          version: '1.0',
          created: new Date().toISOString(),
        }, null, 2))
      }
    }

    const summary = await generateProjectSummary(projectPath)
    workspaceCache.set(summary.id, summary)
    fileService.setWorkspace(projectPath)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to open workspace')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to open workspace',
    })
  }
}

const getWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string

    const workspace = workspaceCache.get(id)

    if (!workspace) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.WORKSPACE_NOT_FOUND,
        message: 'Workspace not found',
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: workspace,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get workspace')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to get workspace',
    })
  }
}

const rescanWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string

    const existingWorkspace = workspaceCache.get(id)

    if (!existingWorkspace) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.WORKSPACE_NOT_FOUND,
        message: 'Workspace not found',
      })
      return
    }

    logger.info({ id, path: existingWorkspace.path }, 'Re-scanning workspace')

    const summary = await generateProjectSummary(existingWorkspace.path)
    workspaceCache.set(id, summary)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to re-scan workspace')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to re-scan workspace',
    })
  }
}

const readFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath } = req.body
    const content = await fileService.readFile(filePath)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { path: filePath, content },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to read file')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: (error as Error).message || 'Failed to read file',
    })
  }
}

const writeFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath, content } = req.body
    await fileService.writeFile(filePath, content)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { path: filePath },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to write file')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: (error as Error).message || 'Failed to write file',
    })
  }
}

const deleteFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath } = req.body
    await fileService.deleteFile(filePath)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { path: filePath },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete file')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: (error as Error).message || 'Failed to delete file',
    })
  }
}

const listDirectory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: dirPath = '.' } = req.body
    const files = await fileService.listDirectory(dirPath)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: files,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to list directory')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: (error as Error).message || 'Failed to list directory',
    })
  }
}

export {
  openWorkspace,
  getWorkspace,
  rescanWorkspace,
  readFile,
  writeFile,
  deleteFile,
  listDirectory,
}
