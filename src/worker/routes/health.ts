import { Hono } from 'hono';
import { HealthResponse } from '../../shared/schemas';
import { Env } from '../types';

const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get('/', (c) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development',
  };
  return c.json(response);
});

export default healthRouter;
