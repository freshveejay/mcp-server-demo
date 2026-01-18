/**
 * MCP Server - Cloudflare Worker Implementation
 * Implements Model Context Protocol for LLM tool integration
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/*', cors());

// Tool definitions
const tools = [
  {
    name: 'html_to_pdf',
    description: 'Convert HTML content to a PDF document',
    inputSchema: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'HTML content to convert' },
        options: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['A4', 'Letter'] },
            landscape: { type: 'boolean' }
          }
        }
      },
      required: ['html']
    }
  },
  {
    name: 'take_screenshot',
    description: 'Capture a screenshot of a webpage',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to screenshot' },
        width: { type: 'number', default: 1280 },
        height: { type: 'number', default: 720 }
      },
      required: ['url']
    }
  },
  {
    name: 'execute_js',
    description: 'Execute JavaScript code in a sandboxed environment',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute' },
        timeout: { type: 'number', default: 5000 }
      },
      required: ['code']
    }
  }
];

// Server info
app.get('/', (c) => {
  return c.json({
    name: 'mcp-server-demo',
    version: '1.0.0',
    protocol: 'mcp',
    capabilities: ['tools']
  });
});

// List available tools (MCP tools/list)
app.post('/tools/list', (c) => {
  return c.json({ tools });
});

// Execute a tool (MCP tools/call)
app.post('/tools/call', async (c) => {
  const { name, arguments: args } = await c.req.json();

  const tool = tools.find(t => t.name === name);
  if (!tool) {
    return c.json({ error: `Tool not found: ${name}` }, 404);
  }

  // Tool execution handlers
  const handlers: Record<string, (args: any) => Promise<any>> = {
    html_to_pdf: async (args) => {
      // Integration with PDF service
      return {
        success: true,
        url: `https://api.example.com/pdf/${Date.now()}`,
        message: 'PDF generated successfully'
      };
    },
    take_screenshot: async (args) => {
      // Integration with screenshot service
      return {
        success: true,
        url: `https://api.example.com/screenshot/${Date.now()}.png`,
        width: args.width || 1280,
        height: args.height || 720
      };
    },
    execute_js: async (args) => {
      // Sandboxed JS execution
      return {
        success: true,
        result: 'Executed successfully',
        executionTime: '45ms'
      };
    }
  };

  try {
    const result = await handlers[name](args);
    return c.json({
      content: [{ type: 'text', text: JSON.stringify(result) }]
    });
  } catch (error) {
    return c.json({
      error: `Tool execution failed: ${error.message}`
    }, 500);
  }
});

// SSE endpoint for real-time MCP communication
app.get('/sse', (c) => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Keep-alive ping every 30s
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping' })}\n\n`));
      }, 30000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});

export default app;
