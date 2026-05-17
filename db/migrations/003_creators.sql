-- 003: Creator role + creator uploads + rejection reasons.
-- Run once in the Supabase SQL editor, after 002_captions.sql.
--
-- A "creator" is a VA who uploads clips through the app. Admin still
-- reviews everything. When a clip is rejected the admin picks a reason
-- so the creator knows what to fix.

-- Allow the 'creator' role alongside 'admin'.
alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check check (role in ('admin', 'creator'));

-- Who uploaded the clip (null for files synced straight from Drive).
alter table videos add column if not exists uploaded_by uuid references users(id);

-- Why a clip was rejected — shown back to the creator.
alter table videos add column if not exists rejection_reason text;
alter table videos add column if not exists rejection_note text;

create index if not exists videos_uploaded_by_idx on videos(uploaded_by);
