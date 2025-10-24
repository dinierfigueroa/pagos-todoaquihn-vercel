const jwt = require('jsonwebtoken');
const readJson = require('../_utils/readJson');
const setCors = require('../_utils/cors');

module.exports = async function handler(req, res) {
  if (setCors(res, req)) return;

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
    const body = await readJson(req); // <- AHORA sí leemos el JSON
    const { email, password } = body || {};
    if (!email || !password) { res.status(400).json({ error: 'MISSING_CREDENTIALS' }); return; }
    if (email !== AUTH_EMAIL || password !== AUTH_PASSWORD) { res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return; }

    const token = jwt.sign({ sub: email, scope: 'payments' }, JWT_SECRET, { expiresIn: '10m' });
    res.status(200).json({ token, expires_in: 600 });
  } catch (e) {
    const isInvalidJson = String(e).includes('INVALID_JSON');
    res.status(isInvalidJson ? 400 : 500).json({ error: isInvalidJson ? 'INVALID_JSON' : 'LOGIN_FAILED', detail: String(e) });
  }
};
