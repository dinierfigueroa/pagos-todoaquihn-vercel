// /api/todoaquihn/order_status.js
// Endpoint para que la app consulte el estado de la orden en Firestore.
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Variables globales del entorno
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

let db;
if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!db) {
        return res.status(500).json({ status: 'error', message: 'Error de configuración de Base de Datos.' });
    }

    const { id: orderId } = req.query;

    if (!orderId) {
        return res.status(400).json({ status: 'error', message: 'Falta Order ID.' });
    }

    // 1. Consultar el estado en Firestore
    try {
        const orderRef = doc(db, `/artifacts/${appId}/public/data/payments`, orderId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
            const data = orderSnap.data();
            
            // 2. Devolver el estado actual a FlutterFlow
            return res.status(200).json({
                status: 'success',
                order_id: orderId,
                payment_status: data.status || 'PENDING', // PENDING, APPROVED, REJECTED
                message: data.message || 'Esperando confirmación.'
            });
        } else {
            // Si no se encuentra en la DB, es PENDING hasta que el callback actúe.
            return res.status(200).json({
                status: 'not_found',
                order_id: orderId,
                payment_status: 'PENDING', 
                message: 'La orden está en proceso de 3DS y aún no se confirma.'
            });
        }
    } catch (e) {
        console.error('Error al consultar el estado de la DB:', e);
        res.status(500).json({ status: 'error', message: 'Error interno de servidor.', detail: String(e) });
    }
}