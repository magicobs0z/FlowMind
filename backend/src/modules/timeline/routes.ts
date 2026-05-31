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

const mockEvents: TimelineEvent[] = [
  {
    id: 'evt_1',
    type: 'ai',
    message: 'AI 助手分析了项目结构并生成了技术栈报告',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    agentId: 'agent_analyzer',
  },
  {
    id: 'evt_2',
    type: 'human',
    message: '用户创建了新的蓝图模板：API 开发工作流',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'evt_3',
    type: 'auto',
    message: '自动检测到代码风格问题并应用了 Biome 格式化',
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    files: ['src/app.ts', 'src/components/layout.tsx'],
  },
  {
    id: 'evt_4',
    type: 'ai',
    message: '智能体协商完成了任务分配：前端开发 -> Agent-FE，后端开发 -> Agent-BE',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    agentId: 'agent_coordinator',
  },
];

router.get('/:workspaceId', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { from, to, type, limit = '50' } = req.query;

    logger.info({ workspaceId }, 'Fetching timeline events');

    let events = [...mockEvents];

    if (type && typeof type === 'string') {
      events = events.filter((e) => e.type === type);
    }

    if (from) {
      const fromDate = new Date(from as string);
      events = events.filter((e) => new Date(e.timestamp) >= fromDate);
    }

    if (to) {
      const toDate = new Date(to as string);
      events = events.filter((e) => new Date(e.timestamp) <= toDate);
    }

    const limitNum = parseInt(limit as string, 10);
    events = events.slice(0, limitNum);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        events,
        total: events.length,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch timeline');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to fetch timeline',
    });
  }
});

router.post('/checkout', (req, res) => {
  try {
    const { eventId, workspaceId, createBranch } = req.body;

    logger.info({ eventId, workspaceId, createBranch }, 'Checking out timeline event');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        eventId,
        checkedOut: true,
        branch: createBranch ? `hypothesis-${eventId}` : undefined,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to checkout');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to checkout',
    });
  }
});

router.post('/hypothesis', (req, res) => {
  try {
    const { eventId, branchName, description } = req.body;

    logger.info({ eventId, branchName }, 'Creating hypothesis branch');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        eventId,
        branchName,
        description,
        created: true,
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

export { router as timelineRoutes };
