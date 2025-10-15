import axios from "axios";
import crypto from "crypto";

const generarSHA512 = (data) => {
  return crypto.createHash("sha512").update(data).digest("hex");
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const COMERCIO_EMAIL = "lipsyerazo05@gmail.com";
    const hash_secreto = generarSHA512(process.env.PIXELPAY_SECRET_KEY);

    const headers = {
      "Content-Type": "application/json",
      "x-auth-key": process.env.PIXELPAY_KEY_ID,
      "x-auth-hash": hash_secreto,
      "x-auth-user": COMERCIO_EMAIL,
    };

    const requestBody = req.body || {};
    const url = `${process.env.PIXELPAY_BASE}/api/v2/transaction/sale`;

    const { data, status } = await axios.post(url, requestBody, { headers });
    return res.status(status || 200).json(data);
  } catch (err) {
    console.error("SALE ERROR:", err?.response?.data || err?.message || err);
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "server_error" });
  }
}
