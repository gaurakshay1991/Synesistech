import Constants from 'expo-constants';

const configured = Constants.expoConfig?.extra?.apiBaseUrl;
export const API_BASE = String(configured || 'https://synesis-new-model-3.onrender.com/api').replace(/\/$/, '');

async function parseResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let body = {};
  try { body = text ? JSON.parse(text) : {}; }
  catch {
    if (contentType.includes('text/html')) {
      const error = new Error('A security gateway returned HTML instead of the SYNESIS API response.');
      error.code = 'HTML_GATEWAY_RESPONSE';
      error.status = response.status;
      throw error;
    }
    body = { error: text || `Request failed (${response.status})` };
  }
  if (!response.ok) {
    const error = new Error(body.error || body.detail || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = body;
    throw error;
  }
  return body;
}

export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers
  });
  return parseResponse(response);
}

export const AuthAPI = {
  login: (email, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  session: () => api('/auth/session'),
  logout: () => api('/auth/logout', { method: 'POST', body: '{}' }),
  changePassword: (currentPassword, newPassword) => api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
};

export const SynesisAPI = {
  bootstrap: () => api('/bootstrap'),
  document: id => api(`/documents/${id}`),
  askDocument: (id, question) => api(`/documents/${id}/ask`, { method: 'POST', body: JSON.stringify({ question }) }),
  exposure: id => api(`/documents/${id}/exposure`, { method: 'POST', body: JSON.stringify({ live: true }) }),
  liveStatus: () => api('/live/status'),
  liveAsk: payload => api('/live/ask', { method: 'POST', body: JSON.stringify(payload) }),
  controlPlane: () => api('/cognitive/control-plane'),
  cognitiveRun: payload => api('/cognitive/run', { method: 'POST', body: JSON.stringify(payload) }),
  analyzeDocument: async ({ asset, title, matter, documentType = 'Auto-detect', jurisdiction = 'India', riskAppetite = 'Conservative', analysisMode = 'Deep', objective }) => {
    const form = new FormData();
    if (asset) form.append('file', { uri: asset.uri, name: asset.name || 'document', type: asset.mimeType || 'application/octet-stream' });
    form.append('title', title || '');
    form.append('matter', matter || '');
    form.append('documentType', documentType);
    form.append('jurisdiction', jurisdiction);
    form.append('riskAppetite', riskAppetite);
    form.append('analysisMode', analysisMode);
    form.append('objective', objective || 'Identify material legal, regulatory, operational and commercial risks; current-law impact; obligations; controls; exposure; decision points and governed actions.');
    return api('/documents/analyze', { method: 'POST', body: form });
  }
};
