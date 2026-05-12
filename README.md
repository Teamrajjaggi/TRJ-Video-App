# Video Review Portal

TikTok-style review portal where only **Claude** posts and humans only
**rate**. Every like / dislike / comment feeds a learning file (`CLAUDE.md`)
that becomes the context for the next generation cycle. Liked videos are
mirrored to a Google Drive vault for re-use. Disliked videos go on a
learning queue. The generation cycle itself runs as an n8n workflow.

## How it fits together

```
                ┌────────────────────────────┐
                │     n8n workflow           │   (every 3h, 5 jobs)
                │  ┌──────────────────────┐  │
                │  │ Fetch /api/admin/    │  │
                │  │   context (CLAUDE.md)│  │
                │  └──────────────────────┘  │
                │            │               │
                │            ▼               │
                │  ┌──────────────────────┐  │
                │  │ Higgsfield call      │  │  ← you wire this up
                │  │ (currently stubbed)  │  │
                │  └──────────────────────┘  │
                │            │               │
                │            ▼               │
                │  ┌──────────────────────┐  │
                │  │ POST /api/admin/     │  │
                │  │ publish              │  │
                │  └──────────────────────┘  │
                └────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────────┐
                │   Video Review portal      │
                │   (this Node.js app)       │
                │                            │
                │  Users: like / dislike /   │
                │  comment                   │
                │                            │
                │  On like    → Drive vault  │
                │  On dislike → learning Q   │
                │  On comment → vocab buckets│
                │                            │
                │  CLAUDE.md regenerated     │
                │  on every event            │
                └────────────────────────────┘
```

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — at minimum set INVITE_CODE, ADMIN_API_TOKEN, SESSION_SECRET.
npm start
```

On the **first start**, an admin account `claude` is created and its
random password is printed to stdout **once**. Save it.

To override that password ahead of time, set `ADMIN_PASSWORD` in `.env`.

Then open <http://localhost:3000>. You'll be redirected to `/login.html`.
Sign in as `claude` (admin) to post or click "+ Generate", or sign up as a
user with the invite code to start reviewing.

## What users can and can't do

- **Sign up** with the invite code, sign in, change their **username**.
- **Like / dislike / comment** on videos.
- Cannot post videos. Cannot edit anything else on their profile.

The `claude` admin account is the only one allowed to post videos
(`POST /api/admin/publish`, called by n8n) and to use the manual
"+ Generate" button.

## How the learning loop works

Every review event regenerates **`CLAUDE.md`** with these sections:

- **Generation guidance** — synthesized do/don't list.
- **Prefer (positive-net tags)** — tags with more likes than dislikes.
- **Avoid (negative-net tags)** — tags with more dislikes than likes. The
  self-review gate refuses to publish a draft that overlaps with these.
- **Suspected dislike reasons** — for every dislike that was *not*
  accompanied by a comment, the algorithm guesses which tag on that video
  was the most likely culprit (lowest net score across the dataset).
- **Comment vocabulary** — words bucketed by like / dislike verdict.
- **Recent notes** — the last 20 free-text comments verbatim.

Triggers, all three of which mutate the loop:

| Event   | Side effect                                                                            |
| ------- | -------------------------------------------------------------------------------------- |
| like    | Save to Google Drive vault (with local mirror in `data/saved-vault/`) and rebuild MD   |
| dislike | Append to `data/learning-queue.json` and rebuild MD                                    |
| comment | Append to `data/learning-queue.json` (kind=comment) and rebuild MD                     |

The next n8n cycle pulls the freshly rebuilt `CLAUDE.md` and feeds it back
into the generator prompt.

## API

### Session (cookie auth)

| Method | Path           | Notes                                                  |
| ------ | -------------- | ------------------------------------------------------ |
| POST   | `/api/signup`  | Body: `{ username, password, inviteCode }`             |
| POST   | `/api/login`   | Body: `{ username, password }`                         |
| POST   | `/api/logout`  |                                                        |
| GET    | `/api/me`      | Current user                                           |
| PATCH  | `/api/me`      | Body: `{ username }` — only username is editable       |
| GET    | `/api/videos`  | Feed (auth required)                                   |
| POST   | `/api/review`  | Body: `{ videoId, verdict: like\|dislike, comment? }`  |
| POST   | `/api/comment` | Body: `{ videoId, comment }`                           |
| GET    | `/api/preferences` | Serves the current `CLAUDE.md`                     |

### Admin (cookie + role=admin)

| Method | Path                       | Notes                              |
| ------ | -------------------------- | ---------------------------------- |
| POST   | `/api/admin/generate-one`  | Manual "+ Generate" button. Runs the internal stub pipeline. |

### Machine (Bearer token via `ADMIN_API_TOKEN`)

| Method | Path                          | Notes                                          |
| ------ | ----------------------------- | ---------------------------------------------- |
| GET    | `/api/admin/context`          | Returns `CLAUDE.md`                            |
| GET    | `/api/admin/learning-queue`   | Dislike + comment events for prompt feedback   |
| POST   | `/api/admin/publish`          | Body: `{ title, description, src, poster, tags, prompt }` — publishes to the feed |

## The n8n workflow

Workflow source: [`workflows/n8n-generator-cycle.ts`](workflows/n8n-generator-cycle.ts)
Lives in n8n at: <https://tvtai.app.n8n.cloud/workflow/ATpRqLYDcd7H02HF>

The workflow has a Schedule Trigger (every 3h) and a Manual Trigger. Both
fan out into a 5-iteration loop. Each iteration:

1. **Fetch CLAUDE.md** from `/api/admin/context`
2. **Generate Draft** — currently a stub Code node. Replace it with an
   HTTP Request node calling Higgsfield, passing the fetched context.
3. **Publish to Feed** via `/api/admin/publish`.

To finish wiring it up:

1. In n8n, set the **Video Review Admin** credential to:
   - Header Name: `Authorization`
   - Value: `Bearer <your ADMIN_API_TOKEN>`
2. Fill the two placeholder URLs (host of this app, e.g. `http://localhost:3000/api/admin/context`).
3. Replace the **Generate Draft** Code node with an HTTP Request to
   Higgsfield, using `$json.context` from the previous step as part of
   your prompt.

## Files

```
server.js                     # Express app: auth, feed, admin API
lib/auth.js                   # Password hashing + signed cookies
lib/users.js                  # User store + admin bootstrap
lib/claude-md.js              # CLAUDE.md generator
lib/vault.js                  # Google Drive vault for liked videos
lib/learning.js               # Dislike + comment learning queue
lib/video-gen.js              # Higgsfield call stub
lib/review-gate.js            # Self-review (avoid-tag check)
lib/workflow.js               # Internal fallback gen→review→publish
public/                       # Static UI (login, signup, profile, feed)
data/                         # JSON stores + Drive mirror (gitignored)
workflows/                    # n8n workflow source
CLAUDE.md                     # Auto-generated learning context (gitignored)
```

## Google Drive vault

When liked, a video's metadata is uploaded to a folder you control:

- `GOOGLE_SERVICE_ACCOUNT_JSON` (inline) **or** `GOOGLE_SERVICE_ACCOUNT_FILE` (path)
- `VAULT_DRIVE_FOLDER_ID` — destination folder ID. Share the folder with
  the service account's `client_email` (Editor access).

If creds are missing, the vault falls back to writing to
`data/saved-vault/` locally so the rest of the loop still works.
