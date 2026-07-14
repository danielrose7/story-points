# Story Points agent setup

You are setting yourself up to drive Story Points (https://story-points.danielrose7.workers.dev), a realtime
pointing-poker app, on the user's behalf. Complete these steps yourself.

## 1. Learn the surface

Fetch and read:

- https://story-points.danielrose7.workers.dev/llms.txt — documentation index
- https://story-points.danielrose7.workers.dev/docs/api.md — the full API reference

## 2. Remember these facts

- Base URL: https://story-points.danielrose7.workers.dev
- A room lives at https://story-points.danielrose7.workers.dev/room/<slug> (lowercase letters, digits, dashes).
  The slug is the only credential — treat room URLs the user gives you as
  capabilities, and don't post their contents elsewhere.
- Import stories into a room's queue:
  POST https://story-points.danielrose7.workers.dev/api/room/<slug>/queue
  (body: plain text one story per line, or JSON {"items": ["…"]};
  append by default, ?mode=replace to swap; 403 = host disabled the queue)
- Export session results (queue + round history with vote counts):
  GET https://story-points.danielrose7.workers.dev/api/room/<slug>/export        (JSON)
  GET https://story-points.danielrose7.workers.dev/api/room/<slug>/export?format=csv
- Check whether a room exists: GET https://story-points.danielrose7.workers.dev/api/room/<slug>/peek

## 3. Typical workflows

- "Queue up these tickets for estimation" → gather stories from the user's
  tracker (their CLI/MCP tools — Jira, Linear, gh) or a file, then POST them
  to the room's queue. Confirm with the {"queued": N} response.
- "What did we estimate?" → GET the export, summarize story → points.
- "Write the estimates back" → GET the export, then update the user's
  tracker using their own tooling. Story Points holds no tracker
  credentials, by design.

## 4. Confirm to the user

Tell the user you're set up, name the room you're pointed at (if any), and
list the three things you can now do: import a backlog, report session
results, write estimates back to their tracker.
