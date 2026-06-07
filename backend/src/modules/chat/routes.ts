import { Router } from 'express';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';
import { chatRepository, ChatMessage, Conversation } from './repository';
import { modelRepository } from '../model/repository';
import { AgentEngine } from '../agent/engine';
import { ToolRegistry } from '../agent/tools';

const router = Router();

// 聊天系统提示词 - 包含工具使用指南
const DEFAULT_SYSTEM_PROMPT = `你是 FlowMind，一个强大的 AI 编程助手，具有代码读写和执行能力。

## 你的能力

你可以使用以下工具来完成任务：
1. **read_file** - 读取文件内容
2. **write_file** - 写入或创建文件
3. **list_directory** - 列出目录内容
4. **search_files** - 在文件中搜索内容
5. **execute_command** - 执行终端命令
6. **gitOperations** - 执行 Git 操作

## 使用工具的原则

- 当需要了解项目结构时，先使用 list_directory
- 当需要查看代码时，使用 read_file
- 当需要修改或创建代码时，使用 write_file
- 当需要执行命令（如 npm install, git 等）时，使用 execute_command
- 尽可能通过工具获取真实信息，而不是猜测

## 响应格式

你可以直接回答用户问题，也可以通过调用工具来完成任务。
工具调用将自动执行，结果会返回给你继续处理。

请用清晰、简洁、友好的语言回答，并在适当的时候使用工具来帮助完成任务。`;

function getOrCreateConversation(conversationId?: string, title?: string): { convId: string; conversation: Conversation } {
  let convId = conversationId;
  let conversation: Conversation | undefined;

  if (convId && chatRepository.has(convId)) {
    conversation = chatRepository.get(convId)!;
  } else {
    convId = `conv_${Date.now()}`;
    conversation = {
      id: convId,
      title: title || '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    chatRepository.set(conversation);
  }

  return { convId: convId!, conversation: conversation! };
}

// 从后端存储加载模型配置
function loadModelConfigFromBackend(modelId?: string): { apiKey: string; baseUrl: string; modelName: string } | null {
  try {
    const configs = modelRepository.list();
    if (configs.length === 0) return null;

    const target = modelId
      ? configs.find((c) => c.id === modelId || c.modelName === modelId)
      : configs.find((c) => c.isDefault);

    if (!target) return null;

    return {
      apiKey: target.apiKey,
      baseUrl: target.baseUrl,
      modelName: target.modelName,
    };
  } catch (error) {
    logger.error('Failed to load model config from backend repository', error);
    return null;
  }
}

router.post('/message', async (req, res) => {
  try {
    const { message, model, conversationId, systemPrompt, llmConfig } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'message is required',
      });
      return;
    }

    const { convId, conversation } = getOrCreateConversation(conversationId, message.slice(0, 30) + (message.length > 30 ? '...' : ''));

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    conversation.messages.push(userMessage);
    chatRepository.set(conversation);

    logger.info({ conversationId: convId, model }, 'Processing chat message with Agent Engine');

    // 获取LLM配置：优先使用请求中的配置，否则从后端存储加载
    let llmSettings = llmConfig;
    if (!llmSettings || !llmSettings.apiKey) {
      llmSettings = loadModelConfigFromBackend(model) || undefined;
    }

    let responseContent: string;

    // 如果有 LLM 配置，使用 Agent Engine 调用（支持工具）
    if (llmSettings?.apiKey && llmSettings?.baseUrl && llmSettings?.modelName) {
      const toolRegistry = new ToolRegistry();
      
      const engine = new AgentEngine({
        llmConfig: {
          provider: 'openai',
          apiKey: llmSettings.apiKey,
          baseUrl: llmSettings.baseUrl,
          modelName: llmSettings.modelName,
          temperature: 0.7,
          maxTokens: 4096,
        },
        toolRegistry,
        systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        maxIterations: 10,
        contextWindowSize: 10,
      });

      const toolContext = {
        worktree: process.cwd(),
        directory: process.cwd(),
        allowOutsideWorktree: false,
      };

      const result = await engine.execute(message, toolContext);
      
      if (result.success) {
        responseContent = result.content;
        // 如果有工具调用结果，可以附在响应中（可选）
        if (result.toolResults && result.toolResults.length > 0) {
          responseContent += '\n\n---\n\n**已执行的操作：**\n';
          for (const toolResult of result.toolResults) {
            const status = toolResult.ok ? '✅' : '❌';
            responseContent += `${status} ${toolResult.tool}: ${toolResult.summary}\n`;
          }
        }
      } else {
        responseContent = result.error || '执行失败';
      }
    } else {
      // 无配置时的备用响应
      responseContent = `我无法连接到 AI 服务，因为还没有配置模型。\n\n请在设置页面配置你的 AI 模型（如 DeepSeek、GPT-4 等），然后就可以开始使用真实的 AI 了！\n\n当前你发送的消息："${message}"`;
    }

    const aiMessage: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'ai',
      content: responseContent,
      timestamp: new Date().toISOString(),
      model: model || (llmSettings?.modelName || 'default'),
    };

    conversation.messages.push(aiMessage);
    conversation.updatedAt = new Date().toISOString();
    chatRepository.set(conversation);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        response: responseContent,
        conversationId: convId,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to process chat message');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: (error as Error).message || 'Failed to process message',
    });
  }
});

