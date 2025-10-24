export const config = { runtime: 'nodejs18.x' }; // asegura Node >=18

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { PIXELPAY_BASE, PIXELPAY_AUTH_EMAIL, PIXELPAY_AUTH_PASSWORD, TIMEOUT_MS } = process.env;
    const { email = PIXELPAY_AUTH_EMAIL, password = PIXELPAY_AUTH_PASSWORD, __debug } = req.body || {};

    const url = `${PIXELPAY_BASE}/get-token-22835352e0`;

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      // AbortSignal.timeout requiere Node 18+
      signal: AbortSignal.timeout(parseInt(TIMEOUT_MS || '30000')),
      redirect: 'follow'
    });

    const text = await r.text(); // primero como texto para ver si viene HTML
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    // DEBUG controlado (solo si lo pides mandando __debug=true desde FF)
    if (__debug) {
      console.log('[LOGIN DEBUG] status:', r.status, 'url:', url);
      console.log('[LOGIN DEBUG] first200:', text.slice(0, 200));
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: 'UPSTREAM_ERROR',
        status: r.status,
        hint: text.slice(0, 200) // muestra por qué responde HTML/redirección
      });
    }

    const token =
      (data && (data.token || data.access_token || data?.data?.token)) || null;

    if (!token) {
      return res.status(502).json({
        error: 'TOKEN_NOT_FOUND',
        hint: text.slice(0, 200)
      });
    }

    return res.status(200).json({ token });
  } catch (e) {
    return res.status(500).json({ error: 'LOGIN_FAILED', detail: String(e) });
  }
}
