// api/pagos.js
import axios from "axios";
import crypto from "crypto";

const sha512 = (s) => crypto.createHash("sha512").update(s).digest("hex");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Ajusta el correo si tu cuenta usa otro usuario
    const COMERCIO_EMAIL = "lipsyerazo05@gmail.com";

    const headers = {
      "Content-Type": "application/json",
      "x-auth-key": process.env.PIXELPAY_KEY_ID,
      "x-auth-hash": sha512(process.env.PIXELPAY_SECRET_KEY),
      "x-auth-user": COMERCIO_EMAIL, // requerido por PixelPay para SALE
    };

    const body = req.body || {};
    const url = `${process.env.PIXELPAY_BASE}/api/v2/transaction/sale`;

    const { data, status } = await axios.post(url, body, {
      headers,
      timeout: 20000,
    });

    // ---------- Normalización de 3DS ----------
    // PixelPay puede devolver:
    //  - JWT (songbird): data.data.payload, data.data.transaction_type === 'songbird'
    //  - Parámetros de challenge: acs_url, creq/pareq, threeDSServerTransID (a veces bajo data.data.three_ds.*)
    const d = (data && data.data) ? data.data : {};

    const meta3ds = {
      // JWT para flujo setup+start (songbird)
      jwt: d.payload || d.songbird_jwt || (d.three_ds && (d.three_ds.token || d.three_ds.jwt)) || null,
      // Continue (AcsUrl/Payload/TransactionId)
      acsUrl:
        d.acs_url ||
        (d.three_ds && d.three_ds.acs_url) ||
        null,
      payload:
        d.creq ||
        d.pareq ||
        (d.three_ds && (d.three_ds.creq || d.three_ds.pareq)) ||
        null,
      transactionId:
        d.threeDSServerTransID ||
        d.TransactionId ||
        (d.three_ds && (d.three_ds.threeDSServerTransID || d.three_ds.transaction_id)) ||
        null,
      transaction_type: d.transaction_type || null,
    };

    // Log útil para depurar en Vercel (NO imprime PAN/CVV porque no los enviamos aquí)
    console.log("SALE OK payment_uuid:", d.payment_uuid, "3DS meta:", meta3ds);

    return res.status(status || 200).json({
      ...data,
      meta3ds, // <-- bloque auxiliar para tu frontend
    });
  } catch (err) {
    const eData = err?.response?.data || { message: err?.message || "server_error" };
    console.error("SALE ERROR:", eData);
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "server_error" });
  }
}
