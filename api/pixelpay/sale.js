export const config = { runtime: 'edge' };

const respond = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

async function doCall(url, { auth, id, key, payload, timeoutMs, headerStyle = 'KEY_ID' }) {
  const controller = new AbortController();
  const killer = setTimeout(() => controller.abort(), timeoutMs);

  const base = {
    'content-type': 'application/json',
    authorization: auth, // tu Bearer hacia nuestro endpoint (no es para PixelPay auth)
  };

  let cred = {};
  if (headerStyle === 'KEY_ID') {
    // <- Estilo que PixelPay suele pedir (tal cual KEY / ID)
    cred = { KEY: key, ID: id };
  } else if (headerStyle === 'XKEY_XID') {
    cred = { 'X-KEY': key, 'X-ID': id, 'x-key': key, 'x-id': id };
  } else if (headerStyle === 'XAPI') {
    cred = {
      'X-API-KEY': id,
      'X-API-SECRET': key,
      'x-api-key': id,
      'x-api-secret': key,
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { ...base, ...cred },
      body: JSON.stringify(payload),
    });
    clearTimeout(killer);

    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    return { status: res.status, data };
  } catch (e) {
    clearTimeout(killer);
    const isAbort = e?.name === 'AbortError';
    return {
      status: 504,
      data: {
        success: false,
        message: isAbort ? 'Timeout hablando con PixelPay' : 'Falla de red',
        detail: String(e),
      },
    };
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return respond(405, { success: false, message: 'Method Not Allowed' });

  // Bearer que envías desde FlutterFlow (solo protege este endpoint)
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer '))
    return respond(401, { success: false, message: 'Falta header Authorization Bearer' });

  // Env vars
  const SALE_URL   = process.env.PIXELPAY_SALE_URL;    // p.ej. https://banrural.pixelpay.app/api/v2/transaction/sale
  const PIX_ID     = process.env.PIXELPAY_KEY_ID;      // BR1433566376
  const PIX_KEY    = process.env.PIXELPAY_SECRET_KEY;  // c7371377-18b0-4ffc-59f8-a1619
  const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 30000);

  if (!SALE_URL || !PIX_ID || !PIX_KEY) {
    return respond(500, {
      success: false,
      message:
        'Faltan variables: PIXELPAY_SALE_URL / PIXELPAY_KEY_ID / PIXELPAY_SECRET_KEY',
    });
  }

  // Body desde FF (order/card/billing) — no incluyas token aquí
  let payload;
  try { payload = await req.json(); }
  catch { return respond(400, { success: false, message: 'Body JSON inválido' }); }

  // Intento 1: headers exactos KEY / ID
  let r = await doCall(SALE_URL, {
    auth,
    id: PIX_ID,
    key: PIX_KEY,
    payload,
    timeoutMs: TIMEOUT_MS,
    headerStyle: 'KEY_ID',
  });

  // Si sigue quejándose de KEY inválida, probamos variantes
  const msg = (r.data?.message || '').toString().toLowerCase();
  if (r.status === 400 && (msg.includes('key') || msg.includes('llave'))) {
    // Variante X-KEY / X-ID
    r = await doCall(SALE_URL, {
      auth,
      id: PIX_ID,
      key: PIX_KEY,
      payload,
      timeoutMs: TIMEOUT_MS,
      headerStyle: 'XKEY_XID',
    });

    if (r.status === 400) {
      // Variante X-API-KEY / X-API-SECRET
      r = await doCall(SALE_URL, {
        auth,
        id: PIX_ID,
        key: PIX_KEY,
        payload,
        timeoutMs: TIMEOUT_MS,
        headerStyle: 'XAPI',
      });
    }
  }

  return respond(r.status, r.data);
}