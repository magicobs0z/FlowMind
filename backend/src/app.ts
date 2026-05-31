import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import { errorHandler } from './core/error/handler';
import { FlowMindError } from './core/error';
import { workspaceRoutes } from './modules/workspace/routes';
import { dagRoutes } from './modules/dag/routes';
import { agentRoutes } from './modules/agent/routes';
import { blueprintRoutes } from './modules/blueprint/routes';
import { chatRoutes } from './modules/chat/routes';
import { timelineRoutes } from './modules/timeline/routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger: logger as any }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/workspace', workspaceRoutes);
app.use('/api/v1/dag', dagRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/blueprints', blueprintRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/git/timeline', timelineRoutes);

app.use((req, _res, next) => {
  const err = new FlowMindError(
    `Route not found: ${req.method} ${req.path}`,
    'ROUTE_NOT_FOUND',
    404
  );
  next(err);
});

app.use(errorHandler);

export { app };
