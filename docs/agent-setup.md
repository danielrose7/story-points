---
title: Agent setup
description: Teach any AI coding agent to drive Story Points in one step
---

# Agent setup

Set up your agent to import backlogs, follow estimation sessions, and export
results. One step, any agent:

```
Fetch https://story-points.danielrose7.workers.dev/agent-setup/prompt.md and follow it
```

Paste that into Claude Code, Cursor, Windsurf, Copilot, or any agent that can
fetch a URL. The prompt teaches it the whole surface — no install, no keys.

## What your agent can do afterwards

- **Import a backlog** — pipe stories from your tracker's CLI (Jira, Linear,
  GitHub, a text file) into a room's "Up next" queue.
- **Follow a session** — check what's queued and what's been estimated.
- **Export results** — pull the round history (stories, vote spreads,
  durations) as JSON or CSV and write story points back to your tracker
  with your own tooling.

Your tracker credentials never touch Story Points: the agent bridges
locally, using CLIs and MCP tools you already have.

## Key concepts

- **The room slug is the capability.** There are no accounts or API keys;
  anyone with the room URL can use its API — same trust model as the app.
- **Two endpoints do everything.** `POST /api/room/<room>/queue` imports,
  `GET /api/room/<room>/export` exports. Details in the [API docs](/docs/api).
- **Markdown-native docs.** Agents can read [`/llms.txt`](/llms.txt) (index),
  [`/llms-full.txt`](/llms-full.txt) (everything in one fetch), or any docs
  page with `.md` appended.

## In the app

Rooms include ready-made prompts (in the **Up next** and **Round history**
panels): pick your tracker — Linear, Jira, GitHub, or other — optionally peg
the import to a known list (a Linear view, Jira JQL, a GitHub milestone),
and copy a prompt pre-filled with the room URL. Your tracker and scope picks
are remembered on your device. Hosts can hide these prompts in
**Room settings → Features**.

## Per-agent notes

- **Claude Code** — paste the one-liner above, or add it to your project's
  `CLAUDE.md` so every session knows the surface.
- **Cursor / Windsurf / Copilot** — paste the one-liner in chat, or add the
  fetched contents to your rules/instructions file.
- **Anything else** — if it can `curl`, it can integrate; hand it
  [/docs/api.md](/docs/api.md).

## Troubleshooting

Things an agent (or you) can check when a workflow misbehaves:

- **Linear custom views** — Linear's API and MCP can filter by project,
  cycle, team, label, or search, but **custom views are UI-only**. Don't
  point an agent at a view URL; either give it an equivalent filter, or use
  the view's ⋯ menu → **Export issues as CSV** and import the file straight
  into the room's queue (📎 Import CSV — ticket links come along for free).

- **`401` on `queue`/`export`** — the room requires a code. Ask the user for
  it (it's in their invite link as `?code=`), then send it as an
  `X-Room-Code` header. Don't guess: checks lock out after ten misses.
- **`403` on `POST /queue`** — the room's host switched the ticket queue off
  in **Room settings → Features**. Ask them to re-enable it.
- **`404` on `/export`** — the room doesn't exist yet; rooms are created the
  first time someone joins. `GET /api/room/<room>/peek` is the cheap check.
- **Empty `history` in the export** — rounds are only recorded when someone
  clicks **Next ticket →** after a reveal (Re-vote records nothing), and the
  host may have round history switched off.
- **`400` on JSON imports** — send `Content-Type: application/json` with a
  body shaped `{"items": ["…"]}`. Without that header the body is treated as
  plain text, one story per line.
- **Import seemed to vanish** — queues cap at 100 items × 500 chars each;
  overflow is trimmed. The response `{"queued": N}` is the source of truth.
- **Nothing updates live** — connected clients update over WebSocket on
  every import; a page that's been asleep reconnects with fresh state within
  a few seconds. Refreshing always resyncs (and reclaims your seat).
- **Sanity-check from a shell:**

```sh
curl -i https://story-points.danielrose7.workers.dev/api/room/<room>/peek
printf 'test ticket\n' | curl -i -X POST --data-binary @- \
  https://story-points.danielrose7.workers.dev/api/room/<room>/queue
```
