---
title: Story Points docs
description: What Story Points is and where to find everything
---

# Story Points

Realtime pointing poker for agile teams. No accounts, no install — one
standing URL per room, reusable sprint after sprint.

**App:** [story-points.danielrose7.workers.dev](https://story-points.danielrose7.workers.dev)

## How it works, in one paragraph

Create a room (or claim any URL like `/room/your-team`), share the link,
and everyone joins with just a name — as a voter or an observer. Votes stay
hidden until everyone has voted (auto-reveal, configurable), then the spread,
average, agreement %, and a distribution chart appear. The room keeps its
settings, deck, theme, and history between sessions; refreshing the page
reclaims your seat.

## Guides

- [Getting started](/docs/getting-started) — create, invite, vote, reveal
- [Features](/docs/features) — queue, history, countdown, anonymous voting, away votes, presets, and the toggles for all of them
- [Themes](/docs/themes) — 17 themes plus seasonal auto-theming
- [API](/docs/api) — plain-HTTP import/export for scripts, CLIs, and agents

## Principles

- **No accounts.** A room URL is the invitation and the capability.
- **Zero runtime dependencies beyond Lit.** ~20 KB of gzipped JavaScript.
- **No tracker integrations in the app.** A small HTTP API is the bridge;
  anything that can run `curl` can import a backlog and export results.
- **Free to run.** Cloudflare Workers + one Durable Object per room, within
  the free plan.
