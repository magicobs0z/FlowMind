import { Router } from 'express';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';
import { callLLM } from './llmService';
import { chatRepository, ChatMessage, Conversation } from './repository';
import { modelRepository } from '../model/repository';

const router = Router();

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `你是 FlowMind，一个由多智能体组成的 AI 编程助手。你的职责是帮助用户开发和调试软件项目。

你可以：
1. 阅读和分析代码
2. 编写和修改代码
3. 分析项目结构
4. 调试和修复问题
5. 解释技术概念
6. 提供最佳实践建议

请用清晰、简洁、友好的语言回答。`;

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

    logger.info({ conversationId: convId, model }, 'Processing chat message');

    // 获取LLM配置：优先使用请求中的配置，否则从后端存储加载
    let llmSettings = llmConfig;
    if (!llmSettings || !llmSettings.apiKey) {
      llmSettings = loadModelConfigFromBackend(model) || undefined;
    }

    let responseContent: string;

    // 如果有 LLM 配置，调用真实 LLM
    if (llmSettings?.apiKey && llmSettings?.baseUrl && llmSettings?.modelName) {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
        ...conversation.messages.map(m => ({
          role: (m.role === 'ai' ? 'assistant' : m.role) as 'user' | 'assistant',
          content: m.content
        })),
      ];

      responseContent = await callLLM(messages, {
        apiKey: llmSettings.apiKey,
        baseUrl: llmSettings.baseUrl,
        modelName: llmSettings.modelName,
      });
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

    // 如果有 LLM 配置，调用真实 LLM
    if (llmSettings?.apiKey && llmSettings?.baseUrl && llmSettings?.modelName) {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
        ...conversation.messages.map(m => ({
          role: (m.role === 'ai' ? 'assistant' : m.role) as 'user' | 'assistant',
          content: m.content
        })),
      ];

      const streamCallback = (chunk: string) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] }) }\n\n`);
      };

      await callLLM(messages, {
        apiKey: llmSettings.apiKey,
        baseUrl: llmSettings.baseUrl,
        modelName: llmSettings.modelName,
      }, streamCallback);
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
