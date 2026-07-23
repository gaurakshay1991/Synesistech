import { Router } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const router = Router();

function createSynesisMcpServer() {
  const server = new McpServer(
    {
      name: 'synesistech',
      version: '4.3.1'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.registerTool(
    'synesis_status',
    {
      description: 'Return the operational status and public capabilities of the LIVE SYNESIS platform.',
      inputSchema: {}
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: true,
            product: 'LIVE SYNESIS',
            version: '4.3.1',
            capabilities: [
              'document analysis',
              'institutional review',
              'portfolio calculation',
              'mandate mapping',
              'regulatory impact analysis',
              'scenario simulation'
            ]
          })
        }
      ]
    })
  );

  return server;
}

function methodNotAllowed(res) {
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed.'
    },
    id: null
  });
}

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    product: 'LIVE SYNESIS',
    service: 'web-and-mcp',
    version: '4.3.1',
    time: new Date().toISOString()
  });
});

router.post('/mcp', async (req, res) => {
  const server = createSynesisMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  const close = () => {
    void transport.close().catch(error => console.error('MCP transport close failed:', error));
    void server.close().catch(error => console.error('MCP server close failed:', error));
  };

  res.once('close', close);

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
  }
});

router.get('/mcp', (req, res) => methodNotAllowed(res));
router.delete('/mcp', (req, res) => methodNotAllowed(res));

export default router;
