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
  The id doubles as the seat credential, so it never leaves the server —
  broadcasts carry per-room opaque aliases (see CLAUDE.md: identifiers are
  capabilities).
- Votes are masked server-side until reveal — other players only get a
  `hasVoted` flag, never the value (the "4/5 in" chip counts flags).
- Auto-reveal fires when every *connected* voter has voted (configurable).
- **Leave room** deletes your seat so it stops blocking reveals.
- The room owner (first joiner) can edit settings: room name, point values
  (label + value pairs, reorderable), and auto-reveal.
- A singleton stats Durable Object keeps anonymous aggregate counters (votes,
  rounds, rooms, live presence); the home page shows them once they're worth
  showing, and `GET /api/stats` serves integers only — never room slugs.
- The app UI speaks **en/es/de/fr/pt/ja** — a zero-dependency `t()` layer
  (`src/i18n.ts`, English strings as keys, locale files code-split by Vite)
  with native `Intl` for plurals, decimal commas, and relative times.
  Browser-language detection, 🌐 override in the footer; a room URL shared
  across a mixed-language team shows each person their own language. Docs
  and llms.txt stay English by design.

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

29 themes: 🃏 card table, 🚀 space, 🏄 surf, 🎂 birthday, 🪩 nightclub, and a
full seasonal calendar (🧧 💘 🍀 🌸 🌷 ☀️ 🎆 📚 🍂 🎃 🦃 🎄). New rooms get the
**seasonal theme** nearest to today (day-of-year anchors) at creation; the host can change it in room settings (synced
to everyone, persisted with the room). A theme = a block of `--sp-*` token
overrides in `src/styles.css` — palette, card backs, confetti colors, plus two
theme-flavored emoji slots in the reaction tray (`THEME_REACTIONS`).

