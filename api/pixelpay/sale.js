const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { PIXELPAY_SALE_URL, PIXELPAY_KEY_ID, PIXELPAY_SECRET_KEY } = process.env;
  if (!PIXELPAY_SALE_URL || !PIXELPAY_KEY_ID || !PIXELPAY_SECRET_KEY) {
    return res.status(500).json({ error: 'ENV_MISSING' });
  }

  // 1) Intentar Header Bearer
  const auth = req.headers.authorization || '';
  let sessionToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  // 2) Leer body
  let raw = '';
  await new Promise((ok, err) => { req.on('data', c => raw += c); req.on('end', ok); req.on('error', err); });
  if (!raw) return res.status(400).json({ error: 'EMPTY_BODY' });

  // 3) Si no hay Bearer, aceptar token desde el body y removerlo antes de reenviar
  let payload = {};
  try { payload = JSON.parse(raw); } catch { return res.status(400).json({ error: 'INVALID_JSON' }); }
  if (!sessionToken && payload && typeof payload.token === 'string') {
    sessionToken = payload.token;
    delete payload.token;
    raw = JSON.stringify(payload);
  }
  if (!sessionToken) return res.status(401).json({ error: 'MISSING_TOKEN' });

  // PixelPay: x-auth-hash = md5(secret)
  const xAuthHash = crypto.createHash('md5').update(PIXELPAY_SECRET_KEY).digest('hex');

  try {
    const r = await fetch(PIXELPAY_SALE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-key': PIXELPAY_KEY_ID,
        'x-auth-hash': xAuthHash
      },
      body: raw
    });

    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    res.status(r.status).json(json);
  } catch (e) {
    res.status(502).json({ error: 'UPSTREAM_ERROR', detail: String(e) });
  }
};