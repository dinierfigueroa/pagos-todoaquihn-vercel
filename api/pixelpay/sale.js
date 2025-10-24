// /api/pixelpay/sale.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // 1) (Opcional) validar que venga tu token para proteger este endpoint
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing Bearer token' });
    }
    // Si quieres validar el JWT, aquí lo verificas con tu JWT_SECRET.
    // Si sólo quieres que exista, con esto basta.

    // 2) Cargar variables
    const env = (process.env.PIXELPAY_ENV || 'production').trim().toLowerCase();
    const base =
      env === 'sandbox'
        ? 'https://pixelpay.dev'
        : (process.env.PIXELPAY_BASE || 'https://banrural.pixelpay.app').trim();

    // Ruta correcta (no es /3ds/)
    const saleUrl = `${base}/api/v2/transaction/sale`;

    // Public / Secret Key (recorta espacios por si acaso)
    const xAuthKey = (process.env.PIXELPAY_KEY_ID || '').trim();
    const xAuthHash = (process.env.PIXELPAY_SECRET_KEY || '').trim();

    if (!xAuthKey || !xAuthHash) {
      return res.status(500).json({
        success: false,
        message: 'Server misconfigured: missing PIXELPAY_KEY_ID / PIXELPAY_SECRET_KEY',
      });
    }

    // 3) Body que llega desde FlutterFlow
    const payload = req.body || {};
    // Si estás en sandbox y PixelPay lo requiere, envía env:"sandbox"
    if (env === 'sandbox' && !payload.env) payload.env = 'sandbox';

    // 4) Llamada a PixelPay
    const upstream = await fetch(saleUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-key': xAuthKey,     // <-- Public Key (la larga)
        'x-auth-hash': xAuthHash,   // <-- Secret Key
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Adjunta info mínima para depurar (sin exponer llaves)
    const meta = {
      status: upstream.status,
      url: saleUrl,
      env,
      // Útil para confirmar que realmente estás enviando la Public Key (longitud)
      _dbg: { xAuthKeyLen: xAuthKey.length }
    };

    return res.status(upstream.status).json({ ...data, _meta: meta });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal error calling PixelPay',
      error: err?.message || String(err),
    });
  }
}