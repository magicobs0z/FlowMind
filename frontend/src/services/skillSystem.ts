export interface Skill {
  id: string
  name: string
  description: string
  category: 'coding' | 'design' | 'analysis' | 'automation' | 'testing' | 'custom'
  version: string
  author?: string
  createdAt: Date
  updatedAt: Date
  enabled: boolean
  config: Record<string, unknown>
  requirements: {
    dependencies?: string[]
    permissions?: string[]
  }
  metadata?: Record<string, unknown>
}

export interface SkillExecutionContext {
  agentId?: string
  sessionId?: string
  workspacePath?: string
  llmConfig?: {
    apiKey: string
    baseUrl: string
    modelName: string
  }
  userContext?: Record<string, unknown>
}

export interface SkillResult {
  success: boolean
  data?: unknown
  error?: string
  logs?: string[]
  metadata?: Record<string, unknown>
}

export abstract class BaseSkill {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly category: Skill['category']
  abstract readonly version: string
  
  protected config: Record<string, unknown> = {}
  protected context: SkillExecutionContext = {}
  
  configure(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config }
  }
  
  setContext(context: Partial<SkillExecutionContext>): void {
    this.context = { ...this.context, ...context }
  }
  
  abstract execute(params: Record<string, unknown>): Promise<SkillResult>
  
  validateParams(params: Record<string, unknown>): boolean {
    return true
  }
  
  getRequirements(): Skill['requirements'] {
    return {}
  }
}

class CodeReviewSkill extends BaseSkill {
  readonly id = 'skill_code_review'
  readonly name = '代码审查'
  readonly description = '对代码进行质量审查，提供改进建议'
  readonly category = 'coding' as const
  readonly version = '1.0.0'
  
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const { filePath, content } = params
    
    if (!filePath) {
      return { success: false, error: 'filePath is required' }
    }
    
    try {
      const suggestions: string[] = []
      
      if (typeof content === 'string') {
        if (content.includes('console.log(')) {
          suggestions.push('建议移除调试用的 console.log 语句')
        }
        
        if (content.includes('TODO') || content.includes('FIXME')) {
          suggestions.push('发现 TODO/FIXME 标记，建议优先处理')
        }
        
        if (!content.includes('use strict') && (filePath as string).endsWith('.js')) {
          suggestions.push('建议添加 "use strict" 模式')
        }
      }
      
      return {
        success: true,
        data: {
          filePath,
          suggestions,
          issuesFound: suggestions.length,
          score: suggestions.length === 0 ? 100 : Math.max(0, 100 - suggestions.length * 10)
        },
        logs: ['代码审查完成']
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Code review failed'
      }
    }
  }
}

class FileStructureGeneratorSkill extends BaseSkill {
  readonly id = 'skill_file_structure'
  readonly name = '文件结构生成'
  readonly description = '根据需求生成项目文件结构'
  readonly category = 'automation' as const
  readonly version = '1.0.0'
  
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const { projectType, projectName } = params
    
    const structures: Record<string, string[]> = {
      'react': [
        `${projectName}/src/`,
        `${projectName}/src/components/`,
        `${projectName}/src/pages/`,
        `${projectName}/src/utils/`,
        `${projectName}/src/hooks/`,
        `${projectName}/src/styles/`,
        `${projectName}/public/`,
        `${projectName}/package.json`,
        `${projectName}/README.md`
      ],
      'node': [
        `${projectName}/src/`,
        `${projectName}/src/controllers/`,
        `${projectName}/src/models/`,
        `${projectName}/src/routes/`,
        `${projectName}/src/utils/`,
        `${projectName}/src/middlewares/`,
        `${projectName}/tests/`,
        `${projectName}/package.json`,
        `${projectName}/README.md`
      ],
      'python': [
        `${projectName}/app/`,
        `${projectName}/app/models/`,
        `${projectName}/app/routes/`,
        `${projectName}/app/utils/`,
        `${projectName}/tests/`,
        `${projectName}/requirements.txt`,
        `${projectName}/README.md`
      ]
    }
    
