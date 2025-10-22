// api/status.js
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
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

    const url = `${process.env.PIXELPAY_BASE}/api/pixelpay/status`;
    const { data, status } = await axios.post(url, req.body || {}, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      timeout: 15000,
    });

    return res.status(status || 200).json(data);
  } catch (err) {
    return res
      .status(err?.response?.status || 500)
      .json(err?.response?.data || { success: false, message: "status_error" });
  }
}
