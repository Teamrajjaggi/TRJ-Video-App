-- 004: Positive feedback captured when a clip is approved.
-- Run once in the Supabase SQL editor, after 003_creators.sql.
--
-- Mirrors rejection_reason / rejection_note (003) for the approve side:
-- when the reviewer swipes right they can note what worked, and the
-- creator sees it on their uploads list.

alter table videos add column if not exists approval_reason text;
alter table videos add column if not exists approval_note text;
