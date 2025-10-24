const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const readJson = require('../_utils/readJson');
const setCors = require('../_utils/cors');

module.exports = async function handler(req, res) {
  if (setCors(res, req)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { JWT_SECRET, PIXELPAY_KEY_ID, PIXELPAY_SECRET_KEY, PIXELPAY_SALE_URL, TIMEOUT_MS } = process.env;
  if (!JWT_SECRET || !PIXELPAY_KEY_ID || !PIXELPAY_SECRET_KEY || !PIXELPAY_SALE_URL) {
    res.status(500).json({ error: 'ENV_MISSING' }); return;
  }

  // Bearer <jwt>
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) { res.status(401).json({ error: 'MISSING_BEARER' }); return; }
  try { jwt.verify(m[1], JWT_SECRET); } catch { res.status(401).json({ error: 'INVALID_TOKEN' }); return; }

  let payload;
  try { payload = await readJson(req); } 
  catch { res.status(400).json({ error: 'INVALID_JSON' }); return; }

  if (!payload || typeof payload !== 'object') { res.status(400).json({ error: 'MISSING_PAYLOAD' }); return; }

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
    res.status(r.ok ? 200 : r.status).json(data || { raw: text });
  } catch (e) {
    res.status(500).json({ error: 'SALE_FAILED', detail: String(e) });
  }
};