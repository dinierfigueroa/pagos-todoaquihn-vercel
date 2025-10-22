// api/sale.js
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    // 1) login → bearer
    const auth = await axios.post(
      `${process.env.PIXELPAY_BASE}/api/auth/login`,
      {
        email: process.env.PIXELPAY_AUTH_EMAIL,
        password: process.env.PIXELPAY_AUTH_PASSWORD,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    const bearer = auth?.data?.token;
    if (!bearer) return res.status(500).json({ success: false, message: "no_bearer_token" });

    // 2) sale
    const saleUrl = `${process.env.PIXELPAY_BASE}/api/pixelpay/sale`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    };

    // req.body debe traer order + card/billing según tu doc
    const { data, status } = await axios.post(saleUrl, req.body || {}, {
      headers, timeout: 20000,
    });

    // Estándar 3DS (si aplica)
    const d = data?.data || {};
    const meta3ds = {
      transaction_type: d.transaction_type || null,
      jwt: d.payload || null,            // si viene songbird
      payment_uuid: d.payment_uuid || null,
    };

    return res.status(status || 200).json({ ...data, meta3ds });
  } catch (err) {
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "sale_error" });
  }
}