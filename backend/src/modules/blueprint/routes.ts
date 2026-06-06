import { Router } from 'express';
import {
  listTemplates,
  createTemplate,
  getTemplate,
  generateExecutionBlueprint,
  getExecutionBlueprint,
  updateNodeStatus,
  listFunctions,
  addFunction,
} from './controller';
import { blueprintEngine } from './blueprintEngine';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';

const router = Router();

// 模板管理
router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.get('/templates/:id', getTemplate);

// 执行蓝图管理
router.post('/execute', generateExecutionBlueprint);
router.get('/execute/:id', getExecutionBlueprint);
router.patch('/execute/:id/nodes/:nodeId', updateNodeStatus);

// 函数库
router.get('/functions', listFunctions);
router.post('/execute/:id/functions', addFunction);

// 新增：蓝图执行引擎 API（打通 Agent 系统）

// 执行下一个 AI 节点
router.post('/execute/:id/next', async (req, res) => {
  try {
    const { id } = req.params;
    const { llmConfig } = req.body;

    logger.info({ executionId: id }, 'Executing next AI node in blueprint');

    const node = await blueprintEngine.executeNextAINode(id, llmConfig);

    if (!node) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: null,
        message: 'No executable AI node found',
      });
      return;
    }

    const execution = blueprintEngine.getExecutionBlueprint(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        node,
        execution,
      },
    });
  } catch (error) {
    logger.error({ err: error, executionId: req.params.id }, 'Failed to execute next AI node');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.AGENT_ERROR,
      message: error instanceof Error ? error.message : 'Failed to execute next AI node',
    });
  }
});

// 自动执行蓝图（顺序执行所有节点）
router.post('/execute/:id/auto', async (req, res) => {
  try {
    const { id } = req.params;
    const { llmConfig } = req.body;

    logger.info({ executionId: id }, 'Auto-executing blueprint');

    // 异步执行，立即返回
    blueprintEngine.autoExecute(id, llmConfig).catch((error) => {
      logger.error({ err: error, executionId: id }, 'Auto-execution failed');
    });

    const execution = blueprintEngine.getExecutionBlueprint(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: execution,
      message: 'Blueprint auto-execution started',
    });
  } catch (error) {
    logger.error({ err: error, executionId: req.params.id }, 'Failed to start auto-execution');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.AGENT_ERROR,
      message: error instanceof Error ? error.message : 'Failed to start auto-execution',
    });
  }
});

// 获取执行进度
router.get('/execute/:id/progress', (req, res) => {
  try {
    const { id } = req.params;
    const progress = blueprintEngine.calculateProgress(id);
    const execution = blueprintEngine.getExecutionBlueprint(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        progress,
        status: execution?.status,
        currentStage: execution?.currentStage,
        nodes: execution?.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          type: n.type,
          status: n.status,
        })),
      },
    });
  } catch (error) {
    logger.error({ err: error, executionId: req.params.id }, 'Failed to get blueprint progress');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to get progress',
    });
  }
});

// 获取可执行节点列表
router.get('/execute/:id/next-nodes', (req, res) => {
  try {
    const { id } = req.params;
    const nextNodes = blueprintEngine.getNextNodes(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: nextNodes,
    });
  } catch (error) {
    logger.error({ err: error, executionId: req.params.id }, 'Failed to get next nodes');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to get next nodes',
    });
  }
});

export { router as blueprintRoutes };
