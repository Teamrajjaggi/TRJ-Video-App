-- 006: In-app + Web Push notifications.
-- Run once in the Supabase SQL editor, after 005_cloudflare_stream.sql.

-- One row per notification shown to a user (the bell list).
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,                       -- 'upload' | 'review' | 'posted'
  title text not null,
  body text,
  video_id uuid references videos(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on notifications(user_id, read, created_at desc);

-- Web Push subscriptions (one per browser/device a user enabled push on).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx
  on push_subscriptions(user_id);
