-- Users (replaces the SQLite users table)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- Videos (the feed)
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text unique not null,
  filename text not null,
  mime_type text not null,         -- 'video/mp4', 'image/png', etc.
  kind text not null check (kind in ('video','image')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','posted')),
  thumbnail_url text,              -- Drive thumbnail link
  stream_url text,                 -- signed/proxied URL the frontend plays
  trim_start_seconds numeric,      -- set on approve if video was trimmed
  trim_end_seconds numeric,
  crop_box jsonb,                  -- set on approve if image was cropped: {x,y,width,height}
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  posted_at timestamptz
);

create index if not exists videos_status_idx on videos(status);
create index if not exists videos_drive_file_id_idx on videos(drive_file_id);

-- Banned Drive file IDs (rejected files we never re-import)
create table if not exists banned_drive_ids (
  drive_file_id text primary key,
  banned_at timestamptz not null default now()
);

-- Comments (flat, no vocabulary buckets)
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_video_id_idx on comments(video_id);

-- Session storage (replaces cookie-signed sessions if we want server-side sessions; keep cookie-parser for now, leave this table unused unless needed)
