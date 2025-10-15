// /api/pagos-challenge.js
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

    // Espera { payment_uuid }
    const { payment_uuid } = req.body || {};
    // ⚠️ Reemplaza esta URL por la correcta de PixelPay para obtener los params del challenge:
    const url = `${process.env.PIXELPAY_BASE}/api/v2/transaction/sale/challenge`;

    const { data } = await axios.post(url, { payment_uuid }, { headers, timeout: 20000 });

    // Normaliza nombres a lo que Cardinal espera:
    // (ajusta mapeo según cómo venga la respuesta de PixelPay)
    const acsUrl        = data?.data?.acs_url || data?.data?.AcsUrl;
    const payload       = data?.data?.creq    || data?.data?.pareq || data?.data?.Payload;
    const transactionId = data?.data?.threeDSServerTransID || data?.data?.TransactionId;

    return res.status(200).json({ acsUrl, payload, transactionId, raw: data });
  } catch (err) {
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success:false, message:"server_error" });
  }
}