// 流式响应端点
router.post('/stream', async (req, res) => {
  try {
    const { message, model, conversationId, systemPrompt, llmConfig } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'message is required',
      });
      return;
    }

    // 设置SSE头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { conversation } = getOrCreateConversation(conversationId, message.slice(0, 30) + (message.length > 30 ? '...' : ''));

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    conversation.messages.push(userMessage);
    chatRepository.set(conversation);

    // 获取LLM配置：优先使用请求中的配置，否则从后端存储加载
    let llmSettings = llmConfig;
    if (!llmSettings || !llmSettings.apiKey) {
      llmSettings = loadModelConfigFromBackend(model) || undefined;
    }

    let fullResponse = '';

    // 如果有 LLM 配置，使用 Agent Engine 调用（支持工具）
    if (llmSettings?.apiKey && llmSettings?.baseUrl && llmSettings?.modelName) {
      const toolRegistry = new ToolRegistry();
      
      const engine = new AgentEngine({
        llmConfig: {
          provider: 'openai',
          apiKey: llmSettings.apiKey,
          baseUrl: llmSettings.baseUrl,
          modelName: llmSettings.modelName,
          temperature: 0.7,
          maxTokens: 4096,
        },
        toolRegistry,
        systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        maxIterations: 10,
        contextWindowSize: 10,
        onStreamChunk: (chunk) => {
          if (chunk.content) {
            fullResponse += chunk.content;
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk.content } }] }) }\n\n`);
          }
        },
      });

      const toolContext = {
        worktree: process.cwd(),
        directory: process.cwd(),
        allowOutsideWorktree: false,
      };

      const result = await engine.execute(message, toolContext);
      
      if (result.success) {
        fullResponse = result.content;
        // 如果有工具调用结果，附加到响应中
        if (result.toolResults && result.toolResults.length > 0) {
          const toolInfo = '\n\n---\n\n**已执行的操作：**\n';
          fullResponse += toolInfo;
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: toolInfo } }] }) }\n\n`);
          
          for (const toolResult of result.toolResults) {
            const status = toolResult.ok ? '✅' : '❌';
            const toolLine = `${status} ${toolResult.tool}: ${toolResult.summary}\n`;
            fullResponse += toolLine;
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: toolLine } }] }) }\n\n`);
          }
        }
      } else {
        const errorMsg = result.error || '执行失败';
        fullResponse = errorMsg;
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: errorMsg } }] }) }\n\n`);
      }
    } else {
      // 无配置时的备用响应（流式）
      const fallbackResponse = `我无法连接到 AI 服务，因为还没有配置模型。\n\n请在设置页面配置你的 AI 模型（如 DeepSeek、GPT-4 等），然后就可以开始使用真实的 AI 了！\n\n当前你发送的消息："${message}"`;

      for (const char of fallbackResponse) {
        fullResponse += char;
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: char } }] }) }\n\n`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    const aiMessage: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'ai',
      content: fullResponse,
      timestamp: new Date().toISOString(),
      model: model || (llmSettings?.modelName || 'default'),
    };

    conversation.messages.push(aiMessage);
    conversation.updatedAt = new Date().toISOString();
    chatRepository.set(conversation);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    logger.error({ err: error }, 'Failed to process streaming chat message');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: (error as Error).message || 'Failed to process message',
    });
  }
});

router.get('/conversations', (_req, res) => {
  try {
    const list = chatRepository.list()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
      }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: list,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list conversations');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to list conversations',
    });
  }
});

router.get('/conversations/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const messages = chatRepository.getMessages(id);

    if (!messages) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Conversation not found',
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get messages');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to get messages',
    });
  }
});

router.delete('/conversations/:id', (req, res) => {
  try {
    const { id } = req.params;
    chatRepository.delete(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete conversation');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to delete conversation',
    });
  }
});

export { router as chatRoutes };
