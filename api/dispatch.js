import aiApp from './ai.js';

const paths = {
  analyze: '/api/public/analyze',
  ask: '/api/public/ask',
  health: '/api/health/ai',
  smoke: '/api/health/ai-smoke-20260720'
};

export default function dispatch(req, res) {
  const operation = String(req.query?.operation || '');
  const path = paths[operation];
  if (!path) return res.status(404).json({ error: 'Unknown AI operation.' });
  req.url = path;
  return aiApp(req, res);
}
