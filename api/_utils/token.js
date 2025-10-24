const crypto = require('crypto');

function b64url(str) {
  return Buffer.from(str).toString('base64url');
}
function unb64url(str) {
  return Buffer.from(str, 'base64url').toString();
}

function sign(payload, secret, expiresInSec = 600) {
  const data = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec };
  const p = b64url(JSON.stringify(data));
  const sig = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  return `${p}.${sig}`;
}

function verify(token, secret) {
  const [p, sig] = (token || '').split('.');
  if (!p || !sig) throw new Error('BAD_TOKEN');
  const expected = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  if (sig !== expected) throw new Error('BAD_SIGNATURE');
  const data = JSON.parse(unb64url(p));
  if (data.exp && data.exp < Math.floor(Date.now() / 1000)) throw new Error('TOKEN_EXPIRED');
  return data;
}

module.exports = { sign, verify };
