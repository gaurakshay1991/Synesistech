import http from 'node:http';

const externalPort = Number(process.env.PORT || 3000);
const innerPort = externalPort + 40 <= 65534 ? externalPort + 40 : externalPort - 40;
process.env.PORT = String(innerPort);
await import('./native-front-gateway.js');
process.env.PORT = String(externalPort);

const product = await import('./product-intelligence.js');

function requestHeaders(req) {
  const headers = { ...req.headers, host: `127.0.0.1:${innerPort}` };
  const publicHost = req.headers['x-forwarded-host'] || req.headers.host;
  if (publicHost) headers['x-forwarded-host'] = publicHost;
  return headers;
}

function copyHeaders(upstreamRes, res, { omitLength = false } = {}) {
  for (const [key, value] of Object.entries(upstreamRes.headers)) {
    if (value === undefined) continue;
    if (omitLength && ['content-length', 'content-encoding'].includes(key.toLowerCase())) continue;
    res.setHeader(key, value);
  }
}

function fetchInner(pathname, req) {
  return new Promise((resolve, reject) => {
    const upstream = http.request({
      hostname: '127.0.0.1',
      port: innerPort,
      path: pathname,
      method: 'GET',
      headers: requestHeaders(req)
    }, upstreamRes => {
      const chunks = [];
      upstreamRes.on('data', chunk => chunks.push(chunk));
      upstreamRes.on('end', () => resolve({
        status: upstreamRes.statusCode || 502,
        headers: upstreamRes.headers,
        body: Buffer.concat(chunks)
      }));
    });
    upstream.on('error', reject);
    upstream.end();
  });
}

async function resilientGraph(req, res, documentId) {
  try {
    const primary = await fetchInner(req.url, req);
    if (primary.status < 400) {
      res.statusCode = primary.status;
      copyHeaders({ headers: primary.headers }, res);
      return res.end(primary.body);
    }

    console.warn(`[SYNESIS route fallback] GET ${req.url} returned ${primary.status}; rebuilding graph from stored analysis without source-text decryption.`);
    const documentResult = await fetchInner(`/api/documents/${encodeURIComponent(documentId)}`, req);
    if (documentResult.status >= 400) {
      console.error(`[SYNESIS route failure] GET /api/documents/${documentId} returned ${documentResult.status} while recovering graph.`);
      res.statusCode = primary.status;
      copyHeaders({ headers: primary.headers }, res);
      return res.end(primary.body);
    }

    let parsed;
    try { parsed = JSON.parse(documentResult.body.toString('utf8')); }
    catch { parsed = {}; }
    const document = parsed?.document;
    if (!document) {
      res.statusCode = primary.status;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Matter graph unavailable because the matter record could not be reconstructed.' }));
    }

    const body = {
      graph: product.buildDocumentGraph(document),
      clauseMemory: product.buildClauseMemory(document),
      degraded: true,
      warning: 'Graph rebuilt from the stored document analysis because encrypted source-text retrieval was unavailable. Matter analysis remains usable.'
    };
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify(body));
  } catch (error) {
    console.error(`[SYNESIS route failure] GET ${req.url}: ${String(error?.message || error).slice(0, 500)}`);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Matter graph temporarily unavailable. The matter itself can still be reviewed.' }));
  }
}

function proxy(req, res) {
  const pathname = String(req.url || '').split('?')[0];
  const graphMatch = req.method === 'GET' && pathname.match(/^\/api\/documents\/([^/]+)\/graph$/);
  if (graphMatch) return resilientGraph(req, res, decodeURIComponent(graphMatch[1]));

  const upstream = http.request({
    hostname: '127.0.0.1',
    port: innerPort,
    path: req.url,
    method: req.method,
    headers: requestHeaders(req)
  }, upstreamRes => {
    res.statusCode = upstreamRes.statusCode || 502;
    copyHeaders(upstreamRes, res);
    if ((upstreamRes.statusCode || 500) >= 400 && pathname.startsWith('/api/')) {
      console.warn(`[SYNESIS route response] ${req.method} ${pathname} -> ${upstreamRes.statusCode}`);
    }
    upstreamRes.pipe(res);
  });

  upstream.on('error', error => {
    console.error(`[SYNESIS gateway failure] ${req.method} ${pathname}: ${String(error?.message || error).slice(0, 500)}`);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'SYNESIS matter runtime is temporarily unavailable.' }));
    } else res.end();
  });
  req.pipe(upstream);
}

const server = http.createServer(proxy);
server.listen(externalPort, '0.0.0.0', () => {
  console.log(`SYNESIS resilient production gateway listening on ${externalPort}; native/public gateway on loopback:${innerPort}`);
});
