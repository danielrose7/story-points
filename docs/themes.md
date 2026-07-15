---
title: Themes
description: The 17 themes — what each looks like, when the seasonal ones take over, and which emoji they bring to the tray
---

# Themes

17 themes: five you pick because you like them, and a twelve-stop seasonal
calendar that rolls through the year on its own. Every theme re-dresses the
whole room — table felt, card backs, confetti — and invites two of its own
emoji into the reaction tray.

## Seasonal (auto)

New rooms default to **🗓 Seasonal (auto)**: the theme follows the calendar,
resolving to the nearest holiday anchor every time the room is viewed — a
standing room re-themes itself as holidays approach. The host can pin any
specific theme in **Room settings → Theme**; picking "Seasonal (auto)" again
unpins it. The home page always wears today's seasonal colors.

## The year-rounders

| Theme | The room becomes | Tray guests |
| --- | --- | --- |
| 🃏 Card table | Casino felt — deep green, gold accents. The default deal. | 🎲 ♠️ |
| 🚀 Outer space | Midnight navy with starlight — estimates from another planet. | 🛸 🌟 |
| 🏄 Surf | Tropical teal, beach-day energy. | 🌊 🤙 |
| 🎂 Birthday | Party purple; the confetti feels extra appropriate. | 🎈 🎁 |
| 🪩 Nightclub | Near-black with neon — sprint planning after dark. | 💃 🕺 |

## The seasonal calendar

Each seasonal theme "reigns" while its anchor date is the nearest one on the
calendar (roughly the window between its neighbors):

| Theme | Anchor | The room becomes | Tray guests |
| --- | --- | --- | --- |
| 🧧 Lunar New Year | Feb 1 | Lantern red and gold. | 🧧 🐉 |
| 💘 Valentine's | Feb 14 | Rose and berry. | 💘 🌹 |
| 🍀 St. Patrick's | Mar 17 | Shamrock green. | 🍀 🌈 |
| 🌸 Easter | Apr 5 | Soft lavender, pastel confetti. | 🐣 🌸 |
| 🌷 Mother's Day | May 10 | Warm terracotta and tulips. | 🌷 💐 |
| ☀️ Summer | Jun 21 | Golden hour, all day. | 🍦 😎 |
| 🎆 4th of July | Jul 4 | Deep flag blue; red-and-white fireworks. | 🎆 🦅 |
| 📚 Back to School | Aug 25 | Amber chalkboard-and-pencils. | 📚 ✏️ |
| 🍂 Fall | Sep 22 | Burnt orange, falling leaves. | 🍂 🌰 |
| 🎃 Halloween | Oct 31 | Haunted purple-black. | 🎃 👻 |
| 🦃 Thanksgiving | Nov 26 | Warm oven browns. | 🦃 🥧 |
| 🎄 Christmas | Dec 25 | Evergreen and snow. | 🎅 ⛄ |

Hover any tray emoji for its label — the seasonal guests have opinions
("🌰 tough nut to crack", "👻 ghost of sprints past", "🎅 ho ho hopefully
a 3").

## What a theme changes

Palette (felt, accents, card backs), confetti colors, and the two tray
slots. Link previews match too: sharing a room URL renders a social card in
the room's theme.

Under the hood a theme is one block of `--sp-*` CSS custom-property
overrides in `src/styles.css` — custom properties inherit into shadow DOM,
so every component follows automatically. That also makes a new theme one
of the easiest contributions to the
[open-source repo](https://github.com/danielrose7/story-points): a token
block, two tray emoji, and one script run to generate its social card.

## Where the idea came from

Seasonal auto-theming has a lineage: it started as a
[CodePen experiment](https://codepen.io/bloom-dan/pen/RwGNePg) and grew up
in [Name Draw](https://gobloom.io/posts/name-draw) — a Secret Santa
name-drawing app with twelve themes that match the current month — before
landing here as the seventeen-theme calendar. Some ideas just want to
re-decorate.
