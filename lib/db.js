// SQLite (better-sqlite3) database — single source of truth for users,
// videos, reviews, drive-sync state, and the learning queue.
//
// On first start the schema is created idempotently. If legacy JSON files
// exist under data/, they are imported once into the empty tables.
//
// Env:
//   DB_PATH    path to the database file. Default: data/app.db

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

let db = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
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
    -- one verdict (like or dislike) per (user, video)
    CREATE UNIQUE INDEX IF NOT EXISTS ux_review_verdict
      ON reviews (user_id, video_id)
      WHERE verdict IN ('like', 'dislike');
    -- one comment per (user, video)
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

  if (tableEmpty(d, 'users')) {
    const users = readJsonIfExists(path.join(dataDir, 'users.json'));
    if (Array.isArray(users) && users.length) {
      const stmt = d.prepare(
        'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      );
      const tx = d.transaction((rows) => {
        for (const u of rows) {
          stmt.run(u.id, u.username, u.passwordHash, u.role, u.createdAt);
        }
      });
      tx(users);
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
      const tx = d.transaction((rows) => {
        for (const v of rows) {
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
      tx(videos);
      console.log(`[db] migrated ${videos.length} videos from videos.json`);
      imported = true;
    }
  }

  if (tableEmpty(d, 'reviews')) {
    const reviews = readJsonIfExists(path.join(dataDir, 'reviews.json'));
    if (Array.isArray(reviews) && reviews.length) {
      const stmt = d.prepare(`
        INSERT OR IGNORE INTO reviews (id, video_id, user_id, username, verdict, comment, at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = d.transaction((rows) => {
        for (const r of rows) {
          stmt.run(
            r.id,
            r.videoId,
            r.userId || '',
            r.username || null,
            r.verdict,
            r.comment || '',
            r.at || new Date().toISOString(),
          );
        }
      });
      tx(reviews);
      console.log(`[db] migrated ${reviews.length} reviews from reviews.json`);
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
      const tx = d.transaction((entries) => {
        for (const [driveId, info] of entries) {
          stmt.run(driveId, info.videoId, info.r2Key, info.r2Url, info.syncedAt);
        }
      });
      tx(rows);
      console.log(`[db] migrated ${rows.length} drive-sync entries from drive-sync.json`);
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
      const tx = d.transaction((rows) => {
        for (const e of rows) {
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
      tx(queue);
      console.log(`[db] migrated ${queue.length} learning-queue entries`);
      imported = true;
    }
  }

  // Mark migration done so we don't re-import on next boot.
  fs.writeFileSync(importedFlag, new Date().toISOString(), 'utf8');
  if (imported) {
    console.log('[db] JSON migration complete; legacy data/*.json files can be deleted.');
  }
}

module.exports = { getDb, DB_PATH };
