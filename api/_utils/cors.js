module.exports = function setCors(res, req) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // o tu dominio FF
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Maneja preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
};