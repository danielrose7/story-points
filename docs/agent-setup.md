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

## Per-agent notes

- **Claude Code** — paste the one-liner above, or add it to your project's
  `CLAUDE.md` so every session knows the surface.
- **Cursor / Windsurf / Copilot** — paste the one-liner in chat, or add the
  fetched contents to your rules/instructions file.
- **Anything else** — if it can `curl`, it can integrate; hand it
  [/docs/api.md](/docs/api.md).
