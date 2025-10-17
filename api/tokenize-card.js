// api/tokenize-card.js
import axios from "axios";
import crypto from "crypto";

const sha512 = (s) => crypto.createHash("sha512").update(s).digest("hex");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    // Headers PixelPay
    const headers = {
      "Content-Type": "application/json",
      "x-auth-key": process.env.PIXELPAY_KEY_ID,
      "x-auth-hash": sha512(process.env.PIXELPAY_SECRET_KEY),
      // x-auth-user NO es requerido para tokenización
    };

    // Espera campos de FF: number, cardholder, expire_month, expire_year, cvv2, customer(optional)
    const body = req.body || {};
    const url = `${process.env.PIXELPAY_BASE}/api/v2/tokenization/card`; // Tokenize Card
    const { data, status } = await axios.post(url, body, { headers, timeout: 20000 });

    // Respuesta tal cual + extracto útil
    const token = data?.data?.token || data?.token || null;
    console.log("TOKENIZE OK token:", token);

    return res.status(status || 200).json({
      ...data,
      meta: { token },
    });
  } catch (err) {
    console.error("TOKENIZE ERROR:", err?.response?.data || err?.message || err);
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "server_error" });
  }
}
