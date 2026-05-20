# Setting up a second Shuffl instance

Same codebase, separate backend. Each instance has its own users, videos,
Drive folders, database, and service account — fully isolated from the
first.

This is a generic runbook. Replace every `<...>` placeholder with values
you generate or look up for **this** instance. Don't commit literal
secrets into this file.

## What to reuse vs make new

**Reuse** (one set across all instances, by choice — rotate later if you
want stricter separation):
- Cloudflare account + Stream API token (one Stream library for all clips)
- Gemini API key (one billed account)

**New per instance** (so data is isolated):
- Supabase project
- Google Cloud project + service account + Drive folders
- Render web service
- VAPID keypair (Web Push)
- `INVITE_CODE`, `ADMIN_API_TOKEN`, `SESSION_SECRET`

## Step 1 — Supabase project

1. [supabase.com](https://supabase.com) → New project → name `shuffl-<tenant>`
   (e.g. `shuffl-tvt`).
2. Save the database password somewhere safe (you won't need it for the
   app, but you'll want it for direct DB access).
3. Settings → API → copy the **Project URL** and the **service_role key**
   (the long `eyJ…` JWT — not the anon key).
4. SQL Editor → run each migration in order from `video-review/db/migrations/`:
   `001_init.sql`, `002_captions.sql`, `003_creators.sql`,
   `004_review_feedback.sql`, `005_cloudflare_stream.sql`,
   `006_notifications.sql`. **Skip 007** — that's the future SaaS path,
   not single-tenant.

If you have the Postgres connection string (from Settings → Database →
Connect → Transaction pooler), you can also run all 6 in one shot:
```
PGURI='postgresql://…' node scripts/apply-migrations.js
```

## Step 2 — Google Cloud project + service account

For full isolation, create a **new GCP project** per business so billing,
quotas, and audit logs are separate.

1. [console.cloud.google.com](https://console.cloud.google.com) → top-left
   project picker → **New Project** → name `shuffl-<tenant>` → Create.
2. With the new project selected: **APIs & Services → Library** → search
   "Google Drive API" → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it `<tenant>-shuffl` (e.g. `tvt-shuffl`). Skip the optional
   "Grant access" steps → Done.
4. Click into the new SA → **Keys → Add key → Create new key → JSON →
   Create**. A `.json` file downloads — save it as
   `<tenant>-sa-key.json` somewhere safe. You'll paste its full contents
   into `GOOGLE_SERVICE_ACCOUNT_JSON`.
5. Copy the SA's `client_email` (looks like
   `<tenant>-shuffl@<project>.iam.gserviceaccount.com`). You'll share
   the Drive folders with it in Step 3.

## Step 3 — Drive folders

Two paths:

### 3a. Workspace account (proper Shared Drive)
1. [drive.google.com](https://drive.google.com) → Shared drives → New →
   name `Shuffl <tenant>`.
2. Inside it: create 4 folders — `Pending`, `Approved`, `Trash`, `Posted`.
3. Manage members on the Shared Drive → add the SA `client_email` from
   Step 2 as **Manager** (Manager lets the auto-purge actually delete
   files instead of just trashing them).

### 3b. Personal Gmail account (regular folders — works on free Gmail)
1. [drive.google.com](https://drive.google.com) → My Drive → New folder
   `Shuffl <tenant>`.
2. Inside it: create 4 folders — `Pending`, `Approved`, `Trash`, `Posted`.
3. Right-click `Shuffl <tenant>` → Share → add the SA `client_email`
   from Step 2 as **Editor**. Sharing the parent cascades to the 4
   sub-folders so you only do this once.
4. Untick "Notify people" (the SA can't receive email anyway) → Share.

For both paths: open each of the 4 folders, copy the part of the URL
after `/folders/`. Those are your folder IDs.

## Step 4 — Render web service

1. Render dashboard → **New** → **Web Service**.
2. Connect the **same** GitHub repo as the first instance
   (`Teamrajjaggi/TRJ-Video-App`).
3. Settings:
   - Branch: `main`
   - Root directory: `video-review`
   - Build command: `npm install`
   - Start command: `node server.js`
   - Instance type: **Starter ($7)** — Free spins down after 15 min idle,
     which means cold-start delays in the feed.
4. Paste the env vars block from Step 5, then **Create web service**.

## Step 5 — Env vars (paste into Render)

Generate fresh secrets — the leaked old ones below should NOT be reused.

```
# Auth & secrets — fresh per instance
INVITE_CODE=<generate: openssl rand -hex 16>
ADMIN_API_TOKEN=<generate: openssl rand -hex 32>
SESSION_SECRET=<generate: openssl rand -hex 32>

# Bootstrapped accounts — your choice
ADMIN_USERNAME=<your admin login, e.g. TVTadmin>
ADMIN_PASSWORD=<strong password>
CREATOR_USERNAME=<your creator/VA login, e.g. TVTuploads>
CREATOR_PASSWORD=<strong password>

# Supabase (Step 1)
SUPABASE_URL=<paste Project URL>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key (eyJ… JWT)>

# Drive (Step 2 + 3) — paste the whole service-account JSON as ONE value
GOOGLE_SERVICE_ACCOUNT_JSON=<paste contents of <tenant>-sa-key.json>
DRIVE_PENDING_FOLDER_ID=<paste id>
DRIVE_APPROVED_FOLDER_ID=<paste id>
DRIVE_TRASH_FOLDER_ID=<paste id>
DRIVE_POSTED_FOLDER_ID=<paste id>

# Housekeeping
TRASH_RETENTION_DAYS=14

# Captions (Gemini) — reuse a shared key or get a new one
GEMINI_API_KEY=<reuse, or new key from aistudio.google.com>
GEMINI_MODEL=gemini-2.5-flash
# Override the brand voice + CTA per instance. CAPTION_CTA can be empty.
CAPTION_BRAND_PROMPT=<one paragraph describing this instance's voice>
CAPTION_CTA=

# Cloudflare Stream — reuse or new account
CF_ACCOUNT_ID=<account id>
CF_STREAM_TOKEN=<Stream:Edit token>

# Web Push — fresh VAPID keypair per instance
VAPID_PUBLIC_KEY=<generate: npx web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<generate: npx web-push generate-vapid-keys>
VAPID_SUBJECT=mailto:<contact email>
```

## Step 6 — First deploy

Save env vars → Render redeploys. In the logs you should see:
```
Admin account "<your ADMIN_USERNAME>" bootstrapped.
Creator account "<your CREATOR_USERNAME>" bootstrapped.
Video review portal running on http://localhost:10000
```

Both accounts now exist in Supabase.

## Step 7 — Smoke test

1. Open the `.onrender.com` URL → log in as the admin → empty feed
   ("All caught up").
2. In an incognito window: log in as the creator → upload a short video.
3. Back in the admin window → wait ≤60 s (auto-poll) → the clip appears →
   swipe right → caption generates → it shows up in the creator's "Ready
   to post" section.

If anything fails, the Render logs say why.

## Step 8 — Optional polish

- **Custom domain** (e.g. `shuffl.<tenant-domain>.com`): Render → Settings
  → Custom Domain → follow the DNS instructions.
- **Install as PWA** on phone: Safari/Chrome → Share → Add to Home Screen.
- **Push notifications**: in the app, tap the bell → "Enable push" →
  allow the permission prompt. (iPhone requires the PWA installed first.)
