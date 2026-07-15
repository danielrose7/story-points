---
title: Self-host
description: Run your own Story Points on the Cloudflare free plan in three commands — the eject hatch is the point
---

# Self-host ("eject")

> Story Points is MIT-licensed and designed to be ejected: if the hosted
> app ever goes away, goes bad, or your company wants its own, three
> commands put an identical copy on your own Cloudflare account — free
> plan included. That's the answer to "what's the catch": the license
> removes the ability for there to be one.

## What you need

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up) — the
  whole app fits in the Workers **free plan** (Durable Objects with SQLite
  storage included).
- Node 20+ and git.

"Free" is honest at the scale self-hosting is for: you and your teams,
estimating a few sessions a week — that's a rounding error against the
free-plan quotas. If your copy somehow ends up serving the whole world,
you'll graduate to the Workers paid plan (~$5/mo) — a good problem, and
still cheap.

## The three commands

```sh
git clone https://github.com/danielrose7/story-points
cd story-points && npm install
npm run deploy   # runs `wrangler deploy`; prompts `wrangler login` once
```

That's it. Wrangler prints your copy's URL
(`story-points.<your-subdomain>.workers.dev`) — rooms, themes, the API,
docs, and llms.txt all work identically. Your rooms live in **your**
Durable Objects; nothing phones home.

## The one honest caveat

Rooms are Cloudflare [Durable Objects](https://developers.cloudflare.com/durable-objects/)
— the single non-portable piece. "Eject" means *to your own Cloudflare
account*, not to an arbitrary box. There is deliberately no
Node/Postgres/Redis abstraction layer: the DO free tier is the landing
zone, and keeping the codebase small is what keeps it forkable.

## Make it yours

- **Own domain**: add a custom domain to the Worker, then update the baked
  absolute URLs: the OG tags in `index.html`, `SITE` in
  `scripts/build-docs.mjs`, and the JSON-LD.
- **Own themes/decks**: a theme is a `--sp-*` token block in
  `src/styles.css`; decks and presets are data in `shared/types.ts`.
- **Development**: `npm run dev` runs the full stack (Vite + Worker + DOs)
  locally.

## Staying current

Your fork is yours — there's no auto-update and no telemetry. `git pull
&& npm run deploy` picks up upstream changes whenever you like.

Questions or improvements? [Open an issue](https://github.com/danielrose7/story-points/issues)
— or don't; the [MIT license](https://github.com/danielrose7/story-points/blob/main/LICENSE)
means you never need permission.