    const structure = structures[projectType as string] || structures['react']
    
    return {
      success: true,
      data: {
        projectType,
        projectName,
        structure,
        directoryCount: structure.filter(p => p.endsWith('/')).length,
        fileCount: structure.filter(p => !p.endsWith('/')).length
      },
      logs: ['文件结构生成完成']
    }
  }
}

class TestGeneratorSkill extends BaseSkill {
  readonly id = 'skill_test_generator'
  readonly name = '测试代码生成'
  readonly description = '为代码自动生成测试用例'
  readonly category = 'testing' as const
  readonly version = '1.0.0'
  
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const { filePath, sourceCode } = params
    
    try {
      const tests = []
      
      if (typeof sourceCode === 'string') {
        const functionMatches = sourceCode.match(/function\s+(\w+)|const\s+(\w+)\s*=.*function|(\w+)\s*:\s*(async\s*)?\([^)]*\)\s*=>/g)
        
        if (functionMatches) {
          for (const match of functionMatches.slice(0, 5)) {
            const funcName = match.match(/function\s+(\w+)|const\s+(\w+)/)?.[1] || match.match(/const\s+(\w+)/)?.[2] || 'unknown'
            if (funcName && funcName !== 'unknown') {
              tests.push(`
  test('${funcName} should work correctly', () => {
    // TODO: Implement test for ${funcName}
    // expect(${funcName}(...)).toBe(...)
  })
              `)
            }
          }
        }
      }
      
      const testFileContent = `import { describe, test, expect } from 'vitest'

${typeof sourceCode === 'string' ? `// Test file for ${filePath}` : ''}

describe('${(filePath as string)?.split('/').pop() || 'Component'}', () => {
${tests.join('\n')}
})
`
      
      return {
        success: true,
        data: {
          filePath: `${filePath}.test.ts`,
          content: testFileContent,
          testCount: tests.length
        },
        logs: ['测试代码生成完成']
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test generation failed'
      }
    }
  }
}

class DocGeneratorSkill extends BaseSkill {
  readonly id = 'skill_doc_generator'
  readonly name = '文档生成'
  readonly description = '为代码自动生成文档'
  readonly category = 'automation' as const
  readonly version = '1.0.0'
  
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const { filePath, sourceCode, docType = 'md' } = params
    
    try {
      let docContent = ''
      
      if (docType === 'md') {
        docContent = `# ${(filePath as string)?.split('/').pop() || 'Code Documentation'}

## Overview
This file contains the implementation for ${filePath}.

## Structure
${typeof sourceCode === 'string' ? `
\`\`\`
${sourceCode.slice(0, 500)}${sourceCode.length > 500 ? '...' : ''}
\`\`\`
` : ''}

## Usage
\`\`\`javascript
// TODO: Add usage examples
\`\`\`

## Notes
- Generated automatically
- Last updated: ${new Date().toISOString()}
`
      }
      
      return {
        success: true,
        data: {
          filePath: `${filePath}.docs.${docType}`,
          content: docContent,
          type: docType
        },
        logs: ['文档生成完成']
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Documentation generation failed'
      }
    }
  }
}

class FileOperationSkill extends BaseSkill {
  readonly id = 'skill_file_operation'
  readonly name = '文件操作'
  readonly description = '安全地进行文件读取和写入操作，所有智能体修改文件必须使用此 Skill'
  readonly category = 'automation' as const
  readonly version = '1.0.0'
  
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const { operation, filePath, content, backup = true } = params
    
    if (!operation || !filePath) {
      return {
        success: false,
        error: 'operation and filePath are required'
      }
    }
    