**Theme gallery & credits** — the full what's-what lives in
[/docs/themes](https://story-points.danielrose7.workers.dev/docs/themes).
All themes so far by [@danielrose7](https://github.com/danielrose7); a new
theme is ~30 lines and the friendliest first PR this repo has —
[recipe in CONTRIBUTING](CONTRIBUTING.md). Ship one and your name joins
this list.

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

Rooms have an "Up next" queue: type tickets one-per-line, smart-paste or
📎-import a tracker CSV export (Linear/Jira parse natively, with a preview
table for edit/reorder/remove before committing, and automatic ↗ ticket
links), or POST them (below). **Next ticket →** pulls the front of the queue
into the story after recording the finished round. History can be copied out
of the app as Markdown or CSV.

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

**Why no OAuth or API keys, ever**: the product stance is *no accounts*,
and auth machinery is accounts by the back door — key issuance, rotation,
revocation, a dashboard to manage them, and a database of who's who. Worse,
keys parked in scripts and CI logs leak, and then we'd own the breach story.
The room slug (plus the optional room code) is the entire credential, scoped
to exactly one room and shared the same way the room itself is. That's what
makes the one-click "**use your own agent with our API**" concept work: an
agent needs zero setup ceremony — no signup, no token exchange — just the
room URL it was invited with, same as a human.

## Round history & results

"Next ticket →" after a reveal records the round — story, vote spread, and
time-to-reveal — into a collapsible 📜 panel (last 50 rounds, newest first).
It's a room setting (**Keep round history**, on by default): switching it off
stops recording and hides the panel, and the host can wipe entries with
**Clear history** in settings. Revealed rounds with a spread also get a small
vote-distribution bar chart in the Results panel.

Rooms clean up after themselves: a Durable Object alarm deletes any room left
untouched for 60 days (no writes, no live connections), so abandoned rooms
cost nothing forever.

## Roadmap

The July 2026 pushes (competitive survey, room UX refresh, accessibility
pass, app-first landing, usage stats, open-sourcing, app UI in six
languages) all shipped — git history is the changelog. What's left:

**On hold** (revisit when real usage hits friction):

- **Packaged agent integration** — either (a) a `story-points-skills` repo
  (Claude Code plugin marketplace; an `/estimate-session` skill driving the
  HTTP API with tracker credentials staying local), and/or (b) a remote MCP
  endpoint on the Worker (`import_tickets` / `export_session` / `peek_room`
  tools) for claude.ai and Claude Desktop. Lives outside this repo per the
  no-integrations rule either way. The one-step agent prompt is the
  integration for now.

Future ideas (not committed):

- **Pseudo-locale for layout testing** — a fake `xx` locale that pads every
  string ~40% longer (`[!!! Çréåté å røøm !!!]`) to catch German-length
  layout breakage in CI instead of in production. An hour of work on top of
  `src/i18n.ts`.

- **Locale-aware seasonal calendar** — the seasonal theme anchors are
  American (a German team's room dresses for the 4th of July and
  Thanksgiving). Skip US-only holidays outside `en`, maybe gain regional
  ones. Internationalization is when the *defaults* stop assuming a
  country.

- **Localized landing pages** — `/de/`, `/es/`, … marketing pages (not
  docs) generated by `build-docs.mjs` with `hreflang` alternates, to catch
  "planning poker online kostenlos"-style searches. Pairs with the real
  domain below; app URLs stay locale-free (a room URL is shared across a
  mixed-language team — locale is personal, in localStorage).

- **Invite QR code** — for screenshares and conference-room TVs: a QR of the
  invite link in the invite panel (client-side generation, no service).
  Must auto-include the room code (`?code=…`) when protection is on, so
  scanning admits you in one step.

- **A real domain** — `workers.dev` reads as a hobby project to humans and
  ranking heuristics alike. A proper domain (storypoints.dev-ish) is the
  cheapest single credibility signal for the agent-era discoverability work
  (schema, robots.txt, sitemap, llms.txt all shipped July 2026) and makes
  invite links nicer. Requires updating the baked absolute URLs: OG tags,
  docs/llms.txt generator SITE constant, agent prompt.md, and JSON-LD.

- **Vote ahead on the queue** — the Story-Points-shaped async model
  (researched July 2026 vs Async Poker / SprintPoker / Parabol): voters flip
  through "Up next" items and bank votes early; per-item "3 of 5 have voted"
  with reveal-when-ready and an optional day-scale deadline via the room
  alarm. Deliberately without the notification/reasoning machinery — that's
  accounts-and-integrations territory.
- **Outbound room webhook** — one optional host setting (a webhook URL); the
  room POSTs Slack-compatible `{"text": …}` on round-recorded/reveal. Covers
  Slack natively, Discord (`/slack` endpoint), Teams (Workflows) with zero
  accounts or app review — and lets Slack's own toolchain (Workflow Builder,
  reminders, threads) provide the async-notification layer instead of us
  building it. Pairs with vote-ahead to complete the async loop.

Deliberately skipped: in-app Jira/GitHub/Linear write-back, video-call
embeds, AI insights, async notifications/per-vote comments — all
account/API-heavy, against the no-accounts zero-dep grain.

## License, support & credits

Free and open source under the [MIT license](LICENSE) (© Bloom Interactive
LLC) — fork it, self-host it, or crib from it. Want to contribute?
[CONTRIBUTING.md](CONTRIBUTING.md) has the house rules and the two easiest
gifts (a theme, a translation). Self-hosting is genuinely
three commands and fits the Cloudflare Workers free plan — full
instructions at [/docs/self-host](https://story-points.danielrose7.workers.dev/docs/self-host)
(also linked as "Self-host (eject)" in the site footer). The one caveat:
Durable Objects are the non-portable piece, so "eject" means "to your own
Cloudflare account," not to an arbitrary box.

Running this costs almost nothing at team scale — a few teams' estimation
sessions are a rounding error on the Workers free tier (world-scale traffic
would graduate to the ~$5/mo paid plan, which is the kind of problem to
want). So there's no paywall and never will be. If it saved your sprint,
you can [sponsor the project](https://github.com/sponsors/danielrose7).

Built in Silverton, CO by [Daniel Rose](https://gobloom.io).
