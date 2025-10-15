import axios from "axios";
import crypto from "crypto";

const sha512 = (s) => crypto.createHash("sha512").update(s).digest("hex");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const headers = {
      "Content-Type": "application/json",
      "x-auth-key": process.env.PIXELPAY_KEY_ID,
      "x-auth-hash": sha512(process.env.PIXELPAY_SECRET_KEY),
      "x-auth-user": "pagos@todoaquihn.com", // o el correo de tu comercio
    };

    // El cliente debe mandar: { payment_uuid, threeDS_result: {...} }
    const body = req.body || {};
    // ⚠️ Ajusta el path según docs del gateway:
    const url = `${process.env.PIXELPAY_BASE}/api/v2/transaction/sale/complete`;

    const { data, status } = await axios.post(url, body, { headers, timeout: 20000 });
    return res.status(status || 200).json(data);
  } catch (err) {
    console.error("SALE COMPLETE ERROR:", err?.response?.data || err?.message || err);
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "server_error" });
  }
}
