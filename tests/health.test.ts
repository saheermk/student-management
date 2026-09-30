import { describe, it, expect } from 'vitest';
import app from '../src/worker/index';

describe('Health API Endpoint', () => {
  it('GET /api/health returns 200 OK with health schema', async () => {
    const res = await app.request('/api/health', {}, {
      ENVIRONMENT: 'test',
    } as any);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; timestamp: string; environment: string };
    expect(data.status).toBe('ok');
    expect(data.environment).toBe('test');
    expect(typeof data.timestamp).toBe('string');
  });
});
