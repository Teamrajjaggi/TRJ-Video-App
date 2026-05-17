// Supabase-backed data layer. Service-role key, server-side only.
// RLS is bypassed because we never expose the Supabase client to browsers.

const { createClient } = require('@supabase/supabase-js');

let client = null;

function init() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

function sb() {
  return client || init();
}

function unwrap({ data, error }, ctx) {
  if (error) throw new Error(`[db] ${ctx}: ${error.message}`);
  return data;
}

// ---------- users ----------

async function getUserByUsername(username) {
  const { data, error } = await sb()
    .from('users')
    .select('*')
    .ilike('username', String(username || ''))
    .maybeSingle();
  if (error) throw new Error(`[db] getUserByUsername: ${error.message}`);
  return data || null;
}

async function getUserById(id) {
  const { data, error } = await sb()
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`[db] getUserById: ${error.message}`);
  return data || null;
}

async function createUser({ username, passwordHash, role = 'admin' }) {
  return unwrap(
    await sb()
      .from('users')
      .insert({ username, password_hash: passwordHash, role })
      .select()
      .single(),
    'createUser',
  );
}

async function updateUsername(id, username) {
  return unwrap(
    await sb()
      .from('users')
      .update({ username })
      .eq('id', id)
      .select()
      .single(),
    'updateUsername',
  );
}

async function setPasswordHash(id, passwordHash) {
  return unwrap(
    await sb()
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', id)
      .select()
      .single(),
    'setPasswordHash',
  );
}

// ---------- videos ----------

// posted: true  -> only rows with a posted_at
// posted: false -> only rows without a posted_at
// posted omitted -> no constraint
async function listVideos({ status = 'pending', posted } = {}) {
  let query = sb().from('videos').select('*').eq('status', status);
  if (posted === true) query = query.not('posted_at', 'is', null);
  else if (posted === false) query = query.is('posted_at', null);
  return unwrap(
    await query.order('created_at', { ascending: true }),
    'listVideos',
  );
}

async function getVideo(id) {
  const { data, error } = await sb()
    .from('videos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`[db] getVideo: ${error.message}`);
  return data || null;
}

async function getVideoByDriveFileId(driveFileId) {
  const { data, error } = await sb()
    .from('videos')
    .select('*')
    .eq('drive_file_id', driveFileId)
    .maybeSingle();
  if (error) throw new Error(`[db] getVideoByDriveFileId: ${error.message}`);
  return data || null;
}

async function upsertVideoFromDrive({
  driveFileId,
  filename,
  mimeType,
  kind,
  thumbnailUrl,
  streamUrl,
  uploadedBy,
}) {
  const row = {
    drive_file_id: driveFileId,
    filename,
    mime_type: mimeType,
    kind,
    thumbnail_url: thumbnailUrl,
    stream_url: streamUrl,
  };
  if (uploadedBy !== undefined) row.uploaded_by = uploadedBy;
  return unwrap(
    await sb()
      .from('videos')
      .upsert(row, { onConflict: 'drive_file_id', ignoreDuplicates: false })
      .select()
      .single(),
    'upsertVideoFromDrive',
  );
}

// Every video a given creator has uploaded, newest first, all statuses.
async function listVideosByUploader(uploadedBy) {
  return unwrap(
    await sb()
      .from('videos')
      .select('*')
      .eq('uploaded_by', uploadedBy)
      .order('created_at', { ascending: false }),
    'listVideosByUploader',
  );
}

async function updateVideoStatus(id, status, extras = {}) {
  const patch = { status };
  if (extras.reviewed_at !== undefined) patch.reviewed_at = extras.reviewed_at;
  if (extras.posted_at !== undefined) patch.posted_at = extras.posted_at;
  if (extras.trim_start_seconds !== undefined)
    patch.trim_start_seconds = extras.trim_start_seconds;
  if (extras.trim_end_seconds !== undefined)
    patch.trim_end_seconds = extras.trim_end_seconds;
  if (extras.crop_box !== undefined) patch.crop_box = extras.crop_box;
  if (extras.rejection_reason !== undefined)
    patch.rejection_reason = extras.rejection_reason;
  if (extras.rejection_note !== undefined)
    patch.rejection_note = extras.rejection_note;
  if (extras.approval_reason !== undefined)
    patch.approval_reason = extras.approval_reason;
  if (extras.approval_note !== undefined)
    patch.approval_note = extras.approval_note;
  return unwrap(
    await sb().from('videos').update(patch).eq('id', id).select().single(),
    'updateVideoStatus',
  );
}

async function deleteVideo(id) {
  const { error } = await sb().from('videos').delete().eq('id', id);
  if (error) throw new Error(`[db] deleteVideo: ${error.message}`);
  return true;
}

// Apply an approved edit: the row now points at the edited Drive file.
// Only whitelisted columns are written.
async function applyEdit(id, fields = {}) {
  const allowed = [
    'drive_file_id',
    'filename',
    'mime_type',
    'status',
    'reviewed_at',
    'trim_start_seconds',
    'trim_end_seconds',
    'crop_box',
  ];
  const patch = {};
  for (const k of allowed) if (fields[k] !== undefined) patch[k] = fields[k];
  return unwrap(
    await sb().from('videos').update(patch).eq('id', id).select().single(),
    'applyEdit',
  );
}

// Patch caption fields. Any of caption / hashtags / status / error may be
// passed; only the provided keys are written.
async function setCaption(id, { caption, hashtags, status, error } = {}) {
  const patch = {};
  if (caption !== undefined) patch.caption = caption;
  if (hashtags !== undefined) patch.hashtags = hashtags;
  if (status !== undefined) patch.caption_status = status;
  if (error !== undefined) patch.caption_error = error;
  return unwrap(
    await sb().from('videos').update(patch).eq('id', id).select().single(),
    'setCaption',
  );
}

// ---------- banned drive ids ----------

async function banDriveId(driveFileId) {
  const { error } = await sb()
    .from('banned_drive_ids')
    .upsert({ drive_file_id: driveFileId }, { onConflict: 'drive_file_id' });
  if (error) throw new Error(`[db] banDriveId: ${error.message}`);
  return true;
}

async function unbanDriveId(driveFileId) {
  const { error } = await sb()
    .from('banned_drive_ids')
    .delete()
    .eq('drive_file_id', driveFileId);
  if (error) throw new Error(`[db] unbanDriveId: ${error.message}`);
  return true;
}

async function isDriveIdBanned(driveFileId) {
  const { data, error } = await sb()
    .from('banned_drive_ids')
    .select('drive_file_id')
    .eq('drive_file_id', driveFileId)
    .maybeSingle();
  if (error) throw new Error(`[db] isDriveIdBanned: ${error.message}`);
  return Boolean(data);
}

async function listBannedDriveIds() {
  return unwrap(
    await sb()
      .from('banned_drive_ids')
      .select('*')
      .order('banned_at', { ascending: false }),
    'listBannedDriveIds',
  );
}

// ---------- comments ----------

async function addComment(videoId, body) {
  return unwrap(
    await sb()
      .from('comments')
      .insert({ video_id: videoId, body })
      .select()
      .single(),
    'addComment',
  );
}

async function listComments(videoId) {
  return unwrap(
    await sb()
      .from('comments')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true }),
    'listComments',
  );
}

module.exports = {
  init,
  getUserByUsername,
  getUserById,
  createUser,
  updateUsername,
  setPasswordHash,
  listVideos,
  getVideo,
  getVideoByDriveFileId,
  upsertVideoFromDrive,
  listVideosByUploader,
  updateVideoStatus,
  deleteVideo,
  applyEdit,
  setCaption,
  banDriveId,
  unbanDriveId,
  isDriveIdBanned,
  listBannedDriveIds,
  addComment,
  listComments,
};
