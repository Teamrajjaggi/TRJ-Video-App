const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const COOKIE_NAME = 'vr_session';

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    // Generated once per process if unset — sessions invalidate on restart.
    if (!getSecret._ephemeral) {
      getSecret._ephemeral = crypto.randomBytes(32).toString('hex');
      console.warn(
        '[auth] SESSION_SECRET not set; using an ephemeral one. Sessions will not persist across restarts.',
      );
    }
    return getSecret._ephemeral;
  }
  return s;
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function issueSessionCookie(res, user) {
  const token = sign({
    uid: user.id,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function readSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  return verify(token);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  issueSessionCookie,
  clearSessionCookie,
  readSession,
  constantTimeEqual,
};
