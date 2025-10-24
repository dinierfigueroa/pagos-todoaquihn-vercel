export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    PIXELPAY_BASE,
    PIXELPAY_AUTH_EMAIL,
    PIXELPAY_AUTH_PASSWORD,
    TIMEOUT_MS
  } = process.env;

  // Validación de ENV obligatorias
  const missing = [];
  if (!PIXELPAY_BASE) missing.push('PIXELPAY_BASE');
  if (!PIXELPAY_AUTH_EMAIL) missing.push('PIXELPAY_AUTH_EMAIL');
  if (!PIXELPAY_AUTH_PASSWORD) missing.push('PIXELPAY_AUTH_PASSWORD');
  if (missing.length) {
    return res.status(500).json({
      error: 'ENV_MISSING',
      missing
    });
  }

  try {
    const { email = PIXELPAY_AUTH_EMAIL, password = PIXELPAY_AUTH_PASSWORD, __debug } = req.body || {};
    const url = `${PIXELPAY_BASE}/get-token-22835352e0`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(parseInt(TIMEOUT_MS || '30000')),
      redirect: 'follow'
    });

    const text = await r.text(); // primero como texto para detectar HTML
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}

    if (__debug) {
      console.log('[AUTH] status:', r.status, 'url:', url);
      console.log('[AUTH] preview:', text.slice(0, 200));
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: 'UPSTREAM_ERROR',
        status: r.status,
        hint: text.slice(0, 200)
      });
    }

    const token = data?.token || data?.access_token || data?.data?.token;
    if (!token) {
      return res.status(502).json({ error: 'TOKEN_NOT_FOUND', hint: text.slice(0, 200) });
    }

    return res.status(200).json({ token });
  } catch (e) {
    return res.status(500).json({ error: 'LOGIN_FAILED', detail: String(e) });
  }
}