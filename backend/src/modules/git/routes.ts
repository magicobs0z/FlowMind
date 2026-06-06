import { Router } from 'express';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';

const router = Router();

interface TimelineEvent {
  id: string;
  type: 'ai' | 'human' | 'auto';
  message: string;
  timestamp: string;
  commit?: string;
  files?: string[];
  agentId?: string;
}

const timelineEvents = new Map<string, TimelineEvent[]>();

function generateMockEvents(_workspaceId: string): TimelineEvent[] {
  const now = Date.now();
  return [
    {
      id: `evt_${now}_1`,
      type: 'human',
      message: '初始化项目结构',
      timestamp: new Date(now - 3600000 * 4).toISOString(),
      commit: 'a1b2c3d',
      files: ['package.json', 'vite.config.ts'],
    },
    {
      id: `evt_${now}_2`,
      type: 'auto',
      message: '自动格式化代码',
      timestamp: new Date(now - 3600000 * 3.5).toISOString(),
      commit: 'd4e5f6g',
      files: ['src/main.tsx'],
    },
    {
      id: `evt_${now}_3`,
      type: 'ai',
      message: '生成布局组件',
      timestamp: new Date(now - 3600000 * 3).toISOString(),
      commit: 'h7i8j9k',
      files: ['src/components/layout/ResizablePanel.tsx'],
      agentId: 'agent_1',
    },
    {
      id: `evt_${now}_4`,
      type: 'ai',
      message: '重构聊天界面',
      timestamp: new Date(now - 3600000 * 2.5).toISOString(),
      commit: 'l0m1n2o',
      files: ['src/components/layout/ChatPanel.tsx'],
      agentId: 'agent_2',
    },
    {
      id: `evt_${now}_5`,
      type: 'human',
      message: '调整样式变量',
      timestamp: new Date(now - 3600000 * 2).toISOString(),
      commit: 'p3q4r5s',
      files: ['src/index.css'],
    },
    {
      id: `evt_${now}_6`,
      type: 'ai',
      message: '实现文件浏览器',
      timestamp: new Date(now - 3600000 * 1.5).toISOString(),
      commit: 't6u7v8w',
      files: ['src/components/layout/FileExplorer.tsx'],
      agentId: 'agent_1',
    },
    {
      id: `evt_${now}_7`,
      type: 'auto',
      message: '运行类型检查',
      timestamp: new Date(now - 3600000).toISOString(),
      commit: 'x9y0z1a',
    },
    {
      id: `evt_${now}_8`,
      type: 'ai',
      message: '集成 Monaco Editor',
      timestamp: new Date(now - 1800000).toISOString(),
      commit: 'b2c3d4e',
      files: ['src/components/layout/EditorArea.tsx'],
      agentId: 'agent_3',
    },
  ];
}

router.get('/timeline/:workspaceId', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { from, to, type, limit } = req.query;

    let events = timelineEvents.get(workspaceId) || generateMockEvents(workspaceId);

    if (from) {
      const fromDate = new Date(from as string);
      events = events.filter(e => new Date(e.timestamp) >= fromDate);
    }

    if (to) {
      const toDate = new Date(to as string);
      events = events.filter(e => new Date(e.timestamp) <= toDate);
    }

    if (type) {
      events = events.filter(e => e.type === type);
    }

    if (limit) {
      events = events.slice(-parseInt(limit as string));
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        events: events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        total: events.length,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get timeline events');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to get timeline events',
    });
  }
});

router.post('/timeline/checkout', (req, res) => {
  try {
    const { eventId, workspaceId, createBranch } = req.body;

    logger.info({ eventId, workspaceId, createBranch }, 'Checkout event');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        checkoutId: `checkout_${Date.now()}`,
        eventId,
        branch: createBranch ? `feature/timeline-${eventId}` : 'main',
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to checkout event');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to checkout event',
    });
  }
});

router.post('/timeline/hypothesis', (req, res) => {
  try {
    const { eventId, branchName, description } = req.body;

    logger.info({ eventId, branchName, description }, 'Create hypothesis');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        hypothesisId: `hyp_${Date.now()}`,
        eventId,
        branch: branchName,
        description,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create hypothesis');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to create hypothesis',
    });
  }
});

export { router as gitRoutes };
