import { app } from './app';
import { config } from './core/config';
import { logger } from './utils/logger';
import { WebSocketServer } from 'ws';
import { ExecutionEngine } from './modules/blueprint/executionEngine';

const PORT = config.PORT;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: config.NODE_ENV }, `FlowMind server is running on port ${PORT}`);
});

// WebSocket 服务器
const wss = new WebSocketServer({ server, path: '/ws' });

const executionEngines = new Map<string, ExecutionEngine>();

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      logger.info({ type: data.type }, 'WebSocket message received');

      switch (data.type) {
        case 'execution.start': {
          const executionId = `exec_${Date.now()}`;
          const engine = new ExecutionEngine(executionId);
          engine.addWsClient(ws);
          executionEngines.set(executionId, engine);
          
          ws.send(JSON.stringify({
            type: 'execution.started',
            executionId,
          }));

          await engine.execute();
          break;
        }

        case 'execution.pause': {
          const engine = executionEngines.get(data.executionId);
          if (engine) {
            engine.pause();
          }
          break;
        }

        case 'execution.resume': {
          const engine = executionEngines.get(data.executionId);
          if (engine) {
            engine.resume();
          }
          break;
        }

        case 'execution.stop': {
          const engine = executionEngines.get(data.executionId);
          if (engine) {
            engine.stop();
          }
          break;
        }

        case 'execution.step': {
          const engine = executionEngines.get(data.executionId);
          if (engine) {
            engine.step();
          }
          break;
        }

        case 'breakpoint.set': {
          const engine = executionEngines.get(data.executionId);
          if (engine) {
            engine.setBreakpoint(data.nodeId);
          }
          break;
        }

        case 'breakpoint.remove': {
          const engine = executionEngines.get(data.executionId);
          if (engine) {
            engine.removeBreakpoint(data.nodeId);
          }
          break;
        }

        case 'confirm.response': {
          const engine = executionEngines.get(data.executionId);
          if (engine) {
            engine.resume();
          }
          break;
        }

        default:
          logger.warn({ type: data.type }, 'Unknown WebSocket message type');
      }
    } catch (error) {
      logger.error({ error }, 'WebSocket message handling failed');
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    logger.error({ error }, 'WebSocket error');
  });
});

export { server, wss };
