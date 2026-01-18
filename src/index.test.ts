import { describe, it, expect } from 'vitest';
import app from './index';

describe('MCP Server', () => {
  it('returns server info on GET /', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.name).toBe('mcp-server-demo');
    expect(data.capabilities.tools).toBeDefined();
  });

  it('returns tools list on POST /tools/list', async () => {
    const res = await app.request('/tools/list', { method: 'POST' });
    expect(res.status).toBe(200);

    const data = await res.json() as { tools: Array<{ name: string }> };
    expect(data.tools).toBeInstanceOf(Array);
    expect(data.tools.length).toBeGreaterThan(0);
    expect(data.tools.some(t => t.name === 'html_to_pdf')).toBe(true);
  });

  it('executes execute_js tool with math expression', async () => {
    const res = await app.request('/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'execute_js',
        arguments: { code: '2 + 2' }
      })
    });

    expect(res.status).toBe(200);

    const data = await res.json() as { content: Array<{ text: string }> };
    expect(data.content).toBeDefined();
    expect(data.content[0].type).toBe('text');

    const result = JSON.parse(data.content[0].text);
    expect(result.success).toBe(true);
    expect(result.result).toBe(4);
  });

  it('returns error for unknown tool', async () => {
    const res = await app.request('/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'nonexistent_tool',
        arguments: {}
      })
    });

    expect(res.status).toBe(404);

    const data = await res.json() as { isError: boolean };
    expect(data.isError).toBe(true);
  });

  it('handles html_to_pdf tool', async () => {
    const res = await app.request('/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'html_to_pdf',
        arguments: {
          html: '<h1>Test</h1>',
          options: { format: 'A4' }
        }
      })
    });

    expect(res.status).toBe(200);

    const data = await res.json() as { content: Array<{ text: string }> };
    const result = JSON.parse(data.content[0].text);
    expect(result.success).toBe(true);
    expect(result.format).toBe('A4');
  });

  it('validates URL in take_screenshot', async () => {
    const res = await app.request('/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'take_screenshot',
        arguments: { url: 'not-a-valid-url' }
      })
    });

    expect(res.status).toBe(500);

    const data = await res.json() as { isError: boolean };
    expect(data.isError).toBe(true);
  });

  it('returns health status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const data = await res.json() as { status: string; tools: number };
    expect(data.status).toBe('healthy');
    expect(data.tools).toBeGreaterThan(0);
  });
});
