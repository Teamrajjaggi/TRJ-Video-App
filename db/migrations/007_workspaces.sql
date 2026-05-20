-- 007: Multi-tenant foundation. Every business is a "workspace".
-- Run once in the Supabase SQL editor, after 006_notifications.sql.
--
-- After this migration every content row belongs to a workspace, and a
-- user reaches a workspace through a membership (a user may belong to
-- more than one). All existing data is moved into a first workspace.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- per-workspace config: drive folder ids, caption CTA / brand voice…
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- A user belongs to a workspace through a membership; role is per-workspace.
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'creator')),
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);
create index if not exists memberships_user_idx on memberships(user_id);
create index if not exists memberships_workspace_idx on memberships(workspace_id);

-- Tenant scoping: every content table carries a workspace_id.
alter table videos add column if not exists workspace_id uuid references workspaces(id);
alter table comments add column if not exists workspace_id uuid references workspaces(id);
alter table notifications add column if not exists workspace_id uuid references workspaces(id);
alter table push_subscriptions add column if not exists workspace_id uuid references workspaces(id);
alter table banned_drive_ids add column if not exists workspace_id uuid references workspaces(id);

-- Backfill: move all existing data into one workspace and turn the
-- existing global users.role into memberships of that workspace.
do $$
declare ws_id uuid;
begin
  select id into ws_id from workspaces order by created_at limit 1;
  if ws_id is null then
    insert into workspaces (name) values ('Default Workspace') returning id into ws_id;
  end if;

  update videos             set workspace_id = ws_id where workspace_id is null;
  update comments           set workspace_id = ws_id where workspace_id is null;
  update notifications      set workspace_id = ws_id where workspace_id is null;
  update push_subscriptions set workspace_id = ws_id where workspace_id is null;
  update banned_drive_ids   set workspace_id = ws_id where workspace_id is null;

  insert into memberships (user_id, workspace_id, role)
    select id, ws_id, role from users
    on conflict (user_id, workspace_id) do nothing;
end $$;

-- Now that every row is tagged, require it going forward — a missing
-- workspace_id should fail loudly, never leak across tenants.
alter table videos             alter column workspace_id set not null;
alter table comments           alter column workspace_id set not null;
alter table notifications      alter column workspace_id set not null;
alter table push_subscriptions alter column workspace_id set not null;
alter table banned_drive_ids   alter column workspace_id set not null;

create index if not exists videos_workspace_idx on videos(workspace_id, status);
create index if not exists comments_workspace_idx on comments(workspace_id);
create index if not exists notifications_ws_user_idx on notifications(workspace_id, user_id);
