---
title: API
description: Plain-HTTP import/export — the integration surface for scripts, CLIs, and agents
---

# API

Story Points deliberately ships **no tracker-specific integrations**.
Instead, every room exposes a tiny plain-HTTP surface. The room slug is the
capability — same trust model as the app itself — so anything that can run
`curl` can bridge to Jira, Linear, GitHub, or your own tooling.

Base URL: `https://story-points.danielrose7.workers.dev`

## Import tickets into the queue

`POST /api/room/<room>/queue`

Plain text (one story per line) or JSON. Appends by default;
`?mode=replace` swaps the whole queue. Connected clients see imports live.

```sh
# Plain text
printf 'Login flow rework\nRate limiter for API\n' | \
  curl -X POST --data-binary @- \
  https://story-points.danielrose7.workers.dev/api/room/<room>/queue

# JSON
curl -X POST -H 'Content-Type: application/json' \
  -d '{"items":["Login flow rework","Rate limiter"]}' \
  'https://story-points.danielrose7.workers.dev/api/room/<room>/queue?mode=replace'
```

Response: `{"queued": <total items now in queue>}`. Limits: 100 items,
500 chars each. Returns `403` if the room's host has switched the ticket
queue off, `400` for unparseable bodies.

## Export the session

`GET /api/room/<room>/export` — JSON: room name, current queue, and round
history (story, ISO end time, duration in seconds, deck-ordered vote counts).

`GET /api/room/<room>/export?format=csv` — the history as CSV
(`story,ended_at,duration_seconds,votes`).

```sh
curl https://story-points.danielrose7.workers.dev/api/room/<room>/export
```

Returns `404` for rooms that don't exist yet.

## Peek at a room

`GET /api/room/<room>/peek` — `{"exists": bool, "name"?: string, "theme"?: string}`.
Cheap existence check; doesn't create the room.

## Realtime

The app itself runs over a WebSocket at `/api/room/<room>/ws?u=<user-id>`
with JSON messages (join, vote, reveal, clear, story, queue, settings, …).
It's an internal protocol — no compatibility promises — but it's plain JSON
if you want to script a bot; see `shared/types.ts` in the
[repo](https://github.com/danielrose7/story-points) for message shapes.

## Agent setup

One step for any agent — see the [Agent setup guide](/docs/agent-setup):

```
Fetch https://story-points.danielrose7.workers.dev/agent-setup/prompt.md and follow it
```

Or point your coding agent or MCP tool at
[`/llms.txt`](https://story-points.danielrose7.workers.dev/llms.txt) — it
indexes these docs in Markdown. Every docs page also serves a raw Markdown
twin at the same URL with `.md` appended (e.g. `/docs/api.md`), and
[`/llms-full.txt`](https://story-points.danielrose7.workers.dev/llms-full.txt)
bundles all pages in one fetch. A typical agent workflow:

```sh
# 1. Learn the surface
curl https://story-points.danielrose7.workers.dev/llms.txt
# 2. Import the backlog you were asked to estimate
your-tracker-cli list --sprint 42 | curl -X POST --data-binary @- \
  https://story-points.danielrose7.workers.dev/api/room/<room>/queue
# 3. After the session, collect results and write them back
curl https://story-points.danielrose7.workers.dev/api/room/<room>/export
```
