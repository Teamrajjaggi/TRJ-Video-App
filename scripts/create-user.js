// Create a Shuffl user account. Run by the operator — bypasses the public
// signup's password-length check so the operator can choose any password.
//   node scripts/create-user.js <username> <password> [admin|creator]
require('dotenv').config();
const db = require('../lib/db');
const { hashPassword } = require('../lib/auth');

async function main() {
  const [, , username, password, role = 'admin'] = process.argv;
  if (!username || !password) {
    console.error(
      'Usage: node scripts/create-user.js <username> <password> [admin|creator]',
    );
    process.exit(1);
  }
  if (!['admin', 'creator'].includes(role)) {
    console.error(`role must be "admin" or "creator", got "${role}"`);
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    console.error('username must be 3-32 chars, [a-zA-Z0-9_.-]');
    process.exit(1);
  }
  const existing = await db.getUserByUsername(username);
  if (existing) {
    console.error(`username "${username}" already exists (id ${existing.id})`);
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  const user = await db.createUser({ username, passwordHash, role });
  console.log(`Created ${role} user "${user.username}" (id ${user.id})`);
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
