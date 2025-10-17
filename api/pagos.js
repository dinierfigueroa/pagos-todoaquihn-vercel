// api/pagos.js
import axios from "axios";
import crypto from "crypto";
const sha512 = (s) => crypto.createHash("sha512").update(s).digest("hex");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const COMERCIO_EMAIL = "lipsyerazo05@gmail.com";

    const headers = {
      "Content-Type": "application/json",
      "x-auth-key": process.env.PIXELPAY_KEY_ID,
      "x-auth-hash": sha512(process.env.PIXELPAY_SECRET_KEY),
      "x-auth-user": COMERCIO_EMAIL,
    };

    const body = req.body || {};
    const url = `${process.env.PIXELPAY_BASE}/api/v2/transaction/sale`; // Venta directa
    const { data, status } = await axios.post(url, body, { headers, timeout: 20000 });

    const d = data?.data || {};
    const meta3ds = {
      jwt: d.payload || null,                 // para 3DS songbird (JWT)
      transaction_type: d.transaction_type || null,
      payment_uuid: d.payment_uuid || null,
    };

    console.log("SALE OK payment_uuid:", d.payment_uuid, "tx_type:", d.transaction_type);

    return res.status(status || 200).json({ ...data, meta3ds });
  } catch (err) {
    console.error("SALE ERROR:", err?.response?.data || err?.message || err);
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "server_error" });
  }
}