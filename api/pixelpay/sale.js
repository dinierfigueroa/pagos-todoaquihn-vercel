export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const { PIXELPAY_BASE, TIMEOUT_MS } = process.env;
    const { token, payload } = req.body; // payload = el JSON de la venta

    if (!token) return res.status(400).json({error:'MISSING_TOKEN'});
    if (!payload) return res.status(400).json({error:'MISSING_PAYLOAD'});

    const r = await fetch(`${PIXELPAY_BASE}/api/pixelpay/sale`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(parseInt(TIMEOUT_MS||'30000'))
    });

    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error:'SALE_FAILED', detail:String(e) });
  }
}