import OpenAI from 'openai';
import { config } from './config.js';
import { getState, mutateState, encryptText, decryptText } from './db.js';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const SUPPORTED = new Set(['openai', 'gemini']);

function hostAllowed(url, domains = []) {
  if (!domains.length) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some(domain => host === String(domain).toLowerCase() || host.endsWith(`.${String(domain).toLowerCase()}`));
  } catch { return false; }
}

function geminiText(body) {
  return (body?.candidates?.[0]?.content?.parts || []).map(part => part?.text || '').join('').trim();
}

function geminiSources(body, allowedDomains = []) {
  const chunks = body?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web?.uri || seen.has(web.uri) || !hostAllowed(web.uri, allowedDomains)) continue;
    seen.add(web.uri);
    sources.push({ url: web.uri, title: web.title || web.uri, type: 'web_source' });
  }
  return sources;
}

function createGeminiClient(apiKey, defaultModel = 'gemini-2.5-flash') {
  if (!apiKey) return null;
  return {
    provider: 'gemini',
    responses: {
      async create(args = {}) {
        const requestedModel = String(args.model || defaultModel);
        const model = requestedModel.startsWith('gemini-') ? requestedModel : defaultModel;
        const webTool = (args.tools || []).find(tool => tool?.type === 'web_search');
        const allowedDomains = webTool?.filters?.allowed_domains || [];
        let prompt = String(args.input || '');
        if (webTool && allowedDomains.length) {
          prompt = `AUTHORITATIVE-DOMAIN CONTROL: Use Google Search only for sources on these domains: ${allowedDomains.join(', ')}. Do not rely on other web domains for the legal conclusion. If those domains do not establish the point, say it is not verified.\n\n${prompt}`;
        }
        const wantsJson = /valid JSON object|Return JSON keys|JSON object only|one valid JSON/i.test(prompt);
        const payload = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: Math.max(64, Math.min(65536, Number(args.max_output_tokens || 5000))),
            ...(wantsJson ? { responseMimeType: 'application/json' } : {})
          },
          ...(webTool ? { tools: [{ google_search: {} }] } : {})
        };
        const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(90000)
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = body?.error?.message || `Gemini API returned HTTP ${response.status}`;
          throw Object.assign(new Error(message), { status: response.status, provider: 'gemini' });
        }
        const outputText = geminiText(body);
        const sources = geminiSources(body, allowedDomains);
        return {
          output_text: outputText,
          output: webTool ? [{ type: 'web_search_call', action: { sources } }] : [],
          provider: 'gemini',
          model,
          raw: body
        };
      }
    }
  };
}

function createOpenAIClient(apiKey) {
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey, timeout: 90000, maxRetries: 1 });
  client.provider = 'openai';
  return client;
}

function publicProfile(profile = {}) {
  return {
    provider: profile.provider || 'none',
    configured: Boolean(profile.configured),
    model: profile.model || null,
    liveModel: profile.liveModel || null,
    configuredAt: profile.configuredAt || null,
    configuredBy: profile.configuredBy || null,
    source: profile.source || null,
    privacyMode: profile.privacyMode || null,
    lastTest: profile.lastTest || null
  };
}

export async function getProviderProfile(orgId) {
  const state = await getState(orgId);
  const saved = state.aiProvider || null;
  if (saved?.provider && saved?.encryptedApiKey) {
    return publicProfile({ ...saved, configured: true, source: 'encrypted institutional provider configuration' });
  }
  if (config.openaiKey) {
    return publicProfile({
      provider: 'openai', configured: true, model: config.openaiModel, liveModel: config.openaiLiveModel,
      source: 'server environment', privacyMode: 'provider-account-terms'
    });
  }
  return publicProfile({ provider: 'none', configured: false, source: 'none' });
}

export async function resolveProvider(orgId) {
  const state = await getState(orgId);
  const saved = state.aiProvider || null;
  if (saved?.provider && saved?.encryptedApiKey) {
    const key = decryptText(saved.encryptedApiKey);
    if (saved.provider === 'gemini') {
      const model = saved.model || 'gemini-2.5-flash';
      const liveModel = saved.liveModel || model;
      return { client: createGeminiClient(key, model), provider: 'gemini', model, liveModel, profile: publicProfile({ ...saved, configured: true, source: 'encrypted institutional provider configuration' }) };
    }
    if (saved.provider === 'openai') {
      const model = saved.model || config.openaiModel;
      const liveModel = saved.liveModel || model;
      return { client: createOpenAIClient(key), provider: 'openai', model, liveModel, profile: publicProfile({ ...saved, configured: true, source: 'encrypted institutional provider configuration' }) };
    }
  }
  if (config.openaiKey) {
    return { client: createOpenAIClient(config.openaiKey), provider: 'openai', model: config.openaiModel, liveModel: config.openaiLiveModel, profile: await getProviderProfile(orgId) };
  }
  return { client: null, provider: 'none', model: null, liveModel: null, profile: await getProviderProfile(orgId) };
}

export async function testProvider({ provider, apiKey, model, liveModel }) {
  if (!SUPPORTED.has(provider)) throw Object.assign(new Error('Supported providers are OpenAI and Gemini.'), { status: 400 });
  const client = provider === 'gemini' ? createGeminiClient(apiKey, model) : createOpenAIClient(apiKey);
  if (!client) throw Object.assign(new Error('API key is required.'), { status: 400 });
  const neural = await client.responses.create({ model, max_output_tokens: 32, input: 'Return exactly SYNESIS_PROVIDER_OK.' });
  if (!String(neural.output_text || '').includes('SYNESIS_PROVIDER_OK')) throw Object.assign(new Error('Provider returned an unexpected connectivity response.'), { status: 502 });
  let research = { status: 'not-tested', citationCount: 0 };
  try {
    const result = await client.responses.create({
      model: liveModel || model,
      max_output_tokens: 180,
      tools: [{ type: 'web_search', filters: { allowed_domains: ['rbi.org.in'] } }],
      input: 'Connectivity test only. Find one current official Reserve Bank of India source page on rbi.org.in and identify it briefly.'
    });
    const citationCount = result?.output?.[0]?.action?.sources?.length || 0;
    research = { status: citationCount ? 'pass' : 'no-authoritative-citation', citationCount };
  } catch (error) {
    research = { status: 'failed', citationCount: 0, error: String(error.message || error).slice(0, 240) };
  }
  return { neural: { status: 'pass' }, research };
}

export async function saveProviderProfile(orgId, user, body = {}) {
  const provider = String(body.provider || '').toLowerCase();
  if (!SUPPORTED.has(provider)) throw Object.assign(new Error('Choose OpenAI or Gemini.'), { status: 400 });
  const state = await getState(orgId);
  const existing = state.aiProvider || {};
  const apiKey = String(body.apiKey || '').trim();
  const encryptedApiKey = apiKey ? encryptText(apiKey) : existing.provider === provider ? existing.encryptedApiKey : '';
  if (!encryptedApiKey) throw Object.assign(new Error('Enter the provider API key once. SYNESIS stores it encrypted server-side.'), { status: 400 });
  const model = String(body.model || (provider === 'gemini' ? 'gemini-2.5-flash' : config.openaiModel)).trim();
  const liveModel = String(body.liveModel || model).trim();
  const keyForTest = apiKey || decryptText(encryptedApiKey);
  const lastTest = await testProvider({ provider, apiKey: keyForTest, model, liveModel });
  const profile = {
    provider, encryptedApiKey, model, liveModel,
    configuredAt: new Date().toISOString(), configuredBy: user?.email || 'administrator',
    privacyMode: provider === 'gemini' ? String(body.privacyMode || 'Review Google AI Studio project/data terms before confidential production use.') : 'Provider-account-terms',
    lastTest
  };
  await mutateState(orgId, current => { current.aiProvider = profile; return current; });
  return publicProfile({ ...profile, configured: true, source: 'encrypted institutional provider configuration' });
}

export async function clearProviderProfile(orgId) {
  await mutateState(orgId, state => { delete state.aiProvider; return state; });
  return getProviderProfile(orgId);
}
