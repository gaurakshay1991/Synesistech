import OpenAI from 'openai';

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    if (!client) return res.status(200).json({ output: 'OpenAI is not configured in Vercel environment variables.', sources: [], checkedAt: new Date().toISOString(), demoMode: true });
    const prompt = `You are Synesis. Review this agreement for a bank or corporate legal team. Return red flags, clause table, missing protections, suggested drafting and final sign-off position. Text: ${String(body.text || '').slice(0, 45000)}`;
    const r = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-5.5', tools: [{ type: 'web_search' }], input: prompt });
    res.status(200).json({ output: r.output_text || '', sources: [], checkedAt: new Date().toISOString(), demoMode: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
