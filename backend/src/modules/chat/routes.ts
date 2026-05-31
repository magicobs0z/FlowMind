import { Router } from 'express';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';

const router = Router();

interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  model?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const conversations = new Map<string, Conversation>();

const generateResponse = (message: string): string => {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('你好') || lowerMsg.includes('hi') || lowerMsg.includes('hello')) {
    return '你好！我是 FlowMind AI 助手。我可以帮你编写代码、分析项目、调试问题。请告诉我你需要什么帮助？';
  }
  if (lowerMsg.includes('代码') || lowerMsg.includes('code')) {
    return '我可以帮你编写、审查和优化代码。请提供具体的代码片段或描述你的需求，我会给出详细的建议和实现方案。';
  }
  if (lowerMsg.includes('bug') || lowerMsg.includes('错误') || lowerMsg.includes('debug')) {
    return '我可以帮你调试代码。请提供错误信息、相关代码片段和上下文，我会分析问题并给出修复建议。';
  }
  if (lowerMsg.includes('项目') || lowerMsg.includes('project')) {
    return '我可以分析你的项目结构、技术栈和依赖关系。请告诉我你想了解项目的哪个方面。';
  }
  if (lowerMsg.includes('优化') || lowerMsg.includes('性能') || lowerMsg.includes('performance')) {
    return '我可以帮你优化代码性能。请提供需要优化的代码片段，我会分析瓶颈并给出优化建议。';
  }

  return `收到你的消息："${message}"

我正在处理你的请求。作为一个 AI 助手，我可以：
- 编写和审查代码
- 调试和修复 Bug
- 分析项目结构
- 优化性能
- 解释技术概念

请提供更多细节，让我更好地帮助你。`;
};

router.post('/message', async (req, res) => {
  try {
    const { message, model, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'message is required',
      });
      return;
    }

    let convId = conversationId;
    let conversation: Conversation;

    if (convId && conversations.has(convId)) {
      conversation = conversations.get(convId)!;
    } else {
      convId = `conv_${Date.now()}`;
      conversation = {
        id: convId,
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      conversations.set(convId, conversation);
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    conversation.messages.push(userMessage);

    logger.info({ conversationId: convId, model }, 'Processing chat message');

    const responseContent = generateResponse(message);

    const aiMessage: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'ai',
      content: responseContent,
      timestamp: new Date().toISOString(),
      model: model || 'default',
    };

    conversation.messages.push(aiMessage);
    conversation.updatedAt = new Date().toISOString();

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
      message: 'Failed to process message',
    });
  }
});

router.get('/conversations', (_req, res) => {
  try {
    const list = Array.from(conversations.values())
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
    const conversation = conversations.get(id);

    if (!conversation) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Conversation not found',
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: conversation.messages,
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

export { router as chatRoutes };
