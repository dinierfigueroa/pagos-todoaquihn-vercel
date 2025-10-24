const crypto = require('crypto');

function toNestedIfFlat(p) {
  // ya viene en formato correcto
  if (p && typeof p === 'object' && p.order && p.card && p.billing) return p;

  // si viene plano, lo normalizamos
  const order = {
    id: p.id ?? p.order_id ?? p.orderId,
    currency: p.currency ?? 'HNL',
    amount: p.order_amount ?? p.amount,
    customer_name: p.customer_name,
    customer_email: p.customer_email
  };

  const card = {
    number: p.card_number,
    cardholder: p.cardholder ?? p.card_holder,
    expire_month: p.expire_month,
    expire_year: p.expire_year,
    cvv2: p.card_cvv ?? p.cvv2
  };

  const billing = {
    address: p.billing_address,
    country: p.billing_country ?? 'HN',
    state: p.billing_state ?? 'HN-CR',
    city: p.billing_city,
    phone: p.billing_phone
  };

  return { order, card, billing };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { PIXELPAY_SALE_URL, PIXELPAY_KEY_ID, PIXELPAY_SECRET_KEY } = process.env;
  if (!PIXELPAY_SALE_URL || !PIXELPAY_KEY_ID || !PIXELPAY_SECRET_KEY) {
    return res.status(500).json({ error: 'ENV_MISSING' });
  }

  // 1) Header Bearer
  const auth = req.headers.authorization || '';
  let sessionToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  // 2) Leer body
  let raw = '';
  await new Promise((ok, err) => { req.on('data', c => raw += c); req.on('end', ok); req.on('error', err); });
  if (!raw) return res.status(400).json({ error: 'EMPTY_BODY' });

  let payload;
  try { payload = JSON.parse(raw); } catch { return res.status(400).json({ error: 'INVALID_JSON' }); }

  // 3) token en body (fallback)
  if (!sessionToken && typeof payload.token === 'string') {
    sessionToken = payload.token;
    delete payload.token;
  }
  if (!sessionToken) return res.status(401).json({ error: 'MISSING_TOKEN' });

  // 4) Normalizar forma plana → anidada
  const normalized = toNestedIfFlat(payload);

  // 5) Hash requerido por PixelPay (md5 del secret)
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
      body: JSON.stringify(normalized)
    });

    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    res.status(r.status).json(json);
  } catch (e) {
    res.status(502).json({ error: 'UPSTREAM_ERROR', detail: String(e) });
  }
};