# Setting up a second Shuffl instance (TVT)

Same codebase, separate backend. Each instance has its own users, videos,
Drive folders, and database — fully isolated from TRJ.

## What to reuse vs make new

**Reuse** (one set across all instances):
- Drive service account (`trjvideoreview@sacred-union-…iam.gserviceaccount.com`)
- Cloudflare account + Stream API token
- Gemini API key

**New per instance** (so data is isolated):
- Supabase project
- Google Drive Shared Drive + 4 folders
- Render web service
- VAPID keys (Web Push)
- `ADMIN_API_TOKEN` + `SESSION_SECRET`

## Step 1 — Supabase project

1. [supabase.com](https://supabase.com) → New project → name `shuffl-tvt`.
2. Settings → API → copy the **Project URL** and the **service_role key**
   (the long one — not the anon key).
3. SQL Editor → run each migration in order from `video-review/db/migrations/`:
   `001_init.sql`, `002_captions.sql`, `003_creators.sql`,
   `004_review_feedback.sql`, `005_cloudflare_stream.sql`,
   `006_notifications.sql`. **Skip 007** — that's for the future SaaS path,
   not single-tenant.

## Step 2 — Drive Shared Drive

1. [drive.google.com](https://drive.google.com) → left sidebar **Shared drives**
   → New → name it `Shuffl TVT`.
2. Inside it, create 4 folders: `Pending`, `Approved`, `Trash`, `Posted`.
3. Right-click the Shared Drive → **Manage members** → add this email as
   **Content manager** (or Manager — Manager lets the auto-purge actually
   delete files instead of just trashing them):
   ```
   trjvideoreview@sacred-union-496415-p6.iam.gserviceaccount.com
   ```
4. Open each folder and copy its id from the URL (the part after `/folders/`).

## Step 3 — Render web service

1. Render dashboard → **New** → **Web Service**.
2. Connect the **same** GitHub repo as TRJ (`TRJ-Video-App`).
3. Settings:
   - Branch: `main`
   - Root directory: `video-review`
   - Build command: `npm install`
   - Start command: `node server.js`
   - Instance type: **Starter ($7)** (Free spins down → cold starts).
4. Paste the env vars block from Step 4, then **Create web service**.

## Step 4 — Env vars (copy-paste into Render)

VAPID and secrets below were freshly generated for this instance — they're
not shared with TRJ. Fill in the bracketed values from the earlier steps.

```
# Auth & secrets (this instance only)
INVITE_CODE=shuffl-tvt-invite
ADMIN_API_TOKEN=7153d08429427b2059d979d5979ae10ab082cacfb33521aeb51ec51112640a51
SESSION_SECRET=28a6b20cdd89c0c6b5f54f4d19906bbeff91e9d1185d39b8a53cd8083d4c64ba

# Bootstrapped accounts
ADMIN_USERNAME=TVTadmin
ADMIN_PASSWORD=TVTadmin123$
CREATOR_USERNAME=TVTuploads
CREATOR_PASSWORD=TVTuploads123$

# Supabase (Step 1)
SUPABASE_URL=<paste Project URL>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key>

# Drive (Step 2) — paste the whole service-account JSON as ONE value
GOOGLE_SERVICE_ACCOUNT_JSON=<paste contents of sa-key.json>
DRIVE_PENDING_FOLDER_ID=<paste id>
DRIVE_APPROVED_FOLDER_ID=<paste id>
DRIVE_TRASH_FOLDER_ID=<paste id>
DRIVE_POSTED_FOLDER_ID=<paste id>

# Housekeeping
TRASH_RETENTION_DAYS=14

# Captions (Gemini) — reuse TRJ's key, or grab a new one from aistudio.google.com
GEMINI_API_KEY=<reuse TRJ's, or a new key from aistudio.google.com>
GEMINI_MODEL=gemini-2.5-flash
# Engagement-driven voice: end with a question or prompt that invites a
# comment. No CTA appended — add CAPTION_CTA later if/when needed.
CAPTION_BRAND_PROMPT=You write short, engaging social-media captions for short video clips posted to TikTok and Instagram Reels. Lean into curiosity and viewer engagement — end with a question or prompt that invites a comment (e.g. "Who do you think wins?", "What would you do?", "Which side are you on?"). The voice is energetic, modern, and confident — never corporate or hashtag-stuffed. Never include a phone number, "call us", or "DM us" — those are appended separately when needed.
CAPTION_CTA=

# Cloudflare Stream (reuse TRJ's account / token)
CF_ACCOUNT_ID=174948c57ca93c4b3982d6215719c770
CF_STREAM_TOKEN=<reuse TRJ's Stream:Edit token>

# Web Push — new VAPID keys for this instance
VAPID_PUBLIC_KEY=BGTJZQK7C2w-s53UKkVlhNrcnGlJ6DXnbUR-829Lhw8r_I0Q7dsEdigRkANpoihLj8gA6AbfEB2s6BY-gmYiKLY
VAPID_PRIVATE_KEY=KC2MqFAWAa4igM6RBFevHO5vvEFGLv8sdke3iTlFf0I
VAPID_SUBJECT=mailto:<owner email>
```

## Step 5 — First deploy

Save env vars → Render redeploys. In the logs you should see:
```
Admin account "TVTadmin" bootstrapped.
Creator account "TVTuploads" bootstrapped.
Video review portal running on http://localhost:10000
```

Both accounts now exist in Supabase.

## Step 6 — Smoke test

1. Open the `.onrender.com` URL → log in as **TVTadmin / TVTadmin123$** → empty
   feed ("All caught up").
2. In an incognito window: log in as **TVTuploads / TVTuploads123$** → upload a
   short video.
3. Back in the admin window → wait ≤60 s (auto-poll) → the clip appears →
   swipe right → caption generates → it shows up in the VA's "Ready to
   post" section.

If anything fails, the Render logs say why.

## Step 7 — Optional polish

- **Custom domain** (e.g. `shuffl.tvt-domain.com`): Render → Settings →
  Custom Domain → follow the DNS instructions.
- **Install as PWA** on phone: Safari/Chrome → Share → Add to Home Screen.
- **Push notifications**: in the app, tap the bell → "Enable push" →
  allow the permission prompt. (iPhone requires the PWA installed first.)
