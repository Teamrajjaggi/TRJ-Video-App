const crypto = require('crypto');
const { hashPassword } = require('./auth');
const { getDb } = require('./db');

function newId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function rowToUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    role: r.role,
    createdAt: r.created_at,
  };
}

function findById(id) {
  return rowToUser(getDb().prepare('SELECT * FROM users WHERE id = ?').get(id));
}

function findByUsername(username) {
  return rowToUser(
    getDb()
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(String(username || '')),
  );
}

function readUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY created_at').all().map(rowToUser);
}

function isMasterUsername(username) {
  const master = (process.env.MASTER_USERNAME || '').trim().toLowerCase();
  if (!master) return false;
  return String(username || '').toLowerCase() === master;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    isMaster: isMasterUsername(u.username),
  };
}

async function createUser({ username, password, role = 'user' }) {
  if (!username || !password) throw new Error('username and password required');
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username))
    throw new Error('username must be 3–32 chars, [a-zA-Z0-9_.-]');
  if (password.length < 8) throw new Error('password must be at least 8 characters');
  if (findByUsername(username)) throw new Error('username already taken');

  const id = newId('usr');
  const hash = await hashPassword(password);
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, username, hash, role, createdAt);
  return { id, username, passwordHash: hash, role, createdAt };
}

async function updateUsername(id, newUsername) {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(newUsername))
    throw new Error('username must be 3–32 chars, [a-zA-Z0-9_.-]');
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(id);
  if (!existing) throw new Error('user not found');
  const collision = db
    .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?')
    .get(newUsername, id);
  if (collision) throw new Error('username already taken');
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, id);
  return rowToUser({ ...existing, username: newUsername });
}

async function bootstrapAdmin() {
  const existing = findByUsername('claude');
  if (existing) {
    // Re-sync password on every boot if ADMIN_PASSWORD is set in env.
    if (process.env.ADMIN_PASSWORD) {
      const newHash = await hashPassword(process.env.ADMIN_PASSWORD);
      getDb()
        .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .run(newHash, existing.id);
      return { user: publicUser(existing), bootstrappedPassword: null, resynced: true };
    }
    return { user: publicUser(existing), bootstrappedPassword: null };
  }

  const password =
    process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const user = await createUser({ username: 'claude', password, role: 'admin' });
  return { user: publicUser(user), bootstrappedPassword: password };
}

module.exports = {
  readUsers,
  findById,
  findByUsername,
  createUser,
  updateUsername,
  publicUser,
  bootstrapAdmin,
  isMasterUsername,
};
