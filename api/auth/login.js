const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { AUTH_EMAIL, AUTH_PASSWORD, JWT_SECRET } = process.env;
  if (!AUTH_EMAIL || !AUTH_PASSWORD || !JWT_SECRET) {
    return res.status(500).json({ error: 'ENV_MISSING', missing: ['AUTH_EMAIL','AUTH_PASSWORD','JWT_SECRET'] });
  }

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'MISSING_CREDENTIALS' });
  if (email !== AUTH_EMAIL || password !== AUTH_PASSWORD) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const token = jwt.sign({ sub: email, scope: 'payments' }, JWT_SECRET, { expiresIn: '10m' });
  return res.status(200).json({ token, expires_in: 600 });
};