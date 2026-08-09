import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const configured = Constants.expoConfig?.extra?.apiBaseUrl;
export const API_BASE = String(configured || 'https://synesis-new-model-3.onrender.com/api').replace(/\/$/, '');
const TOKEN_KEY = 'synesis.ios.access-token';
let memoryToken: string | null = null;

export type SynesisUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
};

export class ApiError extends Error {
  status?: number;
  data?: any;
  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function token() {
  if (memoryToken) return memoryToken;
  memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return memoryToken;
}

export async function storeToken(value: string | null) {
  memoryToken = value;
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function parse(response: Response) {
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; }
  catch { body = { error: text || `Request failed (${response.status})` }; }
  if (!response.ok) throw new ApiError(body.error || body.detail || `Request failed (${response.status})`, response.status, body);
  return body;
}

export async function api(path: string, options: RequestInit = {}) {
  const bearer = await token();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Synesis-Client': 'ios',
    ...((options.headers as Record<string, string>) || {})
  };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options, headers });
    return await parse(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) await storeToken(null);
    throw error;
  }
}

export const AuthAPI = {
  async login(email: string, password: string) {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, client: 'ios' }) });
    if (data.accessToken) await storeToken(data.accessToken);
    return data as { user: SynesisUser; accessToken?: string };
  },
  session: () => api('/auth/session') as Promise<{ user: SynesisUser }>,
  async logout() {
    try { await api('/auth/logout', { method: 'POST', body: '{}' }); } finally { await storeToken(null); }
  },
  async changePassword(currentPassword: string, newPassword: string) {
    const data = await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword, client: 'ios' }) });
    if (data.accessToken) await storeToken(data.accessToken);
    return data as { user: SynesisUser; accessToken?: string };
  }
};

export type UploadAsset = { uri: string; name: string; mimeType?: string | null };

export const SynesisAPI = {
  productHealth: () => api('/product-v8/health'),
  bootstrap: () => api('/bootstrap'),
  documents: () => api('/documents'),
  document: (id: string) => api(`/documents/${id}`),
  documentGraph: (id: string) => api(`/documents/${id}/graph`),
  regulatoryImpact: (id: string) => api(`/documents/${id}/regulatory-impact`, { method: 'POST', body: '{}' }),
  liveStatus: () => api('/live/status'),
  controlPlane: () => api('/cognitive/control-plane'),
  cognitiveRun: (payload: any) => api('/cognitive/run', { method: 'POST', body: JSON.stringify(payload) }),
  exposure: (id: string) => api(`/documents/${id}/exposure`, { method: 'POST', body: JSON.stringify({ live: true }) }),
  askDocument: (id: string, question: string) => api(`/documents/${id}/ask`, { method: 'POST', body: JSON.stringify({ question }) }),
  decisionPack: (id: string, objective?: string) => api(`/documents/${id}/decision-pack`, { method: 'POST', body: JSON.stringify({ objective: objective || 'Can this matter be cleared? Separate must-fix, worth-raising, acceptable and let-go points, including regulatory and compliance blockers.' }) }),
  findingActionPack: (documentId: string, findingId: string, instruction = '') => api(`/documents/${documentId}/findings/${encodeURIComponent(findingId)}/action-pack`, { method: 'POST', body: JSON.stringify({ instruction }) }),
  saveClauseMemory: (documentId: string, findingId: string, actionPack: any) => api(`/documents/${documentId}/findings/${encodeURIComponent(findingId)}/memory`, { method: 'POST', body: JSON.stringify({ actionPack }) }),
  patchTask: (id: string, status: string) => api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  async analyzeDocument(input: { asset?: UploadAsset | null; text?: string; title?: string; matter?: string; jurisdiction?: string; documentType?: string; analysisMode?: string; riskAppetite?: string; objective?: string }) {
    const form = new FormData();
    if (input.asset) form.append('file', { uri: input.asset.uri, name: input.asset.name, type: input.asset.mimeType || 'application/octet-stream' } as any);
    form.append('text', input.text || '');
    form.append('title', input.title || '');
    form.append('matter', input.matter || '');
    form.append('jurisdiction', input.jurisdiction || 'India');
    form.append('documentType', input.documentType || 'Auto-detect');
    form.append('analysisMode', input.analysisMode || 'Live multipass');
    form.append('riskAppetite', input.riskAppetite || 'Conservative');
    form.append('objective', input.objective || 'Decide what is material, what can be accepted, what must be raised, whether cited law/circulars are current, identify omitted applicable authority, quantify defensible exposure, mitigate regulatory/compliance risk and draft exact wording.');
    return api('/documents/analyze', { method: 'POST', body: form });
  }
};
