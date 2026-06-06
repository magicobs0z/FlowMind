import { Request, Response } from 'express'
import { orchestrator } from './orchestrator'
import { HTTP_STATUS, ERROR_CODES } from '../../constants'
import { logger } from '../../utils/logger'

export const createAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, description, skills, tools, llmConfig, metadata } = req.body

    if (!name || !type) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Name and type are required'
      })
      return
    }

    const validTypes = ['lead', 'sub_lead', 'coder', 'reviewer', 'tester', 'explorer', 'custom']
    const agentType = validTypes.includes(type) ? type : 'custom'

    const agent = {
      id: `agent_custom_${Date.now()}`,
      name,
      type: agentType,
      description: description || '',
      status: 'idle' as const,
      skills: skills || [],
      tools: tools || ['read_file', 'write_file'],
      llmConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata
    }

    const success = orchestrator.registerAgent(agent)

    if (!success) {
      res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: 'AGENT_EXISTS',
        message: 'Agent with this ID already exists'
      })
      return
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: agent
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to create agent')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const listAgents = async (_req: Request, res: Response): Promise<void> => {
  try {
    const agents = orchestrator.listAgents()
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: agents
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to list agents')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Agent ID is required'
      })
      return
    }

    const agent = orchestrator.getAgent(id)

    if (!agent) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'AGENT_NOT_FOUND',
        message: 'Agent not found'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: agent
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get agent')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const updateAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const updates = req.body

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Agent ID is required'
      })
      return
    }

    const success = orchestrator.updateAgent(id, updates)

    if (!success) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'AGENT_NOT_FOUND',
        message: 'Agent not found or cannot be updated'
      })
      return
    }

    const agent = orchestrator.getAgent(id as string)
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: agent
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to update agent')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const deleteAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Agent ID is required'
      })
      return
    }

    const success = orchestrator.deleteAgent(id)

    if (!success) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'AGENT_NOT_FOUND',
        message: 'Agent not found or cannot be deleted'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Agent deleted successfully'
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete agent')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const createSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, masterAgentId, participatingAgentIds, planId } = req.body

    if (!title || !masterAgentId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Title and masterAgentId are required'
      })
      return
    }

    const session = orchestrator.createSession(title, masterAgentId, participatingAgentIds || [], planId)

    if (!session) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'Failed to create session'
      })
      return
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: session
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to create session')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const startSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Session ID is required'
      })
      return
    }

    const success = orchestrator.startSession(id)

    if (!success) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found or cannot be started'
      })
      return
    }

    const session = orchestrator.getSession(id as string)
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: session
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to start session')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const pauseSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Session ID is required'
      })
      return
    }

    const success = orchestrator.pauseSession(id)

    if (!success) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found or cannot be paused'
      })
      return
    }

    const session = orchestrator.getSession(id as string)
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: session
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to pause session')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Session ID is required'
      })
      return
    }

    const session = orchestrator.getSession(id)

    if (!session) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: session
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get session')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const listSessions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sessions = orchestrator.listSessions()
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: sessions
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to list sessions')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const addTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, description, priority, assignedTo } = req.body

    if (!sessionId || !description) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'sessionId and description are required'
      })
      return
    }

    const task = orchestrator.addTask(
      sessionId,
      description,
      priority || 'medium',
      assignedTo
    )

    if (!task) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'INVALID_TASK',
        message: 'Failed to add task'
      })
      return
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: task
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to add task')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const executeTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, taskId, llmConfig } = req.body

    if (!sessionId || !taskId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'sessionId and taskId are required'
      })
      return
    }

    const task = await orchestrator.executeTask(sessionId, taskId, llmConfig)

    if (!task) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'TASK_EXECUTION_FAILED',
        message: 'Failed to execute task'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: task
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to execute task')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getAgentPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Agent ID is required'
      })
      return
    }

    const prompt = orchestrator.getAgentPrompt(id)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        agentId: id,
        prompt
      }
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get agent prompt')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const setAgentCustomPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { prompt } = req.body

    if (!id || !prompt) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Agent ID and prompt are required'
      })
      return
    }

    const success = orchestrator.setAgentCustomPrompt(id, prompt)

    if (!success) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'INVALID_OPERATION',
        message: 'Failed to set custom prompt. Only custom agents can have custom prompts.'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Custom prompt set successfully'
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to set agent custom prompt')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const clearAgentCustomPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Agent ID is required'
      })
      return
    }

    const success = orchestrator.clearAgentCustomPrompt(id)

    if (!success) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'AGENT_NOT_FOUND',
        message: 'Agent not found'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Custom prompt cleared successfully'
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to clear agent custom prompt')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const createPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description } = req.body

    if (!title) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Title is required'
      })
      return
    }

    const plan = await orchestrator.planManager.createPlan(title, description || '')

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: plan
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to create plan')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const listPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = orchestrator.planManager.listPlans()
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: plans
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to list plans')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Plan ID is required'
      })
      return
    }

    const plan = orchestrator.planManager.getPlan(id)

    if (!plan) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'PLAN_NOT_FOUND',
        message: 'Plan not found'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: plan
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get plan')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const updates = req.body

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Plan ID is required'
      })
      return
    }

    const plan = await orchestrator.planManager.updatePlan(id, updates)

    if (!plan) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'PLAN_NOT_FOUND',
        message: 'Plan not found'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: plan
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to update plan')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const archivePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Plan ID is required'
      })
      return
    }

    const success = await orchestrator.planManager.archivePlan(id)

    if (!success) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'PLAN_NOT_FOUND',
        message: 'Plan not found'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Plan archived successfully'
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to archive plan')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export const getActivePlan = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plan = orchestrator.planManager.getActivePlan()

    if (!plan) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: null,
        message: 'No active plan'
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: plan
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get active plan')
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
