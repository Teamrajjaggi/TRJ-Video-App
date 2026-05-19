# Video Review Portal

VA-driven video approval pipeline. A virtual assistant uploads candidate clips and images to a Google Drive folder; the admin reviews them in a TikTok-style feed; approved clips flow into an n8n workflow that auto-posts to TikTok and Instagram Reels.

## How it works

- A VA drops files into the **Pending** folder on Google Drive.
- The portal polls Pending on an interval and registers new files in Supabase (`status='pending'`).
- The single admin logs in and reviews the feed. **Like** approves the file (moved to **Approved** in Drive, `status='approved'`). **Dislike** rejects it (moved to **Trash**, drive_file_id banned, `status='rejected'`).
- A separate n8n workflow watches the Approved folder, posts each clip to TikTok and Instagram Reels, and moves the file to **Posted** (`status='posted'`).
- Files in **Trash** are purged after a configurable retention window.

## Stack

- Node 22+ / Express
- Supabase Postgres (auth, videos, comments, banned ids)
- Google Drive (sole storage — no R2/S3)
- n8n (Phase 4) for auto-post

## Setup

```bash
npm install
cp .env.example .env
# Fill in the values — at minimum:
#   INVITE_CODE, ADMIN_API_TOKEN, SESSION_SECRET
#   ADMIN_USERNAME, ADMIN_PASSWORD
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   GOOGLE_SERVICE_ACCOUNT_JSON (or _FILE)
#   DRIVE_{PENDING,APPROVED,TRASH,POSTED}_FOLDER_ID
```

Run the schema migration against your Supabase project once. In the Supabase SQL editor, paste the contents of `db/migrations/001_init.sql` and execute.

Then:

```bash
npm start
```

The portal listens on `PORT` (default 3000). On first start the admin user is created with `ADMIN_USERNAME` and `ADMIN_PASSWORD`; if `ADMIN_PASSWORD` is unset a random one is printed once to stdout.

## Drive folder model

Create four Drive folders and share each with the service account's `client_email` (Editor). Paste their IDs into the matching env vars:

| Folder    | Purpose                                          | Env var                      |
| --------- | ------------------------------------------------ | ---------------------------- |
| Pending   | VA uploads here. Scanned by the sync job.        | `DRIVE_PENDING_FOLDER_ID`    |
| Approved  | Approve action moves the file here.              | `DRIVE_APPROVED_FOLDER_ID`   |
| Trash     | Reject action moves the file here. Auto-purged.  | `DRIVE_TRASH_FOLDER_ID`      |
| Posted    | n8n moves files here after a successful post.    | `DRIVE_POSTED_FOLDER_ID`     |

## API

| Method | Path                            | Auth        | Notes                                                  |
| ------ | ------------------------------- | ----------- | ------------------------------------------------------ |
| POST   | `/api/signup`                   | invite code | Creates an admin user                                  |
| POST   | `/api/login`                    |             | Body: `{ username, password }`                         |
| POST   | `/api/logout`                   |             |                                                        |
| GET    | `/api/me`                       | cookie      |                                                        |
| PATCH  | `/api/me`                       | cookie      | Body: `{ username }`                                   |
| GET    | `/api/videos`                   | cookie      | Pending feed                                           |
| POST   | `/api/review`                   | cookie      | Body: `{ videoId, verdict: like\|dislike }`            |
| POST   | `/api/comment`                  | cookie      | Body: `{ videoId, comment }`                           |
| GET    | `/api/admin/approved`           | admin+token | Approved-but-not-posted queue                          |
| POST   | `/api/admin/approved/:id/posted`| admin+token | Mark posted (called by n8n)                            |
| DELETE | `/api/admin/approved/:id`       | admin+token | Un-approve (status back to pending)                    |
| GET    | `/api/admin/banned`             | admin+token | Banned drive_file_ids                                  |
| DELETE | `/api/admin/banned/:driveId`    | admin+token | Unban a drive_file_id                                  |
| DELETE | `/api/admin/videos/:id`         | admin+token | Hard-delete a video row                                |

## Phase 4 workflows

n8n workflows live under `workflows/`. The autopost stub is at [`workflows/n8n-autopost-stub.ts`](workflows/n8n-autopost-stub.ts). The full posting workflow lands in Phase 4.
