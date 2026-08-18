# teamrajjaggi.com — marketing site

A server-rendered marketing and lead-capture site for **Your Home Sold Guaranteed — Team Raj Jaggi (VORO Real Estate)**, modeled on the structure of jakobovgroup.com and adapted to the Long Island market.

It runs completely independently of the video-review app in the repo root: its own port, its own static root, its own routes. Nothing in `server.js`, `lib/`, or `public/` at the repo root is touched.

```bash
npm install
npm run site          # http://localhost:4000
```

## What is here

| Path | Page |
| --- | --- |
| `/` | Home — hero + IDX search, guarantee, featured listings, process, reviews, neighborhoods, team, blog |
| `/home-search` | Search — hands off to CINC IDX, or filters featured inventory until IDX is connected |
| `/properties/sale` | Featured listings (active, coming soon, recently sold) |
| `/properties/:mlsId` | Listing detail (fallback for when IDX is not yet live) |
| `/home-valuation` | "What is my home worth" — the primary seller lead form |
| `/guaranteed-sale` | The guarantee, its mechanics, and its written conditions |
| `/sellers-guide`, `/buyers-guide` | Long-form guides |
| `/mortgage-calculator` | Payment estimator with Long Island tax weighting |
| `/neighborhoods`, `/neighborhoods/:slug` | 12 communities, each deep-linking into IDX |
| `/team`, `/agent/:slug` | Roster and agent bios |
| `/testimonials` | Reviews with Review schema |
| `/blog`, `/blog/:slug` | 5 seeded posts with BlogPosting schema |
| `/contact-us`, `/join-us` | Contact and agent recruiting |
| `/privacy`, `/terms`, `/accessibility` | Legal, fair housing, TCPA consent language |
| `/sitemap.xml`, `/robots.txt`, `/healthz` | Infrastructure |

Every page is server-rendered from `pages/*.js` on top of `templates/layout.js`, so nav, footer, schema.org markup, and analytics tags exist in exactly one place.

## The CINC pathway

Two independent integrations. Either one can run without the other, and the site works with neither configured — which is the state it ships in.

### 1. IDX handoff (search traffic)

Set `CINC_IDX_BASE_URL` to the team CINC site (e.g. `https://teamrajjaggi.cincpro.com`). Once set:

- the hero and `/home-search` search bars submit directly into CINC IDX with `cityName`, `minPrice`, `maxPrice`, `minBeds` mapped to CINC's parameters;
- every neighborhood card and town chip deep-links into IDX filtered to that city;
- listing cards link to `/{CINC_IDX_LISTING_PATH}/{mlsId}`;
- `/home-search` embeds the live IDX map search in-page.

Unset, all of the above falls back to the internal search page over `data/listings.js`, so nothing 404s before CINC is provisioned.

### 2. Open API (lead capture)

Every form on the site posts JSON to `POST /api/lead`. `lib/leads.js` validates and normalizes it, `lib/cinc.js` maps it onto the CINC lead schema and calls `POST https://public.cincapi.com/v2/site/leads` with an OAuth2 bearer token. The upsert keys off the email address, so a repeat visitor updates their existing lead instead of creating a duplicate.

Each lead carries:

- `source` — `teamrajjaggi.com` by default, overridable per form;
- `tags` — `website`, plus `web:<form-name>` and the intent (`seller`, `buyer`, `investor`, `recruit`), so CINC routing rules and smart lists can branch on website traffic;
- `notes` — the form fields that have no native CINC home: property address, timeframe, price range, area of interest, pre-approval status, message, landing page, referrer, and first-touch UTM/gclid/fbclid.

Reliability, in order:

1. **Disk first.** Every submission is appended to `data/leads.jsonl` *before* CINC is called. A lead is never lost to an API outage.
2. **Retry queue.** Transport failures, 429s, and 5xx responses go to `data/lead-retry.jsonl` and are replayed on boot and every five minutes, up to `LEAD_MAX_ATTEMPTS`. A 4xx (bad payload) is logged, not retried.
3. **Webhook mirror.** Set `LEAD_WEBHOOK_URL` to also push each lead to Zapier, n8n, or Make — HMAC-signed with `LEAD_WEBHOOK_SECRET` when set.

### Connecting CINC

1. Ask CINC (or the account's Open API contact) for API credentials and, if the account uses the authorization-code flow, a redirect URI pointed at `https://teamrajjaggi.com/cinc/callback`.
2. Put `CINC_CLIENT_ID` and `CINC_CLIENT_SECRET` in the environment.
3. For client-credentials accounts, that is it — leave `CINC_GRANT_TYPE` unset.
4. For authorization-code accounts, set `SITE_ADMIN_TOKEN`, visit `/cinc/connect?token=<admin token>`, approve in CINC, and copy the refresh token printed in the server log into `CINC_REFRESH_TOKEN` with `CINC_GRANT_TYPE=refresh_token`.
5. Verify with `GET /api/cinc/health?token=<admin token>`.
6. Submit a real form and confirm the lead lands in CINC tagged `website`.

`POST /api/cinc/webhook` accepts inbound callbacks (lead assigned, status changed) and verifies `x-cinc-signature` against `CINC_WEBHOOK_SECRET` when that is set.

## Configuration

Everything is env-driven — see `.env.example` in the repo root for the full list with defaults. Nothing is required to boot; unset CINC variables simply disable the two pathways above.

Brand, phone numbers, address, social links, stats, and the guarantee wording all live in `config.js` and `data/`, so a rebrand or a copy change never requires touching a template.

## Content to replace before launch

- **Photography.** Drop real files in `public/images/` and set the `photo` field on team members and listings. Cards fall back to typographic tiles until then.
- **Reviews.** `data/testimonials.js` holds representative reviews written from the team's public record. Swap in verified Google/Zillow/Yelp reviews with permission before launch.
- **Listings.** `data/listings.js` is a display shelf, not an MLS feed. Live inventory comes from the IDX handoff.
- **Agent roster.** `data/team.js` has Raj, Rahul, and the two departments. Add individual agents with real licenses and bios.
- **Stats.** The counts in `config.js` (1,000+ families, 500+ reviews, #1 by sales) come from the team's own public marketing — confirm they are current and substantiable before publishing.
- **Guarantee terms.** The site describes the guarantee and states that written terms are provided at the listing appointment. Have counsel review the wording against the actual agreement.

## Preview build

```bash
node site/scripts/build-preview.js out.html
```

Renders all 45 routes into one self-contained HTML file with a client-side router — useful for sending the client a clickable preview without hosting anything.

## Deploying

Any Node host. Set `SITE_PORT` (or `PORT`), point the domain at it, and run `npm run site`. The site holds no database connection and no session state; the only writable paths are the two JSONL files under `site/data/`, which should sit on a persistent disk so the retry queue survives a restart.
