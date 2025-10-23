export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const { PIXELPAY_BASE, PIXELPAY_AUTH_EMAIL, PIXELPAY_AUTH_PASSWORD, TIMEOUT_MS } = process.env;

    const r = await fetch(`${PIXELPAY_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: PIXELPAY_AUTH_EMAIL, password: PIXELPAY_AUTH_PASSWORD }),
      signal: AbortSignal.timeout(parseInt(TIMEOUT_MS||'30000'))
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    // Normaliza nombre del campo token por si cambia
    const token = data.token || data.access_token || data.accessToken;
    return res.status(200).json({ token, raw:data });
  } catch (e) {
    return res.status(500).json({ error: 'LOGIN_FAILED', detail: String(e) });
  }
}
