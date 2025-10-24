const { sign } = require('../_utils/token');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { AUTH_EMAIL, AUTH_PASSWORD, JWT_SECRET } = process.env;
  if (!AUTH_EMAIL || !AUTH_PASSWORD || !JWT_SECRET) {
    res.status(500).json({ error: 'ENV_MISSING', missing: ['AUTH_EMAIL','AUTH_PASSWORD','JWT_SECRET'] });
    return;
  }

  try {
    // leer body
    let raw = '';
    await new Promise((resolve, reject) => {
      req.on('data', c => (raw += c));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const { email, password } = raw ? JSON.parse(raw) : {};

    if (!email || !password) { res.status(400).json({ error: 'MISSING_CREDENTIALS' }); return; }
    if (email !== AUTH_EMAIL || password !== AUTH_PASSWORD) { res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return; }

    const token = sign({ sub: email, scope: 'payments' }, JWT_SECRET, 600); // 10 min
    res.status(200).json({ token, expires_in: 600 });
  } catch (e) {
    res.status(500).json({ error: 'LOGIN_FAILED', detail: String(e) });
  }
};