const jwt = require('jsonwebtoken');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { JWT_SECRET, PIXELPAY_KEY_ID, PIXELPAY_SECRET_KEY, PIXELPAY_SALE_URL, TIMEOUT_MS } = process.env;
  if (!JWT_SECRET || !PIXELPAY_KEY_ID || !PIXELPAY_SECRET_KEY || !PIXELPAY_SALE_URL) {
    return res.status(500).json({ error: 'ENV_MISSING' });
  }

  // Bearer <jwt>
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'MISSING_BEARER' });
  try { jwt.verify(m[1], JWT_SECRET); } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'MISSING_PAYLOAD' });

  const bodyStr = JSON.stringify(payload);
  const hash = crypto.createHmac('sha256', PIXELPAY_SECRET_KEY).update(bodyStr).digest('hex');

  try {
    const r = await fetch(PIXELPAY_SALE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-key': PIXELPAY_KEY_ID,
        'x-auth-hash': hash
      },
      body: bodyStr,
      signal: AbortSignal.timeout(parseInt(TIMEOUT_MS || '30000'))
    });

    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    return res.status(r.ok ? 200 : r.status).json(data || { raw: text });
  } catch (e) {
    return res.status(500).json({ error: 'SALE_FAILED', detail: String(e) });
  }
};