// /api/pixelpay/sale.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const {
      PIXELPAY_SALE_URL,
      PIXELPAY_KEY_ID,
      PIXELPAY_SECRET_KEY,
      PIXELPAY_ENV
    } = process.env;

    if (!PIXELPAY_SALE_URL || !PIXELPAY_KEY_ID || !PIXELPAY_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Server misconfigured: missing PixelPay env vars'
      });
    }

    // El body que envías desde FlutterFlow (order, card, billing).
    const payload = req.body || {};

    // En sandbox es obligatorio enviar env:"sandbox"
    if (PIXELPAY_ENV === 'sandbox' && !payload.env) {
      payload.env = 'sandbox';
    }

    // Llamada a PixelPay
    const upstream = await fetch(PIXELPAY_SALE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-key': PIXELPAY_KEY_ID,       // <— Public Key (la larga)
        'x-auth-hash': PIXELPAY_SECRET_KEY,  // <— Secret Key
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();

    // Intenta parsear JSON; si es HTML (error 503/Heroku), devuélvelo como raw.
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal error calling PixelPay',
      error: err?.message || String(err),
    });
  }
}
