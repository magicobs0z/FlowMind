import { app } from './app';
import { config } from './core/config';
import { logger } from './utils/logger';

const PORT = config.PORT;

app.listen(PORT, () => {
  logger.info({ port: PORT, env: config.NODE_ENV }, `FlowMind server is running on port ${PORT}`);
});
