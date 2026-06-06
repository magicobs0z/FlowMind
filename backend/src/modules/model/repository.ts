import { ModelConfig } from './types';
import { logger } from '../../utils/logger';
import { createModuleStorage } from '../../core/storage';

const MODULE_NAME = 'model';
const MODELS_FILE = 'models.json';

const moduleStorage = createModuleStorage(MODULE_NAME);

class ModelRepository {
  private configs: ModelConfig[] = [];
  private initialized = false;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.initialized) return;

    try {
      const configs = moduleStorage.readJson<ModelConfig[]>(MODELS_FILE, []);
      if (configs && Array.isArray(configs)) {
        this.configs = configs;
      }

      this.initialized = true;
      logger.info({ count: this.configs.length }, 'Model repository loaded from disk');
    } catch (error) {
      logger.error(error, 'Failed to load model repository from disk');
    }
  }

  private persist(): void {
    moduleStorage.writeJson(MODELS_FILE, this.configs);
  }

  list(): ModelConfig[] {
    return [...this.configs];
  }

  findById(id: string): ModelConfig | undefined {
    return this.configs.find(c => c.id === id);
  }

  create(config: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>): ModelConfig {
    if (config.isDefault) {
      this.configs.forEach(c => { c.isDefault = false; });
    }

    const newConfig: ModelConfig = {
      ...config,
      id: `model_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.configs.push(newConfig);
    this.persist();
    logger.info({ modelId: newConfig.id }, 'Model config created');
    return newConfig;
  }

  update(id: string, updates: Partial<ModelConfig>): ModelConfig | null {
    const index = this.configs.findIndex(c => c.id === id);
    if (index === -1) return null;

    if (updates.isDefault) {
      this.configs.forEach(c => { c.isDefault = false; });
    }

    const current = this.configs[index]!;
    const updated: ModelConfig = {
      ...current,
      ...updates,
      id: current.id,
      name: updates.name ?? current.name,
      provider: updates.provider ?? current.provider,
      type: updates.type ?? current.type,
      apiKey: updates.apiKey ?? current.apiKey,
      baseUrl: updates.baseUrl ?? current.baseUrl,
      modelName: updates.modelName ?? current.modelName,
      isDefault: updates.isDefault ?? current.isDefault,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.configs[index] = updated;

    this.persist();
    logger.info({ modelId: id }, 'Model config updated');
    return updated;
  }

  delete(id: string): boolean {
    const filtered = this.configs.filter(c => c.id !== id);
    if (filtered.length === this.configs.length) return false;

    this.configs = filtered;
    this.persist();
    logger.info({ modelId: id }, 'Model config deleted');
    return true;
  }
}

export const modelRepository = new ModelRepository();
