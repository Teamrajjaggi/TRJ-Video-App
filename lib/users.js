const crypto = require('crypto');
const { hashPassword } = require('./auth');
const db = require('./db');

function adminUsername() {
  return (process.env.ADMIN_USERNAME || 'admin').trim();
}

function creatorUsername() {
  return (process.env.CREATOR_USERNAME || '').trim();
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

function isAdminUsername(username) {
  return String(username || '').toLowerCase() === adminUsername().toLowerCase();
}

function isCreatorUsername(username) {
  const cu = creatorUsername();
  return Boolean(cu) && String(username || '').toLowerCase() === cu.toLowerCase();
}

// Master and admin collapsed into one in v1: the single configured admin.
const isMasterUsername = isAdminUsername;

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    isAdmin: isAdminUsername(u.username),
    isCreator: u.role === 'creator' && !isAdminUsername(u.username),
  };
}

async function findById(id) {
  return rowToUser(await db.getUserById(id));
}

async function findByUsername(username) {
  return rowToUser(await db.getUserByUsername(username));
}

async function createUser({ username, password, role = 'admin' }) {
  if (!username || !password) throw new Error('username and password required');
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username))
    throw new Error('username must be 3–32 chars, [a-zA-Z0-9_.-]');
  if (password.length < 8) throw new Error('password must be at least 8 characters');
  if (await db.getUserByUsername(username)) throw new Error('username already taken');

  const passwordHash = await hashPassword(password);
  return rowToUser(await db.createUser({ username, passwordHash, role }));
}

async function updateUsername(id, newUsername) {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(newUsername))
    throw new Error('username must be 3–32 chars, [a-zA-Z0-9_.-]');
  const collision = await db.getUserByUsername(newUsername);
  if (collision && collision.id !== id) throw new Error('username already taken');
  return rowToUser(await db.updateUsername(id, newUsername));
}

async function bootstrapAdmin() {
  const username = adminUsername();
  const existing = rowToUser(await db.getUserByUsername(username));
  if (existing) {
    if (process.env.ADMIN_PASSWORD) {
      const newHash = await hashPassword(process.env.ADMIN_PASSWORD);
      await db.setPasswordHash(existing.id, newHash);
      return { user: publicUser(existing), bootstrappedPassword: null, resynced: true };
    }
    return { user: publicUser(existing), bootstrappedPassword: null };
  }

  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const user = await createUser({ username, password, role: 'admin' });
  return { user: publicUser(user), bootstrappedPassword: password };
}

// Creator (VA) account, driven by CREATOR_USERNAME / CREATOR_PASSWORD.
// Returns { user, bootstrappedPassword } or { skipped:true } when no
// CREATOR_USERNAME is configured.
async function bootstrapCreator() {
  const username = creatorUsername();
  if (!username) return { skipped: true };

  const existing = rowToUser(await db.getUserByUsername(username));
  if (existing) {
    if (process.env.CREATOR_PASSWORD) {
      const newHash = await hashPassword(process.env.CREATOR_PASSWORD);
      await db.setPasswordHash(existing.id, newHash);
      return { user: publicUser(existing), bootstrappedPassword: null, resynced: true };
    }
    return { user: publicUser(existing), bootstrappedPassword: null };
  }

  const password =
    process.env.CREATOR_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const user = await createUser({ username, password, role: 'creator' });
  return { user: publicUser(user), bootstrappedPassword: password };
}

module.exports = {
  findById,
  findByUsername,
  createUser,
  updateUsername,
  publicUser,
  bootstrapAdmin,
  bootstrapCreator,
  isAdminUsername,
  isCreatorUsername,
  isMasterUsername,
  adminUsername,
  creatorUsername,
};
