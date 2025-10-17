// api/pagos-status.js
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
    };

    const url = `${process.env.PIXELPAY_BASE}/api/v2/transaction/status`;
    const { data, status } = await axios.post(url, req.body || {}, { headers, timeout: 20000 });

    return res.status(status || 200).json(data);
  } catch (err) {
    console.error("STATUS ERROR:", err?.response?.data || err?.message || err);
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "server_error" });
  }
}
