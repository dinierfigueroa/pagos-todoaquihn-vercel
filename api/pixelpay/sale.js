export const config = { runtime: 'edge' };

const j = (s, d) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

async function callPixelPay(url, auth, keyId, secretKey, payload, timeoutMs, variant = 1) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  // Headers base (siempre pasamos tu Bearer de login)
  const baseHeaders = {
    'content-type': 'application/json',
    authorization: auth, // Bearer <token> de /api/auth/login
  };

  // Variantes de headers para credenciales del comercio
  let credHeaders = {};
  if (variant === 1) {
    // Variante más común
    credHeaders = {
      'X-KEY-ID': keyId,
      'X-SECRET-KEY': secretKey,
      'x-key-id': keyId,
      'x-secret-key': secretKey,
    };
  } else {
    // Alternativa frecuente
    credHeaders = {
      'X-API-KEY': keyId,
      'X-API-SECRET': secretKey,
      'x-api-key': keyId,
      'x-api-secret': secretKey,
    };
  }

  // En la variante 3 mandamos además credentials en el body (server->server)
  const body =
    variant === 3
      ? JSON.stringify({ ...payload, credentials: { key_id: keyId, secret_key: secretKey } })
      : JSON.stringify(payload);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { ...baseHeaders, ...credHeaders },
      body,
    });
    clearTimeout(t);

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return { status: res.status, data };
  } catch (err) {
    clearTimeout(t);
    const isAbort = err?.name === 'AbortError';
    return {
      status: 504,
      data: {
        success: false,
        message: isAbort ? 'Timeout hablando con PixelPay' : 'Falla de red',
        detail: String(err),
      },
    };
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return j(405, { success: false, message: 'Method Not Allowed' });

  // 1) Bearer que envías desde FF
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer '))
    return j(401, { success: false, message: 'Falta header Authorization Bearer' });

  // 2) Env vars
  const SALE_URL = process.env.PIXELPAY_SALE_URL;
  const KEY_ID = process.env.PIXELPAY_KEY_ID;
  const SECRET_KEY = process.env.PIXELPAY_SECRET_KEY;
  const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 30000);

  if (!SALE_URL || !KEY_ID || !SECRET_KEY) {
    return j(500, {
      success: false,
      message:
        'Faltan variables de entorno: PIXELPAY_SALE_URL / PIXELPAY_KEY_ID / PIXELPAY_SECRET_KEY',
    });
  }

  // 3) Body desde FF (order/card/billing)
  let payload;
  try {
    payload = await req.json();
  } catch {
    return j(400, { success: false, message: 'Body JSON inválido' });
  }

  // 4) Intento 1: headers X-KEY-ID / X-SECRET-KEY
  let r = await callPixelPay(SALE_URL, auth, KEY_ID, SECRET_KEY, payload, TIMEOUT_MS, 1);
  const errMsg = (r.data?.message || '').toString().toLowerCase();

  // Si PixelPay dice que la KEY es inválida, probamos variantes
  if (r.status === 400 && (errMsg.includes('key') || errMsg.includes('llave'))) {
    // Intento 2: X-API-KEY / X-API-SECRET
    r = await callPixelPay(SALE_URL, auth, KEY_ID, SECRET_KEY, payload, TIMEOUT_MS, 2);

    if (r.status === 400) {
      // Intento 3: credentials en body (además de headers)
      r = await callPixelPay(SALE_URL, auth, KEY_ID, SECRET_KEY, payload, TIMEOUT_MS, 3);
    }
  }

  return j(r.status, r.data);
}