import OpenAI from 'openai';
import { getVercelOidcToken } from '@vercel/oidc';

function gatewayModel(model = '') {
  const value = String(model || 'gpt-5-mini');
  return value.includes('/') ? value : `openai/${value}`;
}

function directModel(model = '') {
  const value = String(model || 'gpt-5-mini');
  return value.startsWith('openai/') ? value.slice('openai/'.length) : value;
}

export function createResilientAI({ directApiKey = '', timeout = 110000 } = {}) {
  const direct = directApiKey
    ? new OpenAI({ apiKey: directApiKey, timeout, maxRetries: 1 })
    : null;
  let lastProvider = 'not-used';

  async function gatewayClient() {
    const token = process.env.AI_GATEWAY_API_KEY || await getVercelOidcToken().catch(() => '');
    if (!token) return null;
    return new OpenAI({
      apiKey: token,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
      timeout,
      maxRetries: 1
    });
  }

  return {
    responses: {
      create: async parameters => {
        let gatewayError;
        const gateway = await gatewayClient();
        if (gateway) {
          try {
            const result = await gateway.responses.create({
              ...parameters,
              model: gatewayModel(parameters.model),
              store: false
            });
            lastProvider = 'vercel-ai-gateway';
            return result;
          } catch (error) {
            gatewayError = error;
            console.error('Vercel AI Gateway request failed:', error?.status || error?.code || error?.message);
          }
        }

        if (direct) {
          try {
            const result = await direct.responses.create({
              ...parameters,
              model: directModel(parameters.model),
              store: false
            });
            lastProvider = 'openai-direct';
            return result;
          } catch (error) {
            console.error('Direct OpenAI request failed:', error?.status || error?.code || error?.message);
            throw error;
          }
        }

        throw gatewayError || new Error('No AI provider is available for this request.');
      }
    },
    isConfigured: Boolean(directApiKey || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL),
    preferredProvider: process.env.VERCEL || process.env.AI_GATEWAY_API_KEY ? 'vercel-ai-gateway' : directApiKey ? 'openai-direct' : 'not-configured',
    getLastProvider: () => lastProvider
  };
}
