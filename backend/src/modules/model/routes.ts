import { Router } from 'express'
import { HTTP_STATUS, ERROR_CODES } from '../../constants'
import { logger } from '../../utils/logger'
import { providerPresets } from './config'
import { ModelConfig } from './types'
import { modelRepository } from './repository'

const router = Router()

// 获取预置服务商列表
router.get('/providers', (_req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: providerPresets,
  })
})

// 获取已配置的模型列表
router.get('/', (_req, res) => {
  const configs = modelRepository.list()
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: configs,
  })
})

// 获取单个模型配置
router.get('/:id', (req, res) => {
  const config = modelRepository.findById(req.params.id)
  if (!config) {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: ERROR_CODES.VALIDATION_ERROR,
      message: 'Model not found',
    })
    return
  }
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: config,
  })
})

// 添加模型配置
router.post('/', (req, res) => {
  try {
    const config: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'> = req.body

    // 校验必填字段
    if (!config.modelName || !config.apiKey) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'modelName and apiKey are required',
      })
      return
    }

    const newConfig = modelRepository.create(config)

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: newConfig,
    })
  } catch (error) {
    logger.error('Failed to add model config', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to add model config',
    })
  }
})

// 更新模型配置
router.put('/:id', (req, res) => {
  try {
    const updates = req.body
    const config = modelRepository.update(req.params.id, updates)

    if (!config) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Model not found',
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: config,
    })
  } catch (error) {
    logger.error('Failed to update model config', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to update model config',
    })
  }
})

// 删除模型配置
router.delete('/:id', (req, res) => {
  try {
    const deleted = modelRepository.delete(req.params.id)

    if (!deleted) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Model not found',
      })
      return
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
    })
  } catch (error) {
    logger.error('Failed to delete model config', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to delete model config',
    })
  }
})

// 连通性测试
router.post('/test', async (req, res) => {
  try {
    const { apiKey, baseUrl, modelName, protocol = 'openai' } = req.body

    if (!apiKey || !baseUrl || !modelName) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'apiKey, baseUrl and modelName are required',
      })
      return
    }

    // 发起测试请求
    const axios = (await import('axios')).default

    let url = baseUrl.trim().replace(/\/$/, '')
    if (!url.endsWith('/chat/completions') && protocol === 'openai') {
      url = url + '/chat/completions'
    }

    try {
      const response = await axios.post(
        url,
        {
          model: modelName,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      )

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          connected: true,
          model: response.data.model,
        },
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Connection failed'
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          connected: false,
          error: errorMessage,
        },
      })
    }
  } catch (error) {
    logger.error('Failed to test model connection', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to test connection',
    })
  }
})

export { router as modelRoutes }
