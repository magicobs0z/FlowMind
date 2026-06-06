import { useAgentStore } from '../store'
import {
  createTask,
  executeTask as executeTaskApi,
  cancelTask,
  watchTask,
  type TaskData,
} from './taskApi'

export interface AgentTask {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: unknown
  error?: string
  logs: Array<{
    timestamp: string
    type: 'info' | 'tool' | 'result' | 'error'
    message: string
  }>
}

export interface AgentExecutionContext {
  workspaceRoot?: string
  model?: string
  llmConfig?: {
    apiKey: string
    baseUrl: string
    modelName: string
  }
  sessionId?: string
}

export class AgentExecutor {
  private isRunning = false
  private shouldStop = false
  private currentTaskId: string | null = null
  private currentSessionId: string | null = null
  private cleanupWatch: (() => void) | null = null

  async executeTask(
    task: AgentTask,
    context: AgentExecutionContext,
    onProgress?: (log: AgentTask['logs'][0]) => void
  ): Promise<void> {
    if (this.isRunning) {
      task.status = 'failed'
      task.error = 'Another task is already running'
      return
    }

    this.isRunning = true
    this.shouldStop = false
    task.status = 'running'

    const log = (type: AgentTask['logs'][0]['type'], message: string) => {
      const entry = {
        timestamp: new Date().toISOString(),
        type,
        message,
      }
      task.logs.push(entry)
      onProgress?.(entry)
    }

    try {
      log('info', `开始执行任务: ${task.description}`)

      // 1. 确保有 sessionId
      const sessionId = context.sessionId || (await this.ensureSession())
      this.currentSessionId = sessionId

      // 2. 调用后端创建任务
      log('info', '创建后端任务...')
      const createResult = await createTask(sessionId, {
        description: task.description,
        priority: 'medium',
      })

      if (!createResult.success || !createResult.data) {
        task.status = 'failed'
        task.error = createResult.error || '创建任务失败'
        log('error', task.error)
        return
      }

      const backendTask = createResult.data
      this.currentTaskId = backendTask.id

      // 同步后端任务状态到前端任务
      task.id = backendTask.id
      log('info', `任务已创建: ${backendTask.id}`)

      // 3. 启动任务监听（SSE 优先，降级轮询）
      log('info', '连接任务实时更新...')
      this.cleanupWatch = watchTask(
        backendTask.id,
        (updatedTask) => {
          // 同步后端状态到前端
          this.syncTaskState(task, updatedTask)

          // 同步新日志
          if (updatedTask.logs && updatedTask.logs.length > task.logs.length) {
            const newLogs = updatedTask.logs.slice(task.logs.length)
            for (const entry of newLogs) {
              task.logs.push(entry)
              onProgress?.(entry)
            }
          }
        },
        (event) => {
          // SSE 事件回调
          if (event.type === 'log' && event.log) {
            task.logs.push(event.log)
            onProgress?.(event.log)
          } else if (event.type === 'error') {
            const msg = typeof event.data === 'object' && event.data !== null
              ? (event.data as Record<string, unknown>).message
              : undefined
            log('error', typeof msg === 'string' ? msg : '任务执行出错')
          }
        },
        (error) => {
          log('error', `实时连接出错: ${error.message}，已降级到轮询`)
        }
      )

      // 4. 调用后端执行任务
      log('info', '开始执行...')
      const executeResult = await executeTaskApi(sessionId, backendTask.id, context.llmConfig)

      if (!executeResult.success) {
        task.status = 'failed'
        task.error = executeResult.error || '执行任务失败'
        log('error', task.error)
        return
      }

      // 5. 等待任务完成（watchTask 已经在后台更新状态）
      await this.waitForCompletion(backendTask.id, task)

      if (this.shouldStop) {
        log('info', '任务被用户中止')
        task.status = 'failed'
        task.error = '任务被用户中止'
      }
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : 'Unknown error'
      log('error', `执行错误: ${task.error}`)
    } finally {
      this.isRunning = false
      if (this.cleanupWatch) {
        this.cleanupWatch()
        this.cleanupWatch = null
      }
    }
  }

  stop(): void {
    this.shouldStop = true
    if (this.currentTaskId) {
      cancelTask(this.currentTaskId).catch((err) => {
        console.error('取消任务失败:', err)
      })
    }
  }

  private async ensureSession(): Promise<string> {
    // 如果没有提供 sessionId，创建一个默认会话
    const { agentApi } = await import('./api')
    const result = await agentApi.createSession('默认会话', '', [])
    if (!result.success || !result.data?.id) {
      throw new Error('无法创建会话')
    }
    return result.data.id
  }

  private syncTaskState(agentTask: AgentTask, backendTask: TaskData): void {
    // 将后端状态映射到前端状态
    const statusMap: Record<string, AgentTask['status']> = {
      pending: 'pending',
      running: 'running',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'failed',
    }
    agentTask.status = statusMap[backendTask.status] || backendTask.status as AgentTask['status']
    agentTask.result = backendTask.result
    agentTask.error = backendTask.error
  }

  private async waitForCompletion(_taskId: string, task: AgentTask): Promise<void> {
    const maxWaitMs = 30 * 60 * 1000 // 最大等待 30 分钟
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      if (this.shouldStop) {
        break
      }

      if (task.status === 'completed' || task.status === 'failed') {
        break
      }

      // 每 1 秒检查一次本地状态
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

export const agentExecutor = new AgentExecutor()

export async function executeAgentTask(
  description: string,
  context: AgentExecutionContext,
  onProgress?: (log: AgentTask['logs'][0]) => void
): Promise<AgentTask> {
  const task: AgentTask = {
    id: `task_${Date.now()}`,
    description,
    status: 'pending',
    logs: [],
  }

  const agentStore = useAgentStore.getState()
  agentStore.addTask(task)

  agentExecutor.executeTask(task, context, onProgress)

  return task
}
