// SQLite via Node's built-in `node:sqlite` (Node 22.5+). No native build,
// no Python toolchain. The "experimental" warning Node prints on startup
// is fine to ignore — the API used here (DatabaseSync + prepared
// statements) is stable.
//
// Schema is created idempotently on first start. If legacy JSON files
// exist under data/, they are imported once into the empty tables.
//
// Env:
//   DB_PATH    path to the database file. Default: data/app.db

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

let db = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  initSchema(db);
  migrateFromJsonIfNeeded(db);
  return db;
}

function initSchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username_nocase
      ON users (username COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS videos (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      src         TEXT NOT NULL,
      poster      TEXT NOT NULL DEFAULT '',
      tags        TEXT NOT NULL DEFAULT '[]',
      prompt      TEXT NOT NULL DEFAULT '',
      posted_at   TEXT NOT NULL DEFAULT (datetime('now')),
      source      TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id        TEXT PRIMARY KEY,
      video_id  TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username  TEXT,
      verdict   TEXT NOT NULL,
      comment   TEXT NOT NULL DEFAULT '',
      at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_review_verdict
      ON reviews (user_id, video_id)
      WHERE verdict IN ('like', 'dislike');
    CREATE UNIQUE INDEX IF NOT EXISTS ux_review_comment
      ON reviews (user_id, video_id)
      WHERE verdict = 'comment';

    CREATE TABLE IF NOT EXISTS drive_sync (
      drive_id   TEXT PRIMARY KEY,
      video_id   TEXT,
      r2_key     TEXT,
      r2_url     TEXT,
      synced_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id   TEXT,
      title      TEXT,
      tags       TEXT,
      reviewer   TEXT,
      comment    TEXT,
      kind       TEXT,
      has_reason INTEGER DEFAULT 0,
      at         TEXT NOT NULL DEFAULT (datetime('now')),
      consumed   INTEGER DEFAULT 0
    );

    -- Videos the master account has approved (master like = into this queue).
    CREATE TABLE IF NOT EXISTS approval_queue (
      video_id     TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
      approved_by  TEXT,
      approved_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Drive file ids the master account has rejected. Drive sync skips
    -- these so a deleted video never gets re-imported.
    CREATE TABLE IF NOT EXISTS banned_drive_ids (
      drive_id        TEXT PRIMARY KEY,
      banned_by       TEXT,
      banned_at       TEXT NOT NULL DEFAULT (datetime('now')),
      original_title  TEXT
    );
  `);
}

function tableEmpty(d, table) {
  return d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n === 0;
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function migrateFromJsonIfNeeded(d) {
  const dataDir = path.join(__dirname, '..', 'data');
  const importedFlag = path.join(dataDir, '.migrated-to-sqlite');
  if (fs.existsSync(importedFlag)) return;

  let imported = false;
  const doTransaction = (work) => {
    d.exec('BEGIN');
    try {
      work();
      d.exec('COMMIT');
    } catch (e) {
      try {
        d.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    }
  };

  if (tableEmpty(d, 'users')) {
    const users = readJsonIfExists(path.join(dataDir, 'users.json'));
    if (Array.isArray(users) && users.length) {
      const stmt = d.prepare(
        'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      );
      doTransaction(() => {
        for (const u of users) {
          stmt.run(u.id, u.username, u.passwordHash, u.role, u.createdAt);
        }
      });
      console.log(`[db] migrated ${users.length} users from users.json`);
      imported = true;
    }
  }

  if (tableEmpty(d, 'videos')) {
    const videos = readJsonIfExists(path.join(dataDir, 'videos.json'));
    if (Array.isArray(videos) && videos.length) {
      const stmt = d.prepare(`
        INSERT INTO videos (id, title, description, src, poster, tags, prompt, posted_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      doTransaction(() => {
        for (const v of videos) {
          stmt.run(
            v.id,
            v.title || '',
            v.description || '',
            v.src || '',
            v.poster || '',
            JSON.stringify(v.tags || []),
            v.prompt || '',
            v.postedAt || new Date().toISOString(),
            JSON.stringify(v.source || {}),
          );
        }
      });
      console.log(`[db] migrated ${videos.length} videos from videos.json`);
      imported = true;
    }
  }

  if (tableEmpty(d, 'reviews')) {
    const reviews = readJsonIfExists(path.join(dataDir, 'reviews.json'));
    if (Array.isArray(reviews) && reviews.length) {
      // Filter out reviews that reference users or videos no longer present.
      // The FK constraints would otherwise abort the whole migration.
      const userIds = new Set(d.prepare('SELECT id FROM users').all().map((r) => r.id));
      const videoIds = new Set(d.prepare('SELECT id FROM videos').all().map((r) => r.id));
      const stmt = d.prepare(`
        INSERT OR IGNORE INTO reviews (id, video_id, user_id, username, verdict, comment, at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      let inserted = 0;
      let skipped = 0;
      doTransaction(() => {
        for (const r of reviews) {
          if (!r.userId || !userIds.has(r.userId)) {
            skipped++;
            continue;
          }
          if (!r.videoId || !videoIds.has(r.videoId)) {
            skipped++;
            continue;
          }
          const info = stmt.run(
            r.id,
            r.videoId,
            r.userId,
            r.username || null,
            r.verdict,
            r.comment || '',
            r.at || new Date().toISOString(),
          );
          if (info.changes) inserted++;
          else skipped++;
        }
      });
      console.log(`[db] migrated ${inserted} reviews from reviews.json (skipped ${skipped} orphans)`);
      imported = true;
    }
  }

  if (tableEmpty(d, 'drive_sync')) {
    const state = readJsonIfExists(path.join(dataDir, 'drive-sync.json'));
    const map = state?.byDriveId || {};
    const rows = Object.entries(map);
    if (rows.length) {
      const stmt = d.prepare(`
        INSERT INTO drive_sync (drive_id, video_id, r2_key, r2_url, synced_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      doTransaction(() => {
        for (const [driveId, info] of rows) {
          stmt.run(driveId, info.videoId, info.r2Key, info.r2Url, info.syncedAt);
        }
      });
      console.log(`[db] migrated ${rows.length} drive-sync entries`);
      imported = true;
    }
  }

  if (tableEmpty(d, 'learning_queue')) {
    const queue = readJsonIfExists(path.join(dataDir, 'learning-queue.json'));
    if (Array.isArray(queue) && queue.length) {
      const stmt = d.prepare(`
        INSERT INTO learning_queue (video_id, title, tags, reviewer, comment, kind, has_reason, at, consumed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      doTransaction(() => {
        for (const e of queue) {
          stmt.run(
            e.videoId,
            e.title,
            JSON.stringify(e.tags || []),
            JSON.stringify(e.reviewer || null),
            e.comment || '',
            e.kind || null,
            e.hasReason ? 1 : 0,
            e.at || new Date().toISOString(),
            e.consumed ? 1 : 0,
          );
        }
      });
      console.log(`[db] migrated ${queue.length} learning-queue entries`);
      imported = true;
    }
  }

  fs.writeFileSync(importedFlag, new Date().toISOString(), 'utf8');
  if (imported) {
    console.log('[db] JSON migration complete; legacy data/*.json files can be deleted.');
  }
}

module.exports = { getDb, DB_PATH };
