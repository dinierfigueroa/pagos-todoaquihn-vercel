// /api/pixelpay/callback.js
// Este endpoint es llamado por PixelPay (Servidor a Servidor) para notificar el resultado final del 3DS.
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Variables globales del entorno
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

let db;
if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} else {
    console.error("Firebase config no disponible. El callback NO PERSISTIRÁ los datos.");
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // El body debe ser parseado para Node.js environment
    let rawBody = '';
    await new Promise(resolve => {
        req.on('data', chunk => rawBody += chunk);
        req.on('end', resolve);
    });
    
    let transactionData;
    try {
        transactionData = JSON.parse(rawBody);
    } catch (e) {
        return res.status(400).json({ status: 'error', message: 'Cuerpo de solicitud inválido.' });
    }

    const orderId = transactionData.order?.id;
    const isApproved = transactionData.success;
    const statusMessage = transactionData.message || (isApproved ? 'Aprobado' : 'Rechazado');

    if (!orderId) {
        return res.status(400).json({ status: 'error', message: 'Falta Order ID en el callback.' });
    }

    // 2. Lógica de persistencia en Firestore
    try {
        if (db) {
            // Guardamos el estado en una colección pública, accesible por ID de orden
            const orderRef = doc(db, `/artifacts/${appId}/public/data/payments`, orderId);
            
            await setDoc(orderRef, {
                status: isApproved ? 'APPROVED' : 'REJECTED',
                message: statusMessage,
                timestamp: new Date().toISOString(),
                fullResponse: transactionData
            }, { merge: true });

            console.log(`Estado del pedido ${orderId} actualizado a ${isApproved ? 'APPROVED' : 'REJECTED'}.`);
        }
        
        // 3. Responde a PixelPay con un 200 OK
        res.status(200).json({ status: 'received' });
    } catch (e) {
        console.error('Error al procesar el callback y actualizar la DB:', e);
        res.status(200).json({ status: 'internal_error', detail: String(e) }); // Respondemos 200 a PixelPay para evitar reintentos
    }
}