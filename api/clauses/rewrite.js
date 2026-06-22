import OpenAI from 'openai';

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    if (!client) return res.status(200).json({ output: 'OpenAI is not configured in Vercel environment variables.', sources: [], checkedAt: new Date().toISOString(), demoMode: true });
    const prompt = `Rewrite the clause in a ${body.stance || 'balanced but firm'} legal style. Provide revised clause, rationale and negotiation fallback. Clause: ${body.clause || ''}`;
    const r = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-5.5', input: prompt });
    res.status(200).json({ output: r.output_text || '', sources: [], checkedAt: new Date().toISOString(), demoMode: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
