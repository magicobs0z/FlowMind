import { workspaceApi, agentApi } from './api'

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private toolHandlers: Map<string, (params: any, context?: any) => Promise<ToolResult>> = new Map()

  registerTool(tool: ToolDefinition, handler: (params: any, context?: any) => Promise<ToolResult>) {
    this.tools.set(tool.name, tool)
    this.toolHandlers.set(tool.name, handler)
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  async executeTool(name: string, params: any, context?: any): Promise<ToolResult> {
    const handler = this.toolHandlers.get(name)
    if (!handler) {
      return { success: false, error: `Tool ${name} not found` }
    }

    try {
      return await handler(params, context)
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  }
}

export const toolRegistry = new ToolRegistry()

toolRegistry.registerTool(
  {
    name: 'read_file',
    description: '读取文件内容。返回文件的完整文本内容。',
    parameters: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: '文件路径（相对于工作区根目录）' 
        },
        maxLines: { 
          type: 'number', 
          description: '最大读取行数（可选）' 
        }
      },
      required: ['path']
    }
  },
  async (params: { path: string; maxLines?: number }) => {
    try {
      const response = await workspaceApi.readFile(params.path)
      if (response.success) {
        let content = response.data.content
        if (params.maxLines && content) {
          const lines = content.split('\n')
          if (lines.length > params.maxLines) {
            content = lines.slice(0, params.maxLines).join('\n') + '\n... (truncated)'
          }
        }
        return { success: true, data: { path: params.path, content } }
      }
      return { success: false, error: response.error || 'Failed to read file' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error reading file' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'write_file',
    description: '写入或创建文件。如果文件存在则覆盖内容。',
    parameters: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: '文件路径（相对于工作区根目录）' 
        },
        content: { 
          type: 'string', 
          description: '文件内容' 
        },
        createDirectories: { 
          type: 'boolean', 
          description: '是否自动创建目录（默认true）' 
        }
      },
      required: ['path', 'content']
    }
  },
  async (params: { path: string; content: string; createDirectories?: boolean }) => {
    try {
      const response = await workspaceApi.writeFile(
        params.path, 
        params.content, 
        params.createDirectories !== false
      )
      if (response.success) {
        return { 
          success: true, 
          data: { 
            path: params.path, 
            bytes: params.content.length,
            lines: params.content.split('\n').length
          } 
        }
      }
      return { success: false, error: response.error || 'Failed to write file' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error writing file' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'create_directory',
    description: '创建新目录。',
    parameters: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: '目录路径（相对于工作区根目录）' 
        },
        recursive: { 
          type: 'boolean', 
          description: '是否递归创建父目录（默认true）' 
        }
      },
      required: ['path']
    }
  },
  async (params: { path: string; recursive?: boolean }) => {
    try {
      const response = await workspaceApi.createDirectory(params.path, params.recursive !== false)
      if (response.success) {
        return { success: true, data: { path: params.path } }
      }
      return { success: false, error: response.error || 'Failed to create directory' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating directory' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'delete_file',
    description: '删除文件或空目录。',
    parameters: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: '文件或目录路径' 
        },
        type: { 
          type: 'string', 
          enum: ['file', 'directory', 'any'],
          description: '删除类型：file（仅文件）、directory（仅目录）、any（文件或目录）' 
        }
      },
      required: ['path']
    }
  },
  async (params: { path: string; type?: string }) => {
    try {
      const response = await workspaceApi.deleteFile(params.path)
      if (response.success) {
        return { success: true, data: { path: params.path } }
      }
      return { success: false, error: response.error || 'Failed to delete' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error deleting' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'list_directory',
    description: '列出目录内容。返回文件和子目录列表。',
    parameters: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: '目录路径（默认根目录）' 
        },
        recursive: { 
          type: 'boolean', 
          description: '是否递归列出子目录' 
        }
      }
    }
  },
  async (params: { path?: string; recursive?: boolean }) => {
    try {
      const response = await workspaceApi.listDirectory(params.path || '/')
      if (response.success) {
        return { success: true, data: response.data }
      }
      return { success: false, error: response.error || 'Failed to list directory' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error listing directory' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'search_files',
    description: '搜索文件。支持按文件名或内容搜索。',
    parameters: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: '搜索关键词' 
        },
        path: { 
          type: 'string', 
          description: '搜索目录（默认整个工作区）' 
        },
        type: { 
          type: 'string', 
          enum: ['name', 'content', 'both'],
          description: '搜索类型：name（文件名）、content（文件内容）、both（两者）' 
        },
        filePattern: { 
          type: 'string', 
          description: '文件类型过滤（如 *.ts, *.js）' 
        }
      },
      required: ['query']
    }
  },
  async (params: { query: string; path?: string; type?: string; filePattern?: string }) => {
    try {
      const response = await workspaceApi.searchFiles(
        params.query, 
        params.path, 
        params.type, 
        params.filePattern
      )
      if (response.success) {
        return { success: true, data: response.data }
      }
      return { success: false, error: response.error || 'Search failed' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error searching' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'get_file_tree',
    description: '获取项目文件树结构。返回完整的目录树。',
    parameters: {
      type: 'object',
      properties: {
        maxDepth: { 
          type: 'number', 
          description: '最大目录深度（默认3层）' 
        }
      }
    }
  },
  async (_params?: { maxDepth?: number }) => {
    try {
      const response = await workspaceApi.getProjectSummary()
      if (response.success) {
        return { success: true, data: response.data }
      }
      return { success: false, error: response.error || 'Failed to get file tree' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error getting file tree' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'execute_command',
    description: '执行终端命令。返回命令输出。',
    parameters: {
      type: 'object',
      properties: {
        command: { 
          type: 'string', 
          description: '要执行的命令' 
        },
        workingDirectory: { 
          type: 'string', 
          description: '工作目录（可选）' 
        },
        timeout: { 
          type: 'number', 
          description: '超时时间（毫秒，默认30000）' 
        }
      },
      required: ['command']
    }
  },
  async (params: { command: string; workingDirectory?: string; timeout?: number }) => {
    try {
      const response = await agentApi.executeCommand(
        params.command, 
        params.workingDirectory, 
        params.timeout || 30000
      )
      if (response.success) {
        return { success: true, data: response.data }
      }
      return { success: false, error: response.error || 'Command execution failed' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error executing command' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'git_operations',
    description: '执行Git操作。如查看状态、提交、切换分支等。',
    parameters: {
      type: 'object',
      properties: {
        operation: { 
          type: 'string', 
          enum: ['status', 'diff', 'log', 'commit', 'branch', 'checkout', 'pull', 'push'],
          description: 'Git操作类型' 
        },
        args: { 
          type: 'string', 
          description: '额外参数（如提交信息、分支名等）' 
        }
      },
      required: ['operation']
    }
  },
  async (params: { operation: string; args?: string }) => {
    try {
      const response = await agentApi.gitOperation(params.operation, params.args)
      if (response.success) {
        return { success: true, data: response.data }
      }
      return { success: false, error: response.error || 'Git operation failed' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error in git operation' 
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'analyze_code',
    description: '分析代码结构。返回文件中的函数、类、导入等信息。',
    parameters: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: '文件路径' 
        }
      },
      required: ['path']
    }
  },
  async (params: { path: string }) => {
    try {
      const response = await workspaceApi.readFile(params.path)
      if (!response.success) {
        return { success: false, error: 'Failed to read file for analysis' }
      }

      const content = response.data.content
      const lines = content.split('\n')
      
      const functions: Array<{ name: string; line: number; params: string }> = []
      const classes: Array<{ name: string; line: number }> = []
      const imports: string[] = []
      const exports: string[] = []

      lines.forEach((line: string, index: number) => {
        const trimmed = line.trim()
        
        if (trimmed.startsWith('import ')) {
          imports.push(trimmed)
        }
        
        if (trimmed.startsWith('export ')) {
          exports.push(trimmed)
        }
        
        const functionMatch = trimmed.match(/^(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*{/)
        if (functionMatch) {
          const name = functionMatch[1] || functionMatch[2] || functionMatch[3]
          if (name && !['if', 'for', 'while', 'switch'].includes(name)) {
            functions.push({ name, line: index + 1, params: '' })
          }
        }

        const classMatch = trimmed.match(/^class\s+(\w+)/)
        if (classMatch) {
          classes.push({ name: classMatch[1], line: index + 1 })
        }
      })

      return {
        success: true,
        data: {
          path: params.path,
          lines: lines.length,
          functions: functions.slice(0, 50),
          classes,
          imports: imports.slice(0, 30),
          exports: exports.slice(0, 30)
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error analyzing code'
      }
    }
  }
)

toolRegistry.registerTool(
  {
    name: 'read_multiple_files',
    description: '批量读取多个文件。高效读取相关文件。',
    parameters: {
      type: 'object',
      properties: {
        paths: { 
          type: 'array',
          items: { type: 'string' },
          description: '文件路径列表' 
        }
      },
      required: ['paths']
    }
  },
  async (params: { paths: string[] }) => {
    try {
      const results = await Promise.all(
        params.paths.map(async (path) => {
          const response = await workspaceApi.readFile(path)
          return {
            path,
            success: response.success,
            content: response.success ? response.data.content : null,
            error: response.success ? null : response.error
          }
        })
      )
      
      return { success: true, data: results }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error reading files' 
      }
    }
  }
)

console.log(`[ToolRegistry] 已注册 ${toolRegistry.getToolNames().length} 个工具:`)
toolRegistry.getToolNames().forEach(name => {
  const tool = toolRegistry.getTool(name)
  console.log(`  - ${name}: ${tool?.description}`)
})
