export default function handler(req, res) {
  res.status(200).json({ audit: [{ at: new Date().toISOString(), action: 'audit.view', note: 'Serverless demo audit is ephemeral. Add database-backed audit before institutional use.' }] });
}
