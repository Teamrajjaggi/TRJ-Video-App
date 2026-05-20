// Apply Shuffl migrations against a target Supabase Postgres.
//
// Usage:
//   PGURI='postgresql://postgres:<password>@<host>:<port>/postgres' \
//     node scripts/apply-migrations.js [--all]
//
// By default skips 007_workspaces.sql (that's the future multi-tenant
// SaaS path; single-tenant deployments don't want it). Pass --all to
// include every file.

const fs = require('fs');
const path = require('path');

// Parse a postgres URI by hand — the password may legally contain '@' or
// other URL-unsafe characters, so we split on the LAST '@' (host boundary)
// instead of letting URL parsers guess wrong.
function parsePgUri(uri) {
  const m = /^postgres(?:ql)?:\/\/(.+)$/.exec(uri);
  if (!m) throw new Error('URI must start with postgres:// or postgresql://');
  const after = m[1];
  const lastAt = after.lastIndexOf('@');
  if (lastAt < 0) throw new Error('URI missing host');
  const userinfo = after.slice(0, lastAt);
  const hostpart = after.slice(lastAt + 1);
  const firstColon = userinfo.indexOf(':');
  if (firstColon < 0) throw new Error('URI missing password');
  const user = userinfo.slice(0, firstColon);
  const password = userinfo.slice(firstColon + 1);
  const [hostport, ...pathParts] = hostpart.split('/');
  const [host, portStr] = hostport.split(':');
  const port = portStr ? parseInt(portStr, 10) : 5432;
  const database = (pathParts.join('/') || 'postgres').split('?')[0];
  return { user, password, host, port, database };
}

async function main() {
  const uri = process.env.PGURI;
  if (!uri) {
    console.error('PGURI env var required');
    process.exit(1);
  }
  const includeAll = process.argv.includes('--all');

  const { Client } = require('pg');
  const conn = parsePgUri(uri);
  console.log(
    `Connecting to ${conn.host}:${conn.port} db=${conn.database} user=${conn.user}`,
  );

  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const toRun = includeAll ? files : files.filter((f) => !/^007_/.test(f));

  console.log(`Will apply ${toRun.length} migration(s):`);
  toRun.forEach((f) => console.log('  -', f));
  if (!includeAll) console.log("Skipping 007_*.sql (single-tenant). Pass --all to include.");

  const client = new Client({
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    for (const f of toRun) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      process.stdout.write(`  Applying ${f}... `);
      try {
        await client.query(sql);
        console.log('OK');
      } catch (e) {
        console.log('FAILED');
        console.error(`\nError in ${f}:\n${e.message}\n`);
        process.exit(2);
      }
    }

    const { rows } = await client.query(
      "select table_name from information_schema.tables where table_schema='public' order by table_name",
    );
    console.log('\nPublic tables after migration:');
    rows.forEach((r) => console.log('  -', r.table_name));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
