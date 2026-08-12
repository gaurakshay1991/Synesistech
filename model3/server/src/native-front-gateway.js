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

function authHeadersFromRequest(req) {
  const headers = {};
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  return headers;
}

async function sessionForRequest(req) {
  const response = await fetch(`http://127.0.0.1:${v8Port}/api/auth/session`, { headers: authHeadersFromRequest(req) });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  return body.user || null;
}

async function persistRegulatoryBaseline(req, documentId, impact) {
  const user = await sessionForRequest(req);
  if (!user?.organizationId || !impact) return { persisted: false };
  const [{ mutateState }, { resolveDocumentDrift }] = await Promise.all([import('./db.js'), import('./regulatory-drift.js')]);
  const revalidatedAt = new Date().toISOString();
  const noMaterialImpact = String(impact.overallImpact || '').toUpperCase() === 'NONE'
    && !impact.staleReferenceWarning
    && !(impact.requiredActions || []).length;
  const driftStatus = noMaterialImpact ? 'REVALIDATED_NO_IMPACT' : 'REVALIDATED_IMPACTED';
  await mutateState(user.organizationId, state => {
    state.regulatoryBaselines ||= {};
    state.regulatoryBaselines[documentId] = {
      documentId,
      impact,
      revalidatedAt,
      revalidatedBy: user.email,
      driftStatus,
      source: 'Fresh document regulatory-impact revalidation'
    };
    resolveDocumentDrift(state, documentId, {
      status: driftStatus,
      note: impact.executiveConclusion || impact.decisionEffect || `Fresh regulatory impact completed: ${impact.overallImpact || 'unassessed'}`,
      by: user.email
    });
    return state;
  });
  return { persisted: true, revalidatedAt, revalidatedBy: user.email, driftStatus };
}

async function overlayLatestRegulatoryBaseline(req, documentId, body) {
  const user = await sessionForRequest(req);
  if (!user?.organizationId || !body?.document) return body;
  const { getState } = await import('./db.js');
  const state = await getState(user.organizationId);
  const baseline = state.regulatoryBaselines?.[documentId];
  const openDrift = (state.regulatoryDrift || []).filter(item => item.documentId === documentId && item.status === 'REVALIDATION_REQUIRED');
  body.document.analysis ||= {};
  if (baseline?.impact) {
    body.document.analysis.regulatory_impact = baseline.impact;
    body.document.analysis.regulatory_revalidation = {
      source: baseline.source,
      revalidatedAt: baseline.revalidatedAt,
      revalidatedBy: baseline.revalidatedBy,
      driftStatus: baseline.driftStatus
    };
  }
  body.document.analysis.regulatory_drift = openDrift;
  body.document.analysis.regulatory_currentness = openDrift.length
    ? 'REVALIDATION_REQUIRED'
    : baseline?.revalidatedAt
      ? 'REVALIDATED'
      : 'UPLOAD_BASELINE';
  return body;
}

function copyResponseHeaders(upstreamRes, res) {
  const setCookie = upstreamRes.headers['set-cookie'];
  if (setCookie) res.setHeader('set-cookie', setCookie);
  for (const [key, value] of Object.entries(upstreamRes.headers)) {
    if (value === undefined || ['content-length', 'content-encoding', 'set-cookie'].includes(key.toLowerCase())) continue;
    res.setHeader(key, value);
  }
}

function proxy(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${v8Port}` };
  const pathname = String(req.url || '').split('?')[0];
  const documentMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
  const regulatoryMatch = pathname.match(/^\/api\/documents\/([^/]+)\/regulatory-impact$/);
  const isNativeAuth = String(req.headers['x-synesis-client'] || '').toLowerCase() === 'ios'
    && req.method === 'POST'
    && ['/api/auth/login', '/api/auth/change-password'].includes(pathname);
  const isDocumentRead = req.method === 'GET' && Boolean(documentMatch);
  const isRegulatoryRevalidation = req.method === 'POST' && Boolean(regulatoryMatch);
  const shouldBuffer = isNativeAuth || isDocumentRead || isRegulatoryRevalidation;

  const upstream = http.request({ hostname: '127.0.0.1', port: v8Port, path: req.url, method: req.method, headers }, upstreamRes => {
    if (!shouldBuffer) {
      res.statusCode = upstreamRes.statusCode || 502;
      for (const [key, value] of Object.entries(upstreamRes.headers)) if (value !== undefined) res.setHeader(key, value);
      upstreamRes.pipe(res);
      return;
    }

    const chunks = [];
    upstreamRes.on('data', chunk => chunks.push(chunk));
    upstreamRes.on('end', async () => {
      res.statusCode = upstreamRes.statusCode || 502;
      copyResponseHeaders(upstreamRes, res);
      const raw = Buffer.concat(chunks).toString('utf8');
      if ((upstreamRes.statusCode || 500) >= 400) {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        return res.end(raw || JSON.stringify({ error: 'Request failed.' }));
      }

      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; }
      catch {
        res.setHeader('content-type', upstreamRes.headers['content-type'] || 'text/plain; charset=utf-8');
        return res.end(raw);
      }

      try {
        if (isNativeAuth) {
          const token = extractSessionToken(upstreamRes.headers['set-cookie'] || '');
          if (token) body.accessToken = token;
        }
        if (isRegulatoryRevalidation && regulatoryMatch?.[1] && body.regulatoryImpact?.status === 'COMPLETE') {
          body.revalidation = await persistRegulatoryBaseline(req, regulatoryMatch[1], body.regulatoryImpact);
        }
        if (isDocumentRead && documentMatch?.[1]) {
          body = await overlayLatestRegulatoryBaseline(req, documentMatch[1], body);
        }
      } catch (error) {
        body.gatewayWarning = `Post-processing incomplete: ${String(error.message || error).slice(0, 240)}`;
      }

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
