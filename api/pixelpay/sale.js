// /api/pixelpay/sale.js
export const runtime = 'edge';

const REQ_ENVS = ['PIXELPAY_KEY_ID', 'PIXELPAY_SECRET_KEY', 'PIXELPAY_SALE_URL'];
function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export default async function handler(req) {
  try {
    // 1) Debe venir Bearer (de tu /api/auth/login)
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success:false, message:'MISSING_BEARER' }), {
        status: 401, headers: { 'content-type': 'application/json' }
      });
    }

    // 2) Lee body (order/card/billing)
    const basePayload = await req.json();

    // 3) Envs
    REQ_ENVS.forEach(must);
    const KEY_ID   = must('PIXELPAY_KEY_ID');        // BR1433566376
    const SECRET   = must('PIXELPAY_SECRET_KEY');    // c7371377-...
    const SALE_URL = must('PIXELPAY_SALE_URL');      // *** RUTA 3DS exacta ***
    const TIMEOUT  = parseInt(process.env.TIMEOUT_MS || '30000', 10);
    const RETURN_URL   = process.env.PIXELPAY_RETURN_URL;
    const CALLBACK_URL = process.env.PIXELPAY_CALLBACK_URL;

    // 4) Arma el payload final (agregando URLs 3DS si las tienes)
    const payload = {
      ...basePayload,
      ...(RETURN_URL ? { return_url: RETURN_URL } : {}),
      ...(CALLBACK_URL ? { callback_url: CALLBACK_URL } : {}),
    };

    // 5) Headers esperados por PixelPay
    const headers = {
      'content-type': 'application/json',
      'accept': 'application/json',
      'KEY': SECRET,
      'ID': KEY_ID,
      // Duplicados por si su API los mapea así:
      'X-API-KEY': SECRET,
      'X-API-ID': KEY_ID,
    };

    // 6) Llamada upstream
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT);
    const resp = await fetch(SALE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch(err => {
      if (err.name === 'AbortError') {
        return new Response(JSON.stringify({ success:false, message:'UPSTREAM_TIMEOUT' }), {
          status: 504, headers: { 'content-type': 'application/json' }
        });
      }
      throw err;
    });
    clearTimeout(t);

    // 7) Si devuelven HTML (503 Heroku), reenvuélvelo para verlo claro
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const raw = await resp.text();
      return new Response(JSON.stringify({ success:false, status: resp.status, raw }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success:false, message:'INTERNAL_ERROR', detail: String(e?.message || e) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}