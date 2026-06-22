import OpenAI from 'openai';

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    if (!client) return res.status(200).json({ output: 'OpenAI is not configured in Vercel environment variables.', sources: [], checkedAt: new Date().toISOString(), demoMode: true });
    const prompt = `You are Synesis, a private lawyer-supervised LegalTech platform. Prefer official Indian legal and regulatory sources. Give direct answer, legal basis, analysis, risk rating, action points, open issues, checked date and lawyer-review flag. Question: ${body.query || ''}`;
    const r = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-5.5', tools: [{ type: 'web_search' }], input: prompt });
    res.status(200).json({ output: r.output_text || '', sources: [], checkedAt: new Date().toISOString(), demoMode: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
