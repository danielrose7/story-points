# 🃏 Story Points

Realtime pointing poker for agile teams. One standing URL per room; rooms keep
their settings and can be reused cycle after cycle.

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
full seasonal calendar (🧧 💘 🍀 🌸 🌷 ☀️ 🎆 📚 🍂 🎃 🦃 🎄). New rooms get a
**random theme** at creation; the host can change it in room settings (synced
to everyone, persisted with the room). A theme = a block of `--sp-*` token
overrides in `src/styles.css` — palette, card backs, confetti colors, plus two
theme-flavored emoji slots in the reaction tray (`THEME_REACTIONS`).

## Roadmap

- Remaining themes (surf 🏄, birthday 🎂, nightclub 🪩)
- Round history (story + result + duration per round)
- Vote distribution chart on reveal
- Optional room-idle cleanup via DO alarms
