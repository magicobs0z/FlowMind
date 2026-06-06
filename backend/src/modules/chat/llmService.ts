import axios from 'axios'
import { logger } from '../../utils/logger'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  modelName: string
}

export async function callLLM(
  messages: Message[],
  config: LLMConfig,
  streamCallback?: (chunk: string) => void
): Promise<string> {
  logger.info(`Calling LLM: ${config.modelName}`, { baseUrl: config.baseUrl })

  try {
    // 确保 baseUrl 格式正确
    let baseUrl = config.baseUrl.trim()
    // 移除末尾斜杠
    baseUrl = baseUrl.replace(/\/$/, '')

    if (streamCallback) {
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: config.modelName,
          messages,
          stream: true,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      )

      let fullResponse = ''

      await new Promise<void>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6)
              if (dataStr === '[DONE]') break

              try {
                const data = JSON.parse(dataStr)
                const delta = data.choices[0]?.delta?.content
                if (delta) {
                  fullResponse += delta
                  streamCallback(delta)
                }
              } catch (e) {
                logger.debug('Parse stream data error', e)
              }
            }
          }
        })

        response.data.on('end', () => resolve())
        response.data.on('error', reject)
      })

      return fullResponse
    } else {
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: config.modelName,
          messages,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const content = response.data.choices[0]?.message?.content || ''
      logger.info('LLM call completed')
      return content
    }
  } catch (error) {
    logger.error('LLM call failed', error)
    throw error
  }
}

// Tool calling types
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface Tool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

export async function callLLMWithTools(
  messages: Message[],
  config: LLMConfig,
  tools: Tool[]
): Promise<{ content: string; toolCalls?: ToolCall[] }> {
  logger.info(`Calling LLM with tools: ${config.modelName}`, { tools })

  try {
    let baseUrl = config.baseUrl.trim()
    baseUrl = baseUrl.replace(/\/$/, '')

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: config.modelName,
        messages,
        tools,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const choice = response.data.choices[0]
    const message = choice.message

    return {
      content: message.content || '',
      toolCalls: message.tool_calls
    }
  } catch (error) {
    logger.error('LLM with tools call failed', error)
    throw error
  }
}
