import OpenAI from 'openai';

function messageFor(e) {
  const msg = String(e?.message || '');
  if (e?.status === 429 || msg.includes('quota') || msg.includes('billing')) return 'API quota or billing is not active for this project. Update billing or replace the API key in Vercel environment variables.';
  return msg || 'Request failed.';
}

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    if (!client) return res.status(200).json({ output: 'API key is not configured in Vercel environment variables.', sources: [], checkedAt: new Date().toISOString(), demoMode: true });
    const prompt = `Prepare a concise legal note. Issue: ${body.issue || ''}. Facts: ${body.facts || ''}. Include position, risk, recommendation and open points.`;
    const r = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-5.5', input: prompt });
    res.status(200).json({ output: r.output_text || '', sources: [], checkedAt: new Date().toISOString(), demoMode: false });
  } catch (e) { res.status(200).json({ output: messageFor(e), sources: [], checkedAt: new Date().toISOString(), demoMode: true }); }
}
