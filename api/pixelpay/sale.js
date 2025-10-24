// /api/pixelpay/sale.js
export const runtime = 'edge';

const REQUIRED_ENVS = [
  'PIXELPAY_KEY_ID',        // ID que te dio el banco (ej. BR1433566376)
  'PIXELPAY_SECRET_KEY',    // Clave secreta UID
  'PIXELPAY_SALE_URL',      // *** PON AQUÍ EL ENDPOINT 3DS ***
  'TIMEOUT_MS'
];

function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export default async function handler(req) {
  try {
    // 1) Verifica que venga el Bearer token (de tu /api/auth/login)
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, message: 'MISSING_BEARER' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    // 2) Lee el body tal como PixelPay lo espera: { order, card, billing }
    const payload = await req.json();

    // 3) Variables de entorno obligatorias
    for (const k of REQUIRED_ENVS) env(k);
    const PIXELPAY_KEY_ID     = env('PIXELPAY_KEY_ID');        // p.ej. BR1433566376
    const PIXELPAY_SECRET_KEY = env('PIXELPAY_SECRET_KEY');    // p.ej. c7371377-...
    const PIXELPAY_SALE_URL   = env('PIXELPAY_SALE_URL');      // *** 3DS ***
    const TIMEOUT_MS          = parseInt(env('TIMEOUT_MS', '30000'), 10);

    // 4) Construye los headers que PixelPay suele requerir
    //    Muchos comercios con Banrural usan exactamente 'KEY' y 'ID'.
    //    (Incluyo duplicados X-API-* por si tu entorno los valida)
    const headers = {
      'content-type': 'application/json',
      'KEY': PIXELPAY_SECRET_KEY,
      'ID': PIXELPAY_KEY_ID,
      'X-API-KEY': PIXELPAY_SECRET_KEY,
      'X-API-ID': PIXELPAY_KEY_ID,
    };

    // 5) Dispara contra el endpoint 3DS de PixelPay
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const upstream = await fetch(PIXELPAY_SALE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch((err) => {
      if (err.name === 'AbortError') {
        return new Response(JSON.stringify({ success:false, message:'UPSTREAM_TIMEOUT' }), {
          status: 504,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw err;
    });
    clearTimeout(t);

    // 6) Si PixelPay devuelve HTML (error 405/500 del proveedor), reexpón claro
    const ct = upstream.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const raw = await upstream.text();
      return new Response(JSON.stringify({ success:false, status: upstream.status, raw }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }

    // 7) Pásale el JSON tal cual a FlutterFlow
    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success:false, message:'INTERNAL_ERROR', detail: err?.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}