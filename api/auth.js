// api/auth.js
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const url = `${process.env.PIXELPAY_BASE}/api/auth/login`;
    const body = {
      email: process.env.PIXELPAY_AUTH_EMAIL,
      password: process.env.PIXELPAY_AUTH_PASSWORD,
    };

    const { data, status } = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    // Esperamos { token: "..." }
    if (!data?.token) {
      return res.status(500).json({ success: false, message: "no_token" });
    }

    return res.status(status || 200).json({ token: data.token, user: data.user });
  } catch (err) {
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "auth_error" });
  }
}
