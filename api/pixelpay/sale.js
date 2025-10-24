// api/pixelpay/sale.js
// Vercel Serverless Function (CommonJS)

const PIXELPAY_SALE_URL = process.env.PIXELPAY_SALE_URL; // p. ej. https://banrural.pixelpay.app/api/v2/transaction/sale
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 30000);

module.exports = async (req, res) => {
  try {
    // 1) Método permitido
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
      return;
    }

    // 2) Validaciones básicas
    if (!PIXELPAY_SALE_URL) {
      res.status(500).json({ error: 'MISSING_ENV', detail: 'PIXELPAY_SALE_URL not set' });
      return;
    }

    const auth = req.headers['authorization'] || '';
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'MISSING_AUTH', detail: 'Authorization: Bearer <token> required' });
      return;
    }

    // 3) Leer body CRUDO (no asumimos que venga parseado)
    let rawBody = '';
    await new Promise((ok, err) => {
      req.on('data', chunk => (rawBody += chunk));
      req.on('end', ok);
      req.on('error', err);
    });

    // Validar que sea JSON válido (PixelPay espera JSON)
    try {
      JSON.parse(rawBody);
    } catch (e) {
      res.status(400).json({ error: 'INVALID_JSON_BODY', detail: e?.message || String(e) });
      return;
    }

    // 4) Reenviar a PixelPay tal cual
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);

    const ppResp = await fetch(PIXELPAY_SALE_URL, {
      method: 'POST',
      headers: {
        // ¡Muy importante! Pasar el mismo bearer del cliente
        'Authorization': auth,
        'Content-Type': 'application/json',
      },
      body: rawBody,
      signal: ac.signal,
    }).finally(() => clearTimeout(t));

    // 5) Devolver la respuesta "tal cual" (status + cuerpo + content-type)
    const text = await ppResp.text();
    const ct = ppResp.headers.get('content-type') || 'application/json';

    res.status(ppResp.status).setHeader('content-type', ct).send(text);
  } catch (err) {
    // Errores operacionales (timeout, network, etc.)
    const msg = err?.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : (err?.message || String(err));
    console.error('[PIXELPAY_SALE_ERROR]', err);
    res.status(502).json({ error: 'SALE_PROXY_FAILED', detail: msg });
  }
};