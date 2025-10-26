// /api/pixelpay/sale.js
// **CORRECCIÓN CRÍTICA: APLANA el JSON anidado de FlutterFlow al formato plano de PixelPay.**

export const config = { runtime: 'edge' };

function env(name, fallback = '') {
    const v = process.env[name] ?? '';
    return (typeof v === 'string' && v.trim() !== '') ? v.trim() : fallback;
}

const PIXELPAY_BASE        = env('PIXELPAY_BASE', 'https://banrural.pixelpay.app');
const PIXELPAY_SALE_URL    = env('PIXELPAY_SALE_URL', `${PIXELPAY_BASE}/api/v2/transaction/sale`);

// Usamos el ID de Comercio (PIXELPAY_KEY_ID) para la autenticación del header
const PIXELPAY_MERCHANT_ID = env('PIXELPAY_KEY_ID'); 
const PIXELPAY_SECRET_KEY  = env('PIXELPAY_SECRET_KEY'); 

/**
 * Calcula el HMAC-SHA256 del payload. (Sin Cambios)
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
 * Ordena recursivamente las claves de un objeto. (Sin Cambios)
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

/**
 * Función CRÍTICA: Convierte el payload anidado de FlutterFlow al formato plano de PixelPay.
 * @param {object} bodyObj - El objeto JSON anidado que viene de FlutterFlow.
 * @returns {object} El objeto JSON plano esperado por la API de PixelPay.
 */
function flattenPayload(bodyObj) {
    const { order, card, billing } = bodyObj;
    
    const flat = {
        // Campos de Order (Tu formato vs. Formato PixelPay)
        order_id: order?.id,
        order_currency: order?.currency,
        order_amount: order?.amount,
        customer_name: order?.customer_name,
        customer_email: order?.customer_email,

        // Campos de Card
        card_number: card?.number,
        card_holder: card?.cardholder,
        // CORRECCIÓN: PixelPay espera 'YYMM' (Año de dos dígitos, seguido del Mes)
        card_expire: `${card?.expire_year?.slice(2)}${card?.expire_month}`, 
        card_cvv: card?.cvv2,

        // Campos de Billing
        billing_address: billing?.address,
        billing_country: billing?.country,
        billing_state: billing?.state,
        billing_city: billing?.city,
        billing_phone: billing?.phone,

        // Campos adicionales requeridos para la API v2 o 3DS
        lang: 'es', // Se recomienda enviar el idioma
        env: process.env.PIXELPAY_ENV || 'production', // Leer del ENV de Vercel
    };

    // Filtra campos undefined si es necesario, aunque JSON.stringify los ignora
    return flat;
}


export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
            status: 405,
            headers: { 'content-type': 'application/json' }
        });
    }

    // 1) Lee el JSON de FlutterFlow (anidado)
    const bodyObj = await req.json();
    
    // 2) APLANA EL OBJETO
    const flatObj = flattenPayload(bodyObj);

    // 3) Normaliza el objeto plano: CRÍTICO para asegurar el orden.
    const normalizedObj = sortObjectKeys(flatObj);
    
    // 4) CREA el string JSON COMPACTO para el HMAC y el body final.
    const rawPayload = JSON.stringify(normalizedObj); 

    if (!PIXELPAY_MERCHANT_ID || !PIXELPAY_SECRET_KEY) {
        return new Response(JSON.stringify({ error: 'MISSING_CREDENTIALS' }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
        });
    }

    // 5) Calcula el SEAL
    const seal = await hmacHexSHA256(PIXELPAY_SECRET_KEY, rawPayload);

    // 6) Llama a PixelPay
    const res = await fetch(PIXELPAY_SALE_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-auth-key' : PIXELPAY_MERCHANT_ID, 
            'x-auth-seal': seal                   
        },
        body: rawPayload, // Enviamos el payload plano y normalizado
    });

    // 7) Devuelve lo mismo que responda PixelPay
    const text = await res.text();
    return new Response(text, {
        status: res.status,
        headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }
    });
}