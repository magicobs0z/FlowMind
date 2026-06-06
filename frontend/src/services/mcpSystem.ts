export interface MCPServer {
  id: string
  name: string
  description: string
  type: 'filesystem' | 'git' | 'process' | 'browser' | 'database' | 'custom'
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPResourceTemplate {
  uriTemplate: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments: Array<{ name: string; description?: string; required?: boolean }>
}

export interface MCPConnection {
  id: string
  serverId: string
  tools: MCPTool[]
  resources: MCPResource[]
  resourceTemplates: MCPResourceTemplate[]
  prompts: MCPPrompt[]
  connectedAt: Date
}

export interface MCPToolCall {
  toolName: string
  arguments: Record<string, unknown>
}

export interface MCPToolResult {
  success: boolean
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    uri?: string
  }>
  error?: string
}

class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map()
  private connections: Map<string, MCPConnection> = new Map()
  
  constructor() {
    this.initializeBuiltInServers()
  }
  
  private initializeBuiltInServers() {
    const builtInServers: MCPServer[] = [
      {
        id: 'mcp_filesystem',
        name: '文件系统',
        description: '本地文件系统操作',
        type: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
        enabled: false,
        status: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mcp_git',
        name: 'Git',
        description: 'Git 仓库操作',
        type: 'git',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git', '.'],
        enabled: false,
        status: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mcp_process',
        name: '进程管理',
        description: '本地进程执行',
        type: 'process',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-process'],
        enabled: false,
        status: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mcp_browser',
        name: '浏览器',
        description: '网页浏览器自动化',
        type: 'browser',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer'],
        enabled: false,
        status: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mcp_memory',
        name: '记忆存储',
        description: '内存存储服务',
        type: 'custom',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        enabled: false,
        status: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mcp_search',
        name: '网络搜索',
        description: 'Brave Search 搜索引擎',
        type: 'custom',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        enabled: false,
        status: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mcp_fs_safe',
        name: '安全文件系统',
        description: '安全的文件系统操作（沙箱模式）',
        type: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem-safe'],
        enabled: false,
        status: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
    
    builtInServers.forEach(server => this.servers.set(server.id, server))
  }
  
  registerServer(server: MCPServer): boolean {
    if (this.servers.has(server.id)) {
      return false
    }
    this.servers.set(server.id, server)
    return true
  }
  
  updateServer(id: string, updates: Partial<MCPServer>): boolean {
    const server = this.servers.get(id)
    if (!server) return false
    this.servers.set(id, { ...server, ...updates, updatedAt: new Date() })
    return true
  }
  
  deleteServer(id: string): boolean {
    return this.servers.delete(id)
  }
  
  getServer(id: string): MCPServer | undefined {
    return this.servers.get(id)
  }
  
  listServers(type?: MCPServer['type']): MCPServer[] {
    const servers = Array.from(this.servers.values())
    if (type) {
      return servers.filter(s => s.type === type)
    }
    return servers
  }
  
  async connectServer(serverId: string): Promise<MCPConnection | null> {
    const server = this.servers.get(serverId)
    if (!server) return null
    
    server.status = 'connecting'
    server.updatedAt = new Date()
    
    try {
      const simulatedTools: MCPTool[] = []
      const simulatedResources: MCPResource[] = []
      
      switch (server.type) {
        case 'filesystem':
          simulatedTools.push(
            {
              name: 'read_file',
              description: '读取文件内容',
              inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
            },
            {
              name: 'write_file',
              description: '写入文件内容',
              inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }
            },
            {
              name: 'list_directory',
              description: '列出目录内容',
              inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
            }
          )
          simulatedResources.push(
            { uri: 'file:///workspace', name: '工作区', mimeType: 'inode/directory' }
          )
          break
          
        case 'git':
          simulatedTools.push(
            {
              name: 'git_status',
              description: '查看 git 状态',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'git_diff',
              description: '查看 git 差异',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'git_log',
              description: '查看 git 提交历史',
              inputSchema: { type: 'object', properties: { limit: { type: 'number' } } }
            }
          )
          break
          
        case 'process':
          simulatedTools.push(
            {
              name: 'execute_command',
              description: '执行命令',
              inputSchema: { type: 'object', properties: { command: { type: 'string' }, args: { type: 'array' } }, required: ['command'] }
            }
          )
          break
          
        case 'browser':
          simulatedTools.push(
            {
              name: 'navigate',
              description: '导航到网页',
              inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
            },
            {
              name: 'screenshot',
              description: '截图',
              inputSchema: { type: 'object', properties: {} }
            }
          )
          break
          
        case 'database':
          simulatedTools.push(
            {
              name: 'query',
              description: '执行查询',
              inputSchema: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] }
            }
          )
          break
      }
      
      const connection: MCPConnection = {
        id: `mcp_conn_${Date.now()}`,
        serverId,
        tools: simulatedTools,
        resources: simulatedResources,
        resourceTemplates: [],
        prompts: [],
        connectedAt: new Date()
      }
      
      this.connections.set(serverId, connection)
      server.status = 'connected'
      server.updatedAt = new Date()
      
      return connection
    } catch (error) {
      server.status = 'error'
      server.updatedAt = new Date()
      return null
    }
  }
  
  async disconnectServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId)
    if (!server) return false
    
    this.connections.delete(serverId)
    server.status = 'disconnected'
    server.updatedAt = new Date()
    return true
  }
  
  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId)
  }
  
  listConnections(): MCPConnection[] {
    return Array.from(this.connections.values())
  }
  
  async callTool(serverId: string, toolCall: MCPToolCall): Promise<MCPToolResult> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      return { success: false, content: [], error: 'Not connected to server' }
    }
    
    const tool = connection.tools.find(t => t.name === toolCall.toolName)
    if (!tool) {
      return { success: false, content: [], error: 'Tool not found' }
    }
    
    try {
      let resultText = `Called tool: ${toolCall.toolName}`
      
      if (toolCall.arguments) {
        resultText += `\nArguments: ${JSON.stringify(toolCall.arguments, null, 2)}`
      }
      
      return {
        success: true,
        content: [{
          type: 'text',
          text: resultText
        }]
      }
    } catch (error) {
      return {
        success: false,
        content: [],
        error: error instanceof Error ? error.message : 'Tool call failed'
      }
    }
  }
  
  async readResource(serverId: string, uri: string): Promise<MCPToolResult> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      return { success: false, content: [], error: 'Not connected to server' }
    }
    
    return {
      success: true,
      content: [{
        type: 'text',
        text: `Reading resource: ${uri}`
      }]
    }
  }
  
  enableServer(id: string): boolean {
    const server = this.servers.get(id)
    if (!server) return false
    server.enabled = true
    server.updatedAt = new Date()
    return true
  }
  
  disableServer(id: string): boolean {
    const server = this.servers.get(id)
    if (!server) return false
    server.enabled = false
    server.updatedAt = new Date()
    return true
  }
}

export const mcpManager = new MCPServerManager()
