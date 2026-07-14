# 🃏 Story Points

Realtime pointing poker for agile teams. One standing URL per room; rooms keep
their settings and can be reused cycle after cycle.

**Live at <https://story-points.danielrose7.workers.dev>** — no accounts, no install.

## Using it

1. Open the site and hit **Create a room** (or claim any URL you like:
   `/room/your-team-name`).
2. Share the room URL with your team — it's the invite.
3. Everyone enters a name and joins as a **voter** or an **observer**.
4. Type the story being estimated, pick cards; votes stay hidden until everyone
   has voted (auto-reveal, configurable), then the spread, average, and a
   distribution chart appear.
5. **Next ticket →** records the round to history and starts the next one;
   **Re-vote** re-runs the same story.

The same URL works sprint after sprint: your seat, the room's settings, deck,
theme, and history are all waiting when you come back. Refreshing mid-session
reclaims your seat automatically.

## Docs & agent discoverability

Human docs live at [/docs/](https://story-points.danielrose7.workers.dev/docs/)
— Markdown sources in `docs/`, rendered to themed HTML by
`scripts/build-docs.mjs` (build-time `marked`, Cloudflare-docs-style
"Copy as Markdown / View as Markdown / Agent setup" toolbar). Every page has
a raw Markdown twin at the same URL + `.md`, and agents get
[`/llms.txt`](https://story-points.danielrose7.workers.dev/llms.txt) (curated
index per [llmstxt.org](https://llmstxt.org/)) plus `/llms-full.txt` (all
pages in one fetch).

## Stack

- **Frontend**: [Vite](https://vite.dev) + [Lit](https://lit.dev) web components (no framework lock-in, ~12 KB gzipped)
- **Backend**: Cloudflare Workers + one [Durable Object](https://developers.cloudflare.com/durable-objects/) per room
  - WebSockets with the [Hibernation API](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) — idle rooms cost nothing
  - Room state (settings, seats, votes, story) persists in the DO's SQLite storage for weeks between sessions
  - Fits entirely in the Workers **free plan**

## How it works

- `/room/<slug>` lazily creates/opens the room's Durable Object (`idFromName`).
- Each browser keeps a persistent `userId` in localStorage; the room keeps your
  seat keyed by that id, so **refreshing reclaims your seat** (name, role, vote).
- Votes are masked server-side until reveal — other players only get a
  `hasVoted` flag, never the value.
- Auto-reveal fires when every *connected* voter has voted (configurable).
- **Leave room** deletes your seat so it stops blocking reveals.
- The room owner (first joiner) can edit settings: room name, point values
  (label + value pairs, reorderable), and auto-reveal.

## Develop

```sh
npm install
npm run dev        # vite dev server with the Worker + DO running locally
```

## Deploy

```sh
npm run deploy     # builds, then `wrangler deploy` (needs `wrangler login` once)
```

## TODO

- [ ] **Finish CI/CD: add the `CLOUDFLARE_API_TOKEN` repo secret.** GitHub Actions
  ([deploy.yml](.github/workflows/deploy.yml)) already builds every PR and deploys
  `main`, but the deploy job fails until this token exists:
  1. Go to <https://dash.cloudflare.com/profile/api-tokens> and click **Create Token**.
  2. Under the **Edit Cloudflare Workers** template, click **Use template**.
  3. Under *Account Resources*, pick the `Dan@gobloom.io` account; leave the rest as-is.
  4. Click **Continue to summary** → **Create Token**, then copy the token.
  5. In a terminal: `gh secret set CLOUDFLARE_API_TOKEN --repo danielrose7/story-points`
     and paste the token when prompted.
  6. Re-run the failed workflow (`gh run rerun --failed`) or just push to `main`.

  (`CLOUDFLARE_ACCOUNT_ID` is already set as a repo secret.)

## Joy layer

- **Emoji reactions** — ephemeral, FigJam-style; broadcast over the socket,
  never stored. 🐇 = "we're going down a rabbit hole"; 3 rabbits in a minute
  triggers a *side quest detected* toast.
- **Celebrations** — reveal outcomes draw from shuffle-bag pools (no repeats
  until a pool is exhausted): consensus 🎉/🚀/📈/🎰, big split 🥊, all-"?" ☕.
  ~2% of celebrations are replaced by a rare drop. 🦖
- **Rabbit-hole timer** — round clock goes amber at 5 min, red with a hopping
  🐇 at 10 min.
- **Micro-interactions** — 3D card flips with per-player stagger on reveal,
  deal-in player rows, same-emoji-within-2s collision high-fives 💥, and at
  least one hidden trigger word. 🔥

## Themes

17 themes: 🃏 card table, 🚀 space, 🏄 surf, 🎂 birthday, 🪩 nightclub, and a
full seasonal calendar (🧧 💘 🍀 🌸 🌷 ☀️ 🎆 📚 🍂 🎃 🦃 🎄). New rooms get the
**seasonal theme** nearest to today (day-of-year anchors) at creation; the host can change it in room settings (synced
to everyone, persisted with the room). A theme = a block of `--sp-*` token
overrides in `src/styles.css` — palette, card backs, confetti colors, plus two
theme-flavored emoji slots in the reaction tray (`THEME_REACTIONS`).

## Social previews

Sharing `/` or a room URL renders a rich card: the Worker rewrites the SPA
shell's Open Graph tags per request (room name in the title, the room's theme
image — seasonal for the home page and unclaimed rooms). The 1200x630 images
are generated per theme by `scripts/generate-og.sh` (SVG templates rasterized
with rsvg-convert, palettes parsed from `src/styles.css`) and committed to
`public/og/`.

## Feature toggles & creation presets

Every optional feature has a host toggle in **Room settings → Features**:
auto-reveal, timer chimes, voting countdown (+ seconds), ticket queue, away
votes, anonymous voting, vote statistics, round history. Settings are
organized into tabs (General / Theme / Features).

"Create a room" on the home page offers **presets** that seed a fresh room:
🏃 Sprint planning (Fibonacci, everything on), 👕 T-shirt sizing, 🚑 Triage
(grouped severity deck, no chimes/stats), 🎯 Minimal (just cards + reveal).
Deck cards can carry a **group**, rendered as labeled clusters in the voting
hand. All of it stays editable in room settings afterwards.

## Ticket queue & the import/export API

Rooms have an "Up next" queue: paste tickets one-per-line in the app (or POST
them, below) and **Next ticket →** pulls the front of the queue into the story
after recording the finished round. History can be copied out of the app as
Markdown or CSV.

Deliberately **no tracker-specific integrations** (no Jira/Linear/GitHub
plumbing in this repo). Instead, a room exposes a tiny plain-HTTP surface —
the room slug is the capability, same trust model as the app itself — so any
script, CLI, or MCP tool can bridge to whatever tracker you use:

```sh
# Import a backlog (plain text, one story per line; appends)
jira-export-somehow | curl -X POST --data-binary @- \
  https://story-points.danielrose7.workers.dev/api/room/<room>/queue

# JSON works too; ?mode=replace swaps the queue instead of appending
curl -X POST -H 'Content-Type: application/json' \
  -d '{"items":["Login flow rework","Rate limiter"]}' \
  https://story-points.danielrose7.workers.dev/api/room/<room>/queue?mode=replace

# Export the session: JSON (queue + history), or ?format=csv
curl https://story-points.danielrose7.workers.dev/api/room/<room>/export
```

Connected clients see imports live. A future "estimation session" skill for
Claude/MCP can sit entirely on this surface without touching app code.

## Round history & results

"Next ticket →" after a reveal records the round — story, vote spread, and
time-to-reveal — into a collapsible 📜 panel (last 50 rounds, newest first).
It's a room setting (**Keep round history**, on by default): switching it off
stops recording and hides the panel, and the host can wipe entries with
**Clear history** in settings. Revealed rounds with a spread also get a small
vote-distribution bar chart in the Results panel.

Rooms clean up after themselves: a Durable Object alarm deletes any room left
untouched for 120 days (no writes, no live connections), so abandoned rooms
cost nothing forever.

## Roadmap

Everything from the July 2026 competitive survey shipped: ticket queue +
export, deck grouping, voting countdown, agreement %, anonymous voting, away
votes (async-ish estimation), settings tabs, feature toggles for every
optional feature, room-creation presets, fresh round clock, docs + llms.txt,
and the one-step agent setup (`/agent-setup/prompt.md`).

Remaining (on hold, July 2026 — the one-step agent prompt is the integration
for now; revisit when real usage hits friction):

1. **Packaged agent integration** — either (a) a `story-points-skills` repo
   (Claude Code plugin marketplace; an `/estimate-session` skill driving the
   HTTP API with tracker credentials staying local), and/or (b) a remote MCP
   endpoint on the Worker (`import_tickets` / `export_session` / `peek_room`
   tools) for claude.ai and Claude Desktop. Lives outside this repo per the
   no-integrations rule either way.

Future ideas (not committed):

- **Vote ahead on the queue** — the Story-Points-shaped async model
  (researched July 2026 vs Async Poker / SprintPoker / Parabol): voters flip
  through "Up next" items and bank votes early; per-item "3 of 5 have voted"
  with reveal-when-ready and an optional day-scale deadline via the room
  alarm. Deliberately without the notification/reasoning machinery — that's
  accounts-and-integrations territory.

Deliberately skipped: in-app Jira/GitHub/Linear write-back, video-call
embeds, AI insights, async notifications/per-vote comments — all
account/API-heavy, against the no-accounts zero-dep grain.
