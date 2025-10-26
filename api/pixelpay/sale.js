// /api/pixelpay/sale.js
// **CORREGIDO: Usa Node.js Runtime (soporta 'crypto').**
// **USA: Autenticación HASH, Payload Plano, Redirección a 3ds.html propio.**

import { createHash } from 'crypto'; // Esto ahora funciona

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
// Base de la URL de tu propio proyecto Vercel para la redirección 3DS
// Usaremos la URL de la request para construir esto de forma dinámica y segura.

/**
 * Genera el hash SHA-512 de la clave secreta, requerido para x-auth-hash.
 */
function generarSHA512(data) {
    return createHash("sha512").update(data).digest("hex");
}


/**
 * Función CRÍTICA: Convierte el payload anidado de FlutterFlow al formato plano de PixelPay.
 * Asegura que expire_year sea YY y el formato final YYMM.
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
        // Formato YYMM: Año (dos dígitos) seguido del Mes (CRÍTICO)
        card_expire: `${card?.expire_year?.slice(2)}${card?.expire_month}`, 
        card_cvv: card?.cvv2, // PixelPay espera card_cvv o cvv2

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


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!PIXELPAY_KEY_ID || !PIXELPAY_SECRET_KEY) {
        res.status(500).json({ error: 'MISSING_CREDENTIALS' });
        return;
    }

    // Leer el body de la petición Node.js
    let rawBody = '';
    await new Promise(resolve => {
        req.on('data', chunk => rawBody += chunk);
        req.on('end', resolve);
    });

    let bodyObj;
    try {
        bodyObj = JSON.parse(rawBody);
    } catch (e) {
        res.status(400).json({ error: 'INVALID_JSON' });
        return;
    }

    
    // 2) APLANAR EL OBJETO al formato plano que PixelPay espera.
    const flatPayload = flattenPayload(bodyObj);

    // 3) AUTENTICACIÓN HASH
    const hash_secreto = generarSHA512(PIXELPAY_SECRET_KEY);

    // 4) Llama a PixelPay
    const url = PIXELPAY_SALE_URL;
    const { data, status } = await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-auth-key': PIXELPAY_KEY_ID,
            'x-auth-hash': hash_secreto,
            'x-auth-user': COMERCIO_EMAIL,
        },
        body: JSON.stringify(flatPayload), // Enviamos el payload plano
    })
    .then(response => response.json().then(data => ({ data, status: response.status })))
    .catch(error => {
        console.error("Fetch Error:", error);
        // Si hay error de red, devolvemos un error controlado
        return { data: { success: false, message: 'FETCH_FAILED' }, status: 500 };
    });

    // 5) Manejar y transformar la respuesta
    if (data.success && data.message && data.message.includes("Transacción con intento de autenticación") && data.data?.payload) {
        
        const jwtPayload = data.data.payload;
        const paymentUuid = data.data.payment_uuid; // Necesario para la URL de tu 3ds.html
        
        // CONSTRUIR LA URL DE TU PROPIO WEBVIEW PERSONALIZADO (3ds.html)
        // Usamos req.headers.host para construir la URL base dinámica de Vercel.
        const host = req.headers.host || 'localhost';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        
        const authUrl = `${protocol}://${host}/3ds.html?token=${jwtPayload}&uuid=${paymentUuid}`;

        // Devolvemos la respuesta a FlutterFlow con la 'redirect_url' de TU WEBVIEW
        const responseToFlutterFlow = {
            success: true,
            message: data.message,
            redirect_url: authUrl, // <-- URL CRÍTICA CORREGIDA a tu dominio
            order_id: flatPayload.order_id,
        };

        return res.status(200).json(responseToFlutterFlow);
    }

    // 6) Devolver la respuesta original si no es 3DS (aprobación directa o fallo de tarjeta)
    res.status(status).json(data);
}