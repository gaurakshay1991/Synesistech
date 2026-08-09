import http from 'node:http';

const externalPort = Number(process.env.PORT || 3000);
const v8Port = externalPort + 20 <= 65534 ? externalPort + 20 : externalPort - 20;
process.env.PORT = String(v8Port);
await import('./product-gateway-v8.js');
process.env.PORT = String(externalPort);

const SESSION_COOKIE = 'synesis_model3_session';

function extractSessionToken(setCookieHeader = '') {
  const source = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : String(setCookieHeader || '');
  const match = source.match(new RegExp(`(?:^|[,;]\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function proxy(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${v8Port}` };
  const upstream = http.request({ hostname: '127.0.0.1', port: v8Port, path: req.url, method: req.method, headers }, upstreamRes => {
    const isNativeAuth = String(req.headers['x-synesis-client'] || '').toLowerCase() === 'ios'
      && req.method === 'POST'
      && ['/api/auth/login', '/api/auth/change-password'].includes(String(req.url || '').split('?')[0]);

    if (!isNativeAuth) {
      res.statusCode = upstreamRes.statusCode || 502;
      for (const [key, value] of Object.entries(upstreamRes.headers)) if (value !== undefined) res.setHeader(key, value);
      upstreamRes.pipe(res);
      return;
    }

    const chunks = [];
    upstreamRes.on('data', chunk => chunks.push(chunk));
    upstreamRes.on('end', () => {
      res.statusCode = upstreamRes.statusCode || 502;
      const setCookie = upstreamRes.headers['set-cookie'];
      if (setCookie) res.setHeader('set-cookie', setCookie);
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (value === undefined || ['content-length', 'content-encoding', 'set-cookie'].includes(key.toLowerCase())) continue;
        res.setHeader(key, value);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if ((upstreamRes.statusCode || 500) >= 400) {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        return res.end(raw || JSON.stringify({ error: 'Authentication failed.' }));
      }
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { error: 'Invalid authentication response.' }; }
      const token = extractSessionToken(setCookie || '');
      if (token) body.accessToken = token;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    });
  });
  upstream.on('error', error => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'SYNESIS application gateway unavailable.', detail: process.env.NODE_ENV === 'production' ? undefined : error.message }));
    } else res.end();
  });
  req.pipe(upstream);
}

const server = http.createServer(proxy);
server.listen(externalPort, '0.0.0.0', () => {
  console.log(`SYNESIS public gateway listening on ${externalPort}; v8 intelligence workbench on loopback:${v8Port}`);
});
