import { AgentPrompt } from './types'
import {
  leadPrompt,
  subLeadPrompt,
  coderPrompt,
  testerPrompt,
  reviewerPrompt,
  explorerPrompt
} from './index'
import { logger } from '../../../utils/logger'

class PromptManager {
  private systemPrompts: Map<string, AgentPrompt> = new Map()
  private customPrompts: Map<string, AgentPrompt> = new Map()

  constructor() {
    this.initializeSystemPrompts()
  }

  private initializeSystemPrompts() {
    const systemPrompts: AgentPrompt[] = [
      {
        id: 'system_lead',
        agentType: 'lead',
        content: leadPrompt,
        version: '1.0.0',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'system_sub_lead',
        agentType: 'sub_lead',
        content: subLeadPrompt,
        version: '1.0.0',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'system_coder',
        agentType: 'coder',
        content: coderPrompt,
        version: '1.0.0',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'system_tester',
        agentType: 'tester',
        content: testerPrompt,
        version: '1.0.0',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'system_reviewer',
        agentType: 'reviewer',
        content: reviewerPrompt,
        version: '1.0.0',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'system_explorer',
        agentType: 'explorer',
        content: explorerPrompt,
        version: '1.0.0',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    systemPrompts.forEach(prompt => {
      this.systemPrompts.set(prompt.id, prompt)
    })

    logger.info('System prompts initialized')
  }

  // 获取系统提示词
  getSystemPrompt(agentType: string): AgentPrompt | undefined {
    const prompt = Array.from(this.systemPrompts.values()).find(
      p => p.agentType === agentType
    )
    return prompt
  }

  // 获取所有系统提示词
  listSystemPrompts(): AgentPrompt[] {
    return Array.from(this.systemPrompts.values())
  }

  // 创建自定义提示词
  createCustomPrompt(
    agentId: string,
    agentType: string,
    content: string
  ): AgentPrompt {
    const prompt: AgentPrompt = {
      id: `custom_${agentId}`,
      agentType: agentType as any,
      content,
      version: '1.0.0',
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.customPrompts.set(prompt.id, prompt)
    logger.info({ agentId }, 'Custom prompt created')
    return prompt
  }

  // 获取自定义提示词
  getCustomPrompt(agentId: string): AgentPrompt | undefined {
    return this.customPrompts.get(`custom_${agentId}`)
  }

  // 更新自定义提示词
  updateCustomPrompt(agentId: string, content: string): AgentPrompt | null {
    const id = `custom_${agentId}`
    const prompt = this.customPrompts.get(id)

    if (!prompt) {
      logger.warn({ agentId }, 'Custom prompt not found')
      return null
    }

    const updatedPrompt: AgentPrompt = {
      ...prompt,
      content,
      version: this.incrementVersion(prompt.version),
      updatedAt: new Date()
    }

    this.customPrompts.set(id, updatedPrompt)
    logger.info({ agentId }, 'Custom prompt updated')
    return updatedPrompt
  }

  // 删除自定义提示词
  deleteCustomPrompt(agentId: string): boolean {
    const id = `custom_${agentId}`
    const deleted = this.customPrompts.delete(id)
    if (deleted) {
      logger.info({ agentId }, 'Custom prompt deleted')
    }
    return deleted
  }

  // 获取智能体提示词（优先自定义，否则系统）
  getAgentPrompt(agentId: string, agentType: string): string {
    const customPrompt = this.getCustomPrompt(agentId)
    if (customPrompt) {
      return customPrompt.content
    }

    const systemPrompt = this.getSystemPrompt(agentType)
    if (systemPrompt) {
      return systemPrompt.content
    }

    logger.warn({ agentId, agentType }, 'No prompt found, using default')
    return this.getDefaultPrompt(agentType)
  }

  private getDefaultPrompt(agentType: string): string {
    return `你是一个 ${agentType} 智能体，负责协助完成相关任务。`
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.')
    const patch = parseInt(parts[2] || '0') + 1
    return `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`
  }
}

export const promptManager = new PromptManager()
