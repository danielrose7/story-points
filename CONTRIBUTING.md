# Contributing

Thanks for looking. Before anything else, the honest terms:

## The deal (read this first)

Story Points is a gift, in the [open-source-as-gift-exchange](https://world.hey.com/dhh/open-source-is-neither-a-community-nor-a-democracy-606abdab)
sense. The gift is the software and the MIT license — which means you can
always fork it and never need permission for anything. What the gift does
*not* include is a vote: there's no roadmap voting, no feature-request
queue with SLAs, and PRs are merged on the maintainer's taste. This isn't
grumpiness, it's what keeps the project small enough to stay good (and
small enough that *your* fork stays pleasant to hack on).

The corollary: contributions that fit the grain get merged fast, with
credit. The grain is written down — see "The rules of the house" below —
so you can tell before you start whether a change will land.

## The rules of the house

These are the project's non-negotiables (the full versions live in
[CLAUDE.md](CLAUDE.md), which both humans and AI agents working on this
repo follow):

1. **No accounts, ever** — and that includes OAuth and API keys. The room
   URL is the credential.
2. **Zero runtime dependencies beyond Lit.** Build-time tools are fine;
   shipping bytes are sacred.
3. **Colors are theme tokens** (`--sp-*`), never raw hex in components.
4. **Identifiers are capabilities** — userIds and room slugs never leave
   the server unmasked.
5. **Every user-facing string goes through `t()`** and gets entries in the
   locale files.
6. **No tracker integrations in the app** — the HTTP API is the bridge.
7. **Features come from real estimation sessions**, not speculation. If
   you want something speculative, run it on your fork in your sprints
   first, then show up with what you learned.

PRs that fight these get a friendly close and a pointer here. PRs that
ride them get merged.

## The two easiest gifts

### Ship a theme (~30 lines, no architecture discussion)

A theme is a self-contained, reviewable gift — the best first PR this
repo has:

1. **Add a token block** in `src/styles.css` (copy an existing theme
   block): palette, card backs, confetti colors. Name it by vibe.
2. **Register it** in `shared/types.ts`: an entry in `THEMES` (id +
   emoji label) and two tray emoji in `THEME_REACTIONS`.
3. **Label the emoji** in `REACTION_LABELS` — have fun, this is the
   joy layer ("🌰 tough nut to crack" is the bar).
4. **Generate its social card**: `scripts/generate-og.sh` (needs
   `brew install librsvg`), commit the PNG in `public/og/`.
5. Optional: a seasonal anchor in `THEME_ANCHORS` if it belongs to a date
   (locale-scoped anchors welcome — see the Oktoberfest entry).

Run `npm run dev`, pick your theme in Room settings → Theme, screenshot it
for the PR. Merged themes get your name in the README gallery.

### Translate (one file, one PR)

Each locale is a single dictionary mapping English strings to your
language: `src/locales/es.ts`, `de`, `fr`, `pt`, `ja`. Two kinds of gift:

- **Improve an existing locale** — they're machine-authored first passes;
  native-speaker fixes are wanted and small. Edit values, keep the `%1`
  placeholders, PR.
- **Add a language** — copy a locale file, translate the values, add the
  language to `LOCALES` in `src/i18n.ts` and slug word lists in
  `src/slug.ts` (ASCII-only words — slugs are URLs). Ask first via an
  issue if you're unsure the language clears the "would teams actually
  use this?" bar.

## Everything else

Bug fixes: always welcome, smallest-diff wins. Features: read rule 7
again, then open an issue *before* building anything big — a "no" after
you've written the code is worse for everyone. Docs live in `docs/*.md`
and build with `npm run docs`.

Dev loop: `npm install && npm run dev` (full stack locally — Vite, Worker,
Durable Objects). `npm run build` typechecks. There's no test suite yet;
exercise your change in the browser and say what you did in the PR.

## Credit

Merged contributions get credited: themes in the README gallery,
translations in the locale file header, everything in the commit history
forever. That's the other half of the gift exchange.
