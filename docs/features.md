---
title: Features
description: Ticket queue, history, countdown, voting modes, stats, and the toggles for all of them
---

# Features

Every optional feature has a host toggle in **⚙️ Room settings → Features**,
so a room only shows what its team actually uses. Presets bundle sensible
combinations at creation time.

## Ticket queue

An **Up next** list of stories waiting their turn. Add them one-per-line in
the app, or `POST` them from a script (see [API](/docs/api)). **Next ticket →**
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

## Reactions and celebrations

An ephemeral reaction tray (🐇 for "we're in a rabbit hole", plus two
theme-flavored slots), high-five collisions when two people send the same
emoji, and varied reveal celebrations — confetti, rockets,
up-and-to-the-right charts — chosen by how the vote landed. Never persisted.
