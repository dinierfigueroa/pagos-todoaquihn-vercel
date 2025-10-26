// /api/pixelpay/sale.js
// **MÉTODO DE AUTENTICACIÓN: HASH-SHA512 (Ya que el SEAL falló consistentemente)**
// Este archivo toma el JSON anidado de FlutterFlow, lo aplana, y lo envía con autenticación HASH.
export const config = { runtime: 'edge' };

// **NOTA:** Axios no está disponible en Vercel Edge Runtime. Usaremos Fetch API nativo y Crypto nativo.
import { createHash } from 'crypto';

function env(name, fallback = '') {
    const v = process.env[name] ?? '';
    return (typeof v === 'string' && v.trim() !== '') ? v.trim() : fallback;
}

const PIXELPAY_BASE        = env('PIXELPAY_BASE', 'https://banrural.pixelpay.app');
const PIXELPAY_SALE_URL    = env('PIXELPAY_SALE_URL', `${PIXELPAY_BASE}/api/v2/transaction/sale`);
const PIXELPAY_KEY_ID      = env('PIXELPAY_KEY_ID'); 
const PIXELPAY_SECRET_KEY  = env('PIXELPAY_SECRET_KEY'); 

// Correo del comercio para la autenticación x-auth-user
const COMERCIO_EMAIL = env('COMERCIO_EMAIL', 'lipsyerazo05@gmail.com');

/**
 * Genera el hash SHA-512 de la clave secreta, requerido para x-auth-hash.
 */
function generarSHA512(data) {
    // Nota: 'crypto' en Edge Runtime a veces requiere polyfills si se usa el createHash de Node.js,
    // pero en Vercel build environment, es más estable para una simple operación de hashing.
    if (typeof createHash === 'function') {
        return createHash("sha512").update(data).digest("hex");
    }
    // Fallback simple si createHash no está disponible, aunque es menos preciso.
    // Para Edge Runtime puro, se necesitaría una importación diferente o usar SubtleCrypto para hashing.
    console.error("Usando fallback de hash simple. Requiere la importación de 'crypto/web'.");
    return data; 
}


/**
 * Función CRÍTICA: Convierte el payload anidado de FlutterFlow al formato plano de PixelPay (Requerido por Hash Auth).
 * (Esta función NO se usa para el HASH, solo para el cuerpo de la venta).
 */
function flattenPayload(bodyObj) {
    const { order, card, billing } = bodyObj;
    
    // El payload debe contener solo la data de la venta, plano, como lo espera la API v2 de HASH.
    const flat = {
        // Campos de Order
        order_id: order?.id,
        order_currency: order?.currency,
        order_amount: order?.amount,
        customer_name: order?.customer_name,
        customer_email: order?.customer_email,

        // Campos de Card
        card_number: card?.number,
        card_holder: card?.cardholder,
        // Formato YYMM: Año (dos dígitos) seguido del Mes
        card_expire: `${card?.expire_year?.slice(2)}${card?.expire_month}`, 
        card_cvv: card?.cvv2,

        // Campos de Billing
        billing_address: billing?.address,
        billing_country: billing?.country,
        billing_state: billing?.state,
        billing_city: billing?.city,
        billing_phone: billing?.phone,

        // Campos adicionales
        lang: 'es', 
        env: process.env.PIXELPAY_ENV || 'production',
    };

    return flat;
}


export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
            status: 405,
            headers: { 'content-type': 'application/json' }
        });
    }

    if (!PIXELPAY_KEY_ID || !PIXELPAY_SECRET_KEY) {
        return new Response(JSON.stringify({ error: 'MISSING_CREDENTIALS' }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
        });
    }

    // 1) Leer el JSON de FlutterFlow (anidado)
    const bodyObj = await req.json();
    
    // 2) APLANAR EL OBJETO al formato plano que PixelPay espera.
    const flatPayload = flattenPayload(bodyObj);

    // 3) AUTENTICACIÓN HASH
    // Nota: El hash se calcula solo sobre la clave secreta, NO sobre el payload.
    const hash_secreto = generarSHA512(PIXELPAY_SECRET_KEY);

    // 4) Llama a PixelPay
    const res = await fetch(PIXELPAY_SALE_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-auth-key': PIXELPAY_KEY_ID,
            'x-auth-hash': hash_secreto,
            'x-auth-user': COMERCIO_EMAIL,
        },
        body: JSON.stringify(flatPayload), // Enviamos el payload plano
    });

    // 5) Devuelve lo mismo que responda PixelPay (maneja la redirect_url del 3DS)
    const text = await res.text();
    return new Response(text, {
        status: res.status,
        headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }
    });
}