export default function handler(req, res) {
  res.status(200).json({ token: 'synesis-private-demo', user: { email: 'admin@synesis.local', role: 'admin' } });
}
