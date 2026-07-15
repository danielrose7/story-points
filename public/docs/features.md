# Features

Every optional feature has a host toggle in **⚙️ Room settings → Features**,
so a room only shows what its team actually uses. Presets bundle sensible
combinations at creation time.

## Ticket queue

An **Up next** list of stories waiting their turn. Fill it four ways: type
one-per-line, paste a tracker export (smart paste), 📎 **Import CSV** (Linear
and Jira exports parse natively — multi-line descriptions and all), or
`POST` from a script/agent (see [API](/docs/api)). Imports stage into a
**preview table** — edit, reorder, or drop rows before adding. Lines ending
in a ticket URL render a clickable ↗ link, in the queue and on the current
story (Linear links are built automatically once the app has seen your
workspace URL). Queue items can be reordered in place; **Next ticket →**
records the finished round and pulls the front of the queue into the story.
Toggle off to hide the panel and reject API imports.

## Round history

**Next ticket →** after a reveal records the round — story, vote spread,
and time-to-reveal — into a collapsible 📜 panel (last 50 rounds). Copy it
out as Markdown or CSV, or download JSON/CSV from the same panel.
**Re-vote** deliberately records nothing. The host can clear history in
settings; switching the feature off stops recording without destroying
existing entries.

## Voting countdown

A ⏳ button starts an N-second countdown (5–600, default 60); votes reveal
automatically at zero. Anyone can start or cancel it. The server owns the
clock, so it fires even if everyone's tab is asleep.

## Vote statistics

On reveal: vote count, average (numeric decks), **agreement %** (share of
voters on the most common value), and a distribution bar chart when the vote
spread. One toggle governs the extras.

## Anonymous voting

Votes are never attributed to people — before *or* after reveal — except
your own. Stats and celebrations still work; revealed seats show a ✓.

## Away votes

Vote, close the tab, still count: your seat stays visible with a 💤 tag and
your vote joins the reveal. Auto-reveal still keys off connected voters
only. Toggle off for strict "live connections only" rooms.

## Timer, chimes, and rabbits

Every round has an elapsed timer that freezes at reveal. It turns amber at
5 minutes and gains a hopping 🐇 at 10 — plus another every 5 minutes
(they're a rabbit-hole warning, not a countdown). Optional chimes mark the
escalations; the room can switch them off, and every individual has a local
mute and volume slider. If everyone leaves mid-round, the clock restarts
when the first person returns (toggleable).

## Deck editor and groups

Decks are label + value pairs — Fibonacci, T-shirt, powers of 2, or fully
custom. The **+ Groups** disclosure in the deck editor adds a Group column;
cards sharing a group render as labeled clusters in the voting hand (e.g.
severity tiers for triage).

## Room codes (optional)

Rooms are open by default — the URL is the invitation. A host who wants a
quieter table can flip **🔒 Require a room code** in settings: the server
generates a 6-character airline-style code (no confusable letters), invite
links carry it (`?code=ABC123`) so they still just work, and the API requires
it too. People already in the room stay in when it's enabled; the host can
regenerate the code at any time. Wrong guesses are rate-limited.

## Reactions and celebrations

An ephemeral reaction tray (🐇 for "we're in a rabbit hole", plus two
theme-flavored slots), high-five collisions when two people send the same
emoji, and varied reveal celebrations — confetti, rockets,
up-and-to-the-right charts — chosen by how the vote landed. Never persisted.
