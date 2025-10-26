// /api/pixelpay/sale.js
// **Versión Final: Usa PIXELPAY_KEY_ID (ID de Comercio) para la autenticación 
// y asegura la normalización del payload para un SEAL correcto.**

export const config = { runtime: 'edge' };

function env(name, fallback = '') {
    const v = process.env[name] ?? '';
    return (typeof v === 'string' && v.trim() !== '') ? v.trim() : fallback;
}

const PIXELPAY_BASE        = env('PIXELPAY_BASE', 'https://banrural.pixelpay.app');
const PIXELPAY_SALE_URL    = env('PIXELPAY_SALE_URL', `${PIXELPAY_BASE}/api/v2/transaction/sale`);

// Volvemos a usar el ID de Comercio (PIXELPAY_KEY_ID) para la autenticación del header
const PIXELPAY_MERCHANT_ID = env('PIXELPAY_KEY_ID'); 
const PIXELPAY_SECRET_KEY  = env('PIXELPAY_SECRET_KEY'); 

/**
 * Calcula el HMAC-SHA256 del payload.
 */
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

/**
 * Ordena recursivamente las claves de un objeto para garantizar
 * que JSON.stringify() siempre produzca el mismo string.
 */
function sortObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }
    
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
        sorted[key] = sortObjectKeys(obj[key]);
    });
    return sorted;
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
            status: 405,
            headers: { 'content-type': 'application/json' }
        });
    }

    // 1) Lee el JSON de FlutterFlow
    const bodyObj = await req.json();
    
    // 2) Normaliza el objeto: CRÍTICO para asegurar que el SEAL siempre sea el mismo.
    const normalizedObj = sortObjectKeys(bodyObj);
    const rawPayload = JSON.stringify(normalizedObj); 

    if (!PIXELPAY_MERCHANT_ID || !PIXELPAY_SECRET_KEY) {
        return new Response(JSON.stringify({ error: 'MISSING_CREDENTIALS' }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
        });
    }

    // 3) Calcula el SEAL
    const seal = await hmacHexSHA256(PIXELPAY_SECRET_KEY, rawPayload);

    // 4) Llama a PixelPay
    const res = await fetch(PIXELPAY_SALE_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            // Usamos PIXELPAY_KEY_ID (ID de Comercio) para el header.
            'x-auth-key' : PIXELPAY_MERCHANT_ID, 
            'x-auth-seal': seal                   
        },
        body: rawPayload,
    });

    // 5) Devuelve lo mismo que responda PixelPay
    const text = await res.text();
    return new Response(text, {
        status: res.status,
        headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }
    });
}