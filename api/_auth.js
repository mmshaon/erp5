// api/_auth.js
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'alpha-ultimate-fallback-secret-change-in-prod';

function b64url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function b64decode(str) {
  str = str.replace(/-/g,'+').replace(/_/g,'/');
  while (str.length % 4) str += '=';
  return Buffer.from(str,'base64').toString('utf8');
}

export function signJWT(payload, expiresInSeconds = 86400 * 7) {
  const header = b64url(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const body   = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now()/1000) + expiresInSeconds, iat: Math.floor(Date.now()/1000) }));
  const sig    = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(b64decode(body));
    if (payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export function requireAuth(req, res) {
  corsHeaders(res);
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return null; }
  const payload = verifyJWT(auth.slice(7));
  if (!payload) { res.status(401).json({ error: 'Invalid or expired token' }); return null; }
  return payload;
}