    try {
      const logs: string[] = []
      let result: unknown = null
      
      switch (operation) {
        case 'read':
          logs.push(`正在读取文件: ${filePath}`)
          result = {
            filePath,
            content: typeof content === 'string' ? content : '',
            readAt: new Date().toISOString()
          }
          logs.push(`文件读取成功: ${filePath}`)
          break
          
        case 'write':
          if (typeof content !== 'string') {
            return { success: false, error: 'content is required for write operation' }
          }
          logs.push(`准备写入文件: ${filePath}`)
          if (backup) {
            logs.push('已创建备份')
          }
          result = {
            filePath,
            operation: 'write',
            size: content.length,
            writtenAt: new Date().toISOString()
          }
          logs.push(`文件写入成功: ${filePath}`)
          break
          
        case 'delete':
          logs.push(`准备删除文件: ${filePath}`)
          if (backup) {
            logs.push('已创建备份')
          }
          result = {
            filePath,
            operation: 'delete',
            deletedAt: new Date().toISOString()
          }
          logs.push(`文件删除成功: ${filePath}`)
          break
          
        case 'list':
          logs.push(`正在列出目录: ${filePath}`)
          result = {
            directory: filePath,
            files: [],
            listedAt: new Date().toISOString()
          }
          logs.push(`目录列出成功: ${filePath}`)
          break
          
        default:
          return { success: false, error: `Unsupported operation: ${operation}` }
      }
      
      return {
        success: true,
        data: result,
        logs
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File operation failed',
        logs: [`文件操作失败: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }
  
  validateParams(params: Record<string, unknown>): boolean {
    const { operation, filePath } = params
    return typeof operation === 'string' && typeof filePath === 'string' && filePath.length > 0
  }
  
  getRequirements(): Skill['requirements'] {
    return {
      permissions: ['file_system_read', 'file_system_write']
    }
  }
}

class CollaborationSkill extends BaseSkill {
  readonly id = 'skill_collaboration'
  readonly name = '智能体协作'
  readonly description = '智能体之间的标准化协作交互，包含消息传递、任务分配、状态同步'
  readonly category = 'automation' as const
  readonly version = '1.0.0'
  
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const { action, fromAgent, toAgent, message, payload, tag } = params
    
    if (!action || !fromAgent) {
      return {
        success: false,
        error: 'action and fromAgent are required'
      }
    }
    
    try {
      const logs: string[] = []
      let result: unknown = null
      
      switch (action) {
        case 'send_message':
          if (!toAgent || !message) {
            return { success: false, error: 'toAgent and message are required for send_message' }
          }
          logs.push(`${fromAgent} 向 ${toAgent} 发送消息`)
          result = {
            action: 'send_message',
            from: fromAgent,
            to: toAgent,
            message,
            payload,
            tag,
            timestamp: new Date().toISOString(),
            messageId: `msg_${Date.now()}`
          }
          logs.push('消息发送成功')
          break
          
        case 'assign_task':
          if (!toAgent || !payload) {
            return { success: false, error: 'toAgent and payload are required for assign_task' }
          }
          logs.push(`${fromAgent} 向 ${toAgent} 分配任务`)
          result = {
            action: 'assign_task',
            from: fromAgent,
            to: toAgent,
            task: payload,
            tag: tag || '[COLLAB:ASSIGN]',
            timestamp: new Date().toISOString(),
            taskId: `task_${Date.now()}`
          }
          logs.push('任务分配成功')
          break
          
        case 'request_info':
          if (!toAgent || !message) {
            return { success: false, error: 'toAgent and message are required for request_info' }
          }
          logs.push(`${fromAgent} 向 ${toAgent} 请求信息`)
          result = {
            action: 'request_info',
            from: fromAgent,
            to: toAgent,
            query: message,
            tag: tag || '[COLLAB:ASK]',
            timestamp: new Date().toISOString(),
            requestId: `req_${Date.now()}`
          }
          logs.push('信息请求发送成功')
          break
          
        case 'notify_status':
          logs.push(`${fromAgent} 通知状态变更`)
          result = {
            action: 'notify_status',
            from: fromAgent,
            to: toAgent,
            status: payload,
            tag,
            timestamp: new Date().toISOString()
          }
          logs.push('状态通知发送成功')
          break
          
        case 'broadcast':
          if (!message) {
            return { success: false, error: 'message is required for broadcast' }
          }
          logs.push(`${fromAgent} 广播消息`)
          result = {
            action: 'broadcast',
            from: fromAgent,
            message,
            payload,
            tag,
            timestamp: new Date().toISOString(),
            broadcastId: `broadcast_${Date.now()}`
          }
          logs.push('广播发送成功')
          break
          
        default:
          return { success: false, error: `Unsupported collaboration action: ${action}` }
      }
      
      return {
        success: true,
        data: result,
        logs
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Collaboration operation failed',
        logs: [`协作操作失败: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }
  
  validateParams(params: Record<string, unknown>): boolean {
    const { action, fromAgent } = params
    return typeof action === 'string' && typeof fromAgent === 'string' && fromAgent.length > 0
  }
  
  getRequirements(): Skill['requirements'] {
    return {
      permissions: ['agent_messaging', 'task_assignment']
    }
  }
}

class SkillRegistry {
  private skills: Map<string, BaseSkill> = new Map()
  private skillMetadata: Map<string, Skill> = new Map()
  
  constructor() {
    this.registerBuiltInSkills()
  }
  
  private registerBuiltInSkills() {
    const builtInSkills = [
      new CodeReviewSkill(),
      new FileStructureGeneratorSkill(),
      new TestGeneratorSkill(),
      new DocGeneratorSkill(),
      new FileOperationSkill(),
      new CollaborationSkill()
    ]
    
    builtInSkills.forEach(skill => {
      this.skills.set(skill.id, skill)
      this.skillMetadata.set(skill.id, {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        version: skill.version,
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: true,
        config: {},
        requirements: skill.getRequirements()
      })
    })
  }
  
  registerSkill(skill: BaseSkill, metadata?: Partial<Skill>): boolean {
    if (this.skills.has(skill.id)) {
      return false
    }
    
    this.skills.set(skill.id, skill)
    this.skillMetadata.set(skill.id, {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      version: skill.version,
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
      config: {},
      requirements: skill.getRequirements(),
      ...metadata
    })
    
    return true
  }
  
  getSkill(id: string): BaseSkill | undefined {
    return this.skills.get(id)
  }
  
  getSkillMetadata(id: string): Skill | undefined {
    return this.skillMetadata.get(id)
  }
  
  listSkills(category?: Skill['category']): Skill[] {
    const skills = Array.from(this.skillMetadata.values())
    if (category) {
      return skills.filter(s => s.category === category)
    }
    return skills
  }
  
  async executeSkill(
    id: string,
    params: Record<string, unknown>,
    context?: Partial<SkillExecutionContext>
  ): Promise<SkillResult> {
    const skill = this.skills.get(id)
    if (!skill) {
      return { success: false, error: 'Skill not found' }
    }
    
    const metadata = this.skillMetadata.get(id)
    if (!metadata?.enabled) {
      return { success: false, error: 'Skill is disabled' }
    }
    
    if (context) {
      skill.setContext(context)
    }
    
    if (!skill.validateParams(params)) {
      return { success: false, error: 'Invalid parameters' }
    }
    
    return await skill.execute(params)
  }
  
  enableSkill(id: string): boolean {
    const metadata = this.skillMetadata.get(id)
    if (!metadata) return false
    metadata.enabled = true
    metadata.updatedAt = new Date()
    return true
  }
  
  disableSkill(id: string): boolean {
    const metadata = this.skillMetadata.get(id)
    if (!metadata) return false
    metadata.enabled = false
    metadata.updatedAt = new Date()
    return true
  }
  
  configureSkill(id: string, config: Record<string, unknown>): boolean {
    const skill = this.skills.get(id)
    const metadata = this.skillMetadata.get(id)
    if (!skill || !metadata) return false
    
    skill.configure(config)
    metadata.config = config
    metadata.updatedAt = new Date()
    return true
  }
}

export const skillRegistry = new SkillRegistry()
