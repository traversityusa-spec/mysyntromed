import { describe, it, expect } from 'vitest';
import express from 'express';
import { createServer } from 'http';

describe('Health endpoint', () => {
  it('should return ok', async () => {
    const app = express();
    app.get('/health', (_req, res) => {
      res.json({ ok: true, service: 'backend', timestamp: new Date().toISOString() });
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe('backend');

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
