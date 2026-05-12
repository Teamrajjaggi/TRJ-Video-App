const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashPassword } = require('./auth');

const USERS_PATH = path.join(__dirname, '..', 'data', 'users.json');

function readUsers() {
  if (!fs.existsSync(USERS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function findById(id) {
  return readUsers().find((u) => u.id === id) || null;
}

function findByUsername(username) {
  const lc = String(username || '').toLowerCase();
  return readUsers().find((u) => u.username.toLowerCase() === lc) || null;
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, role: u.role, createdAt: u.createdAt };
}

async function createUser({ username, password, role = 'user' }) {
  if (!username || !password) throw new Error('username and password required');
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username))
    throw new Error('username must be 3–32 chars, [a-zA-Z0-9_.-]');
  if (password.length < 8) throw new Error('password must be at least 8 characters');
  if (findByUsername(username)) throw new Error('username already taken');

  const users = readUsers();
  const user = {
    id: newId('usr'),
    username,
    passwordHash: await hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  return user;
}

async function updateUsername(id, newUsername) {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(newUsername))
    throw new Error('username must be 3–32 chars, [a-zA-Z0-9_.-]');
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('user not found');
  if (
    users.some(
      (u) => u.id !== id && u.username.toLowerCase() === newUsername.toLowerCase(),
    )
  ) {
    throw new Error('username already taken');
  }
  users[idx].username = newUsername;
  writeUsers(users);
  return users[idx];
}

async function bootstrapAdmin() {
  const existing = findByUsername('claude');
  if (existing) return { user: publicUser(existing), bootstrappedPassword: null };

  const password =
    process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const user = await createUser({ username: 'claude', password, role: 'admin' });
  return { user: publicUser(user), bootstrappedPassword: password };
}

module.exports = {
  USERS_PATH,
  readUsers,
  findById,
  findByUsername,
  createUser,
  updateUsername,
  publicUser,
  bootstrapAdmin,
};
