-- 005: Cloudflare Stream delivery.
-- Run once in the Supabase SQL editor, after 004_review_feedback.sql.
--
-- Clips are copied to Cloudflare's video CDN on ingest. Once the copy is
-- ready, stream_playback_url holds the CDN MP4 URL and the app serves the
-- video from Cloudflare instead of proxying bytes through this server.

alter table videos add column if not exists stream_uid text;
alter table videos add column if not exists stream_playback_url text;
