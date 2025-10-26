// /api/pixelpay/sale.js
// **IMPORTANTE: Agrega ordenación alfabética para asegurar que el SEAL es correcto,
// y usa PIXELPAY_PUBLIC_KEY (Clave Larga) para x-auth-key como prueba final.**

export const config = { runtime: 'edge' };

function env(name, fallback = '') {
    const v = process.env[name] ?? '';
    return (typeof v === 'string' && v.trim() !== '') ? v.trim() : fallback;
}

const PIXELPAY_BASE        = env('PIXELPAY_BASE', 'https://banrural.pixelpay.app');
const PIXELPAY_SALE_URL    = env('PIXELPAY_SALE_URL', `${PIXELPAY_BASE}/api/v2/transaction/sale`);

// Cargamos AMBAS claves para asegurar que tenemos la Larga para el header.
// Si esta prueba no funciona, deberás volver a usar PIXELPAY_KEY_ID en 'x-auth-key'
// y contactar a soporte para el error de clave.
const PIXELPAY_PUBLIC_KEY  = env('PIXELPAY_PUBLIC_KEY'); 
const PIXELPAY_SECRET_KEY  = env('PIXELPAY_SECRET_KEY'); 

/**
 * Calcula el HMAC-SHA256 del payload usando la clave secreta.
 * @param {string} secret - La clave secreta de PixelPay.
 * @param {string} raw - El payload JSON serializado.
 * @returns {Promise<string>} El hash en formato hexadecimal.
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
 * Recursivamente ordena alfabéticamente las claves de un objeto.
 * Esto asegura que JSON.stringify() siempre produzca el mismo string para el HMAC.
 */
function sortObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }
    
    const sorted = {};
    // Obtenemos las claves, las ordenamos y rellenamos el nuevo objeto
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

    // 1) Lee el JSON que te manda FlutterFlow
    const bodyObj = await req.json();
    
    // 2) Normaliza el objeto: Ordena todas las claves alfabéticamente 
    //    para garantizar que rawPayload siempre sea el mismo string.
    const normalizedObj = sortObjectKeys(bodyObj);
    const rawPayload = JSON.stringify(normalizedObj); // Este string es ahora consistente

    if (!PIXELPAY_PUBLIC_KEY || !PIXELPAY_SECRET_KEY) {
        return new Response(JSON.stringify({ error: 'MISSING_CREDENTIALS' }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
        });
    }

    // 3) Calcula el SEAL
    const seal = await hmacHexSHA256(PIXELPAY_SECRET_KEY, rawPayload);

    // 4) Llama a PixelPay con la CLAVE LARGA (nuestra última prueba de autenticación)
    const res = await fetch(PIXELPAY_SALE_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            // Usamos PIXELPAY_PUBLIC_KEY (Clave Larga) para la prueba final.
            'x-auth-key' : PIXELPAY_PUBLIC_KEY, 
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