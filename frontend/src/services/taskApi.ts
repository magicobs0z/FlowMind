import api from './api'

export interface TaskData {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result?: unknown
  error?: string
  logs: Array<{
    timestamp: string
    type: 'info' | 'tool' | 'result' | 'error'
    message: string
  }>
  sessionId?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateTaskRequest {
  description: string
  priority?: 'low' | 'medium' | 'high'
  assignedTo?: string
}

export interface CreateTaskResponse {
  success: boolean
  data?: TaskData
  error?: string
}

export interface GetTaskResponse {
  success: boolean
  data?: TaskData
  error?: string
}

export interface CancelTaskResponse {
  success: boolean
  message?: string
  error?: string
}

export interface ExecuteTaskResponse {
  success: boolean
  data?: TaskData
  error?: string
}

export type TaskEventCallback = (event: TaskEvent) => void

export interface TaskEvent {
  type: 'status' | 'log' | 'result' | 'error' | 'complete'
  taskId: string
  data?: unknown
  log?: TaskData['logs'][0]
  timestamp: string
}

/**
 * 创建任务
 */
export async function createTask(
  sessionId: string,
  request: CreateTaskRequest
): Promise<CreateTaskResponse> {
  const response = await api.post(`/agents/sessions/${sessionId}/tasks`, request)
  return response as CreateTaskResponse
}

/**
 * 执行任务
 */
export async function executeTask(
  sessionId: string,
  taskId: string,
  llmConfig?: { apiKey: string; baseUrl: string; modelName: string }
): Promise<ExecuteTaskResponse> {
  const response = await api.post(`/agents/sessions/${sessionId}/tasks/${taskId}/execute`, {
    llmConfig,
  })
  return response as ExecuteTaskResponse
}

/**
 * 获取任务状态
 */
export async function getTask(taskId: string): Promise<GetTaskResponse> {
  const response = await api.get(`/tasks/${taskId}`)
  return response as GetTaskResponse
}

/**
 * 取消任务
 */
export async function cancelTask(taskId: string): Promise<CancelTaskResponse> {
  const response = await api.post(`/tasks/${taskId}/cancel`)
  return response as CancelTaskResponse
}

/**
 * 订阅任务 SSE 实时事件
 * @returns 一个 cleanup 函数，用于关闭连接
 */
export function subscribeToEvents(
  taskId: string,
  onEvent: TaskEventCallback,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`/api/v1/tasks/${taskId}/events`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as TaskEvent
      onEvent(data)
    } catch (e) {
      console.error('Failed to parse SSE event:', e)
    }
  }

  eventSource.onerror = () => {
    console.error('SSE connection error')
    onError?.(new Error('SSE connection failed'))
    eventSource.close()
  }

  return () => {
    eventSource.close()
  }
}

/**
 * 轮询任务状态
 * @returns 一个 cleanup 函数，用于停止轮询
 */
export function pollTaskStatus(
  taskId: string,
  onUpdate: (task: TaskData) => void,
  intervalMs = 2000
): () => void {
  let isRunning = true
  let timeoutId: ReturnType<typeof setTimeout>

  const poll = async () => {
    if (!isRunning) return

    try {
      const response = await getTask(taskId)
      if (response.success && response.data) {
        onUpdate(response.data)

        // 如果任务已结束，停止轮询
        if (
          response.data.status === 'completed' ||
          response.data.status === 'failed' ||
          response.data.status === 'cancelled'
        ) {
          isRunning = false
          return
        }
      }
    } catch (_err) {
      console.error('Poll task status error:', _err)
    }

    if (isRunning) {
      timeoutId = setTimeout(poll, intervalMs)
    }
  }

  poll()

  return () => {
    isRunning = false
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * 综合监听任务：优先 SSE，降级到轮询
 * @returns 一个 cleanup 函数
 */
export function watchTask(
  taskId: string,
  onUpdate: (task: TaskData) => void,
  onEvent?: TaskEventCallback,
  onError?: (error: Error) => void
): () => void {
  let cleanup: (() => void) | null = null

  // 先尝试 SSE
  try {
    const sseCleanup = subscribeToEvents(
      taskId,
      (event) => {
        if (event.type === 'status' || event.type === 'result' || event.type === 'complete') {
          // SSE 收到状态更新时，也拉取完整任务数据
          getTask(taskId)
            .then((response) => {
              if (response.success && response.data) {
                onUpdate(response.data)
              }
            })
            .catch((err) => onError?.(err))
        }
        onEvent?.(event)
      },
      () => {
        // SSE 失败，降级到轮询
        cleanup = pollTaskStatus(taskId, onUpdate)
      }
    )

    cleanup = sseCleanup
  } catch {
    // SSE 不支持，降级到轮询
    cleanup = pollTaskStatus(taskId, onUpdate)
  }

  return () => {
    cleanup?.()
  }
}
