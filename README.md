# MCP Server Demo

A minimal Model Context Protocol (MCP) server implementation for integrating custom tools with LLMs like Claude and ChatGPT.

## Features

- 🔧 Tool registration and execution
- 📡 SSE transport for real-time communication
- ☁️ Cloudflare Worker deployment ready
- 🔗 Compatible with n8n, LangChain, and OpenAI function calling

## Quick Start

```bash
npm install
npm run dev
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  MCP Server │────▶│   Tools     │
│  (Claude)   │◀────│  (Worker)   │◀────│  (APIs)     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Available Tools

| Tool | Description |
|------|-------------|
| `html_to_pdf` | Convert HTML to PDF |
| `take_screenshot` | Capture webpage screenshot |
| `execute_js` | Run JavaScript safely |

## Endpoints

- `GET /` - Server info
- `GET /sse` - SSE connection for MCP
- `POST /tools/list` - List available tools
- `POST /tools/call` - Execute a tool

## Deployment

### Cloudflare Workers

```bash
wrangler publish
```

### Docker

```bash
docker build -t mcp-server .
docker run -p 3000:3000 mcp-server
```

## Integration Examples

### n8n + OpenAI

1. Register MCP endpoint as OpenAI tool
2. Configure tool schema from `/tools/list`
3. Route tool calls to `/tools/call`

### LangChain

```python
from langchain.tools import MCPTool

tool = MCPTool(endpoint="https://your-mcp-server.workers.dev")
```

## License

MIT
