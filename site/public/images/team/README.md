# Headshots

Drop a file here named after the team member's slug in `site/data/team.js` and
the site uses it everywhere that person appears — roster card, agent detail
page, and the preview build. No code or data change needed.

| File | Person |
| --- | --- |
| `raj-jaggi.jpg` | Raj Jaggi |
| `rahul-jaggi.jpg` | Rahul Jaggi |

`.jpg`, `.jpeg`, `.png`, and `.webp` all work. Cards crop to a 3:4 portrait, so
supply an image at least 800px wide with the face in the upper third. Until a
file is present, the card falls back to an initials tile.

The same convention covers `../listings/<mlsId>.jpg` and
`../neighborhoods/<slug>.jpg`.
