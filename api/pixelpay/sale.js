// /api/pixelpay/sale.js
// **IMPORTANTE: Se utiliza PIXELPAY_KEY_ID (ID de Comercio) para x-auth-key.**
export const config = { runtime: 'edge' };

function env(name, fallback = '') {
  const v = process.env[name] ?? '';
  return (typeof v === 'string' && v.trim() !== '') ? v.trim() : fallback;
}

const PIXELPAY_BASE        = env('PIXELPAY_BASE', 'https://banrural.pixelpay.app');
const PIXELPAY_SALE_URL    = env('PIXELPAY_SALE_URL', `${PIXELPAY_BASE}/api/v2/transaction/sale`);
// Usamos KEY_ID (el ID corto) para la autenticación en el header
const PIXELPAY_MERCHANT_ID = env('PIXELPAY_KEY_ID'); 
const PIXELPAY_SECRET_KEY  = env('PIXELPAY_SECRET_KEY'); 

function hmacHexSHA256(secret, raw) {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const payload = enc.encode(raw);
  
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(k => crypto.subtle.sign('HMAC', k, payload))
    .then(buf => {
      const bytes = new Uint8Array(buf);
      return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { 'content-type': 'application/json' }
    });
  }

  const bodyObj = await req.json();
  const rawPayload = JSON.stringify(bodyObj);

  if (!PIXELPAY_MERCHANT_ID || !PIXELPAY_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'MISSING_CREDENTIALS' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }

  const seal = await hmacHexSHA256(PIXELPAY_SECRET_KEY, rawPayload);

  const res = await fetch(PIXELPAY_SALE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-auth-key' : PIXELPAY_MERCHANT_ID, // ID de Comercio
      'x-auth-seal': seal                   
    },
    body: rawPayload,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }
  });
}