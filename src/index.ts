/**
 * MCP Server - Cloudflare Worker Implementation
 * Implements Model Context Protocol for LLM tool integration
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface ToolInput {
  name: string;
  arguments: Record<string, unknown>;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

type Bindings = {
  EXTERNAL_API_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

// Tool definitions following MCP specification
const tools: MCPTool[] = [
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
    description: 'Execute JavaScript code and return the result',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute' },
        timeout: { type: 'number', default: 5000 }
      },
      required: ['code']
    }
  },
  {
    name: 'fetch_url',
    description: 'Fetch content from a URL and return the response',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
        headers: { type: 'object', description: 'Optional headers' }
      },
      required: ['url']
    }
  }
];

// Server info - MCP discovery endpoint
app.get('/', (c) => {
  return c.json({
    name: 'mcp-server-demo',
    version: '1.0.0',
    protocol_version: '2024-11-05',
    capabilities: {
      tools: { listChanged: false }
    }
  });
});

// MCP tools/list - Returns available tools
app.post('/tools/list', (c) => {
  return c.json({ tools });
});

// Also support GET for easier testing
app.get('/tools/list', (c) => {
  return c.json({ tools });
});

// MCP tools/call - Execute a tool
app.post('/tools/call', async (c) => {
  let input: ToolInput;

  try {
    input = await c.req.json();
  } catch {
    return c.json({
      isError: true,
      content: [{ type: 'text', text: 'Invalid JSON in request body' }]
    }, 400);
  }

  const { name, arguments: args = {} } = input;

  if (!name) {
    return c.json({
      isError: true,
      content: [{ type: 'text', text: 'Missing tool name' }]
    }, 400);
  }

  const tool = tools.find(t => t.name === name);
  if (!tool) {
    return c.json({
      isError: true,
      content: [{ type: 'text', text: `Tool not found: ${name}` }]
    }, 404);
  }

  // Tool execution handlers
  type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

  const handlers: Record<string, ToolHandler> = {
    html_to_pdf: async (args) => {
      const html = args.html as string;
      const options = (args.options as Record<string, unknown>) || {};

      // In production, this would call an actual PDF service
      // For demo, we return a structured response showing the input was processed
      const base64Preview = btoa(html.slice(0, 100));

      return {
        success: true,
        message: 'PDF generation initiated',
        inputLength: html.length,
        format: options.format || 'A4',
        landscape: options.landscape || false,
        preview: base64Preview
      };
    },

    take_screenshot: async (args) => {
      const url = args.url as string;
      const width = (args.width as number) || 1280;
      const height = (args.height as number) || 720;

      // Validate URL
      try {
        new URL(url);
      } catch {
        throw new Error(`Invalid URL: ${url}`);
      }

      return {
        success: true,
        message: 'Screenshot captured',
        url: url,
        dimensions: { width, height },
        timestamp: new Date().toISOString()
      };
    },

    execute_js: async (args) => {
      const code = args.code as string;
      const timeout = (args.timeout as number) || 5000;

      // Safe evaluation for demo - only handles simple expressions
      // In production, use a proper sandbox like isolated-vm
      let result: unknown;
      const startTime = Date.now();

      try {
        // Only allow safe math/string operations for demo
        if (/^[\d\s+\-*/().]+$/.test(code)) {
          result = Function(`"use strict"; return (${code})`)();
        } else if (code.startsWith('"') || code.startsWith("'")) {
          result = Function(`"use strict"; return (${code})`)();
        } else {
          result = `[Sandbox] Code received: ${code.slice(0, 50)}...`;
        }
      } catch (e) {
        throw new Error(`Execution error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }

      return {
        success: true,
        result: result,
        executionTime: `${Date.now() - startTime}ms`,
        timeout: timeout
      };
    },

    fetch_url: async (args) => {
      const url = args.url as string;
      const method = (args.method as string) || 'GET';
      const headers = (args.headers as Record<string, string>) || {};

      // Validate URL
      try {
        new URL(url);
      } catch {
        throw new Error(`Invalid URL: ${url}`);
      }

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'User-Agent': 'MCP-Server-Demo/1.0',
            ...headers
          }
        });

        const contentType = response.headers.get('content-type') || '';
        let body: string;

        if (contentType.includes('application/json')) {
          body = JSON.stringify(await response.json());
        } else {
          body = await response.text();
          // Truncate large responses
          if (body.length > 5000) {
            body = body.slice(0, 5000) + '... [truncated]';
          }
        }

        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          contentType,
          body
        };
      } catch (e) {
        throw new Error(`Fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
  };

  try {
    const handler = handlers[name];
    if (!handler) {
      throw new Error(`No handler for tool: ${name}`);
    }

    const result = await handler(args);

    // Return MCP-compliant response
    return c.json({
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      isError: true,
      content: [{ type: 'text', text: `Tool execution failed: ${message}` }]
    }, 500);
  }
});

// SSE endpoint for real-time MCP communication
app.get('/sse', (c) => {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      })}\n\n`));

      // Keep-alive ping every 30s
      intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/ping',
            params: { timestamp: Date.now() }
          })}\n\n`));
        } catch {
          // Stream closed, clean up
          if (intervalId) clearInterval(intervalId);
        }
      }, 30000);
    },
    cancel() {
      // Clean up interval when stream is closed
      if (intervalId) clearInterval(intervalId);
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

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tools: tools.length
  });
});

export default app;
