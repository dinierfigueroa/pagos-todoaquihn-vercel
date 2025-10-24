module.exports = async (req, res) => {
  let raw = '';
  await new Promise((ok, err) => { req.on('data', c => raw += c); req.on('end', ok); req.on('error', err); });
  let parsed = null; try { parsed = JSON.parse(raw); } catch {}
  res.status(200).json({
    method: req.method,
    headers: req.headers,
    contentType: req.headers['content-type'],
    rawBody: raw,
    parsed
  });
};
