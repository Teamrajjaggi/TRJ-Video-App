# Video Review Portal

TikTok-style portal for reviewing a queue of videos. Scroll vertically,
approve (like) or disapprove (dislike), and leave a comment explaining why.
Approved videos are queued for a future "post" workflow (the post step itself
is intentionally not implemented yet). Every review updates `PREFERENCES.md`
so downstream tooling can learn what the reviewer likes and dislikes.

## Run it

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

## What's where

- `server.js` — Express server and JSON API
- `public/` — Vanilla HTML/CSS/JS frontend (scroll-snap feed)
- `data/videos.json` — Seed list of videos to review
- `data/reviews.json` — Append-only log of every like/dislike/comment
- `data/post-queue.json` — Approved videos queued for the (unimplemented) post step
- `lib/preferences.js` — Rebuilds `PREFERENCES.md` from the review log
- `lib/workflow.js` — `triggerPostWorkflow()` stub that runs on approval
- `PREFERENCES.md` — Auto-generated reviewer preferences (created after first review)

## API

| Method | Path               | Body                                          | Description                                       |
| ------ | ------------------ | --------------------------------------------- | ------------------------------------------------- |
| GET    | `/api/videos`      | —                                             | List videos with their reviews                    |
| POST   | `/api/review`      | `{ videoId, verdict: "like"\|"dislike", comment? }` | Record approval/disapproval; likes hit the workflow stub |
| POST   | `/api/comment`     | `{ videoId, comment }`                        | Add a note without a verdict                      |
| GET    | `/api/preferences` | —                                             | Serve current `PREFERENCES.md`                    |
| GET    | `/api/post-queue`  | —                                             | List videos queued by the approval workflow       |

## Workflow hook

`lib/workflow.js#triggerPostWorkflow` is called whenever a `like` is submitted.
Right now it just appends the video to `data/post-queue.json`. Swap that
function out when the real posting integration is ready.

## How the preferences file "learns"

`lib/preferences.js` rebuilds `PREFERENCES.md` after every review. It
aggregates:

- **Tag-level signal** — counts likes vs. dislikes per video tag.
- **Comment vocabulary** — tokenizes comments (stopwords stripped) and tracks
  which words show up alongside likes vs. dislikes.
- **Recent notes** — keeps the last 20 free-text comments verbatim.

That markdown can then be fed as context to whatever downstream system picks
the next batch of videos to review.

## Adding videos

Drop entries into `data/videos.json`:

```json
{
  "id": "vid_007",
  "title": "...",
  "src": "https://.../clip.mp4",
  "poster": "https://.../thumb.jpg",
  "tags": ["topic", "mood"],
  "description": "One-line summary."
}
```
