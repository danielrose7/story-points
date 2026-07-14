---
title: Themes
description: 17 themes and seasonal auto-theming
---

# Themes

17 themes: 🃏 card table, 🚀 outer space, 🏄 surf, 🎂 birthday, 🪩 nightclub,
and a full seasonal calendar — 🧧 Lunar New Year, 💘 Valentine's,
🍀 St. Patrick's, 🌸 Easter, 🌷 Mother's Day, ☀️ Summer, 🎆 4th of July,
📚 Back to School, 🍂 Fall, 🎃 Halloween, 🦃 Thanksgiving, 🎄 Christmas.

## Seasonal (auto)

New rooms default to **🗓 Seasonal (auto)**: the theme follows the calendar,
resolving to the nearest holiday anchor every time the room is viewed — a
standing room re-themes itself as holidays approach. The host can pin any
specific theme in **Room settings → Theme**; picking "Seasonal (auto)" again
unpins it. The home page always wears today's seasonal colors.

## What a theme changes

Palette (felt, accents, card backs), confetti colors, and two theme-flavored
emoji slots in the reaction tray (🎃 👻 in October, 🎅 ⛄ in December, …).
Link previews match too: sharing a room URL renders a social card in the
room's theme.

A theme is a block of `--sp-*` CSS custom-property overrides — custom
properties inherit into shadow DOM, so every component follows automatically.
