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
INVITE_CODE=shuffl123
ADMIN_API_TOKEN=efcee42aec36d31d0600171e604e1e33402b2e3db266832080a38ee81ae0d795
SESSION_SECRET=c4354b6e884d722c49bf66121bfb3c7265ffd9be7b2fdfaf5b1dd457964c153e

# Bootstrapped accounts
ADMIN_USERNAME=TVTadmin
ADMIN_PASSWORD=TVT123$
CREATOR_USERNAME=TVTuploads
CREATOR_PASSWORD=$321TVT

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

# Captions (Gemini)
GEMINI_API_KEY=<reuse TRJ's, or a new key from aistudio.google.com>
GEMINI_MODEL=gemini-2.5-flash
CAPTION_CTA=📞 Call TVT at <their phone number>

# Cloudflare Stream (reuse TRJ's account / token)
CF_ACCOUNT_ID=174948c57ca93c4b3982d6215719c770
CF_STREAM_TOKEN=<reuse TRJ's Stream:Edit token>

# Web Push — new VAPID keys for this instance
VAPID_PUBLIC_KEY=BN3amwwJbs73pUxk0rOsYaSL-wOa3kTb-HhbA7_yp-ziI1vfX6VE9MbRsye-r6tLc_q8OfuEAjqBoY1cHEKJypY
VAPID_PRIVATE_KEY=jccOKMWjNbmWSkVRL4QQ2HKuantSzxK5mFKd81W80js
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

1. Open the `.onrender.com` URL → log in as **TVTadmin / TVT123$** → empty
   feed ("All caught up").
2. In an incognito window: log in as **TVTuploads / $321TVT** → upload a
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
