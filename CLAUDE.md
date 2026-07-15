# Story Points — project conventions

## Colors: theme tokens only, never raw values

All colors MUST be expressed as `var(--sp-*)` tokens defined in
`src/styles.css` `:root`. Never write raw hex/rgb/hsl color values in
component styles, inline styles, or JS — themes (space, surf, …) work by
overriding these tokens, and any hardcoded color silently breaks theming.

- Need a color that has no token? Add a semantic token to `:root` in
  `src/styles.css` (and consider per-theme overrides), then use the token.
- Name tokens by role (`--sp-border`, `--sp-highlight`), not by hue.
- Allowed exceptions: black-alpha `rgba(0,0,0,…)` box-shadows/text-shadows
  (depth, not palette).
- Custom properties inherit into shadow DOM, so tokens work everywhere —
  including JS-built elements (read via `getComputedStyle` if needed; see
  confetti in `src/components/fx-layer.ts`).

## Identifiers are capabilities — mask them server-side

Two strings double as credentials, and several kinds of state are hidden by
design. None of them may ever appear in a payload sent to *other* clients or
to a public endpoint:

- **`userId`** reclaims a seat (votes, name, host role) in every room via
  `ws?u=`. Broadcasts use deterministic per-room **aliases** instead — see
  `aliasFor()`/`idForAlias()` in `worker/room.ts`. Clients treat ids as
  opaque; messages that reference another player (e.g. `transferHost`)
  carry the alias and are mapped back server-side.
- **Room slugs** are the room capability. The stats DO stores them
  internally but `GET /api/stats` returns aggregate integers only.
- **Votes** stay server-side until reveal — other players get a `hasVoted`
  flag, never the value (and never the voter, in anonymous rooms).

When adding a field to `RoomStateView`/`ServerMessage` or any public
endpoint, ask: *is this someone else's credential, or state that's hidden
on purpose?* If yes, alias it, aggregate it, or leave it out.

## Other conventions

- Element tags are `points-*`; no `Pp` class-name prefixes.
- Shadow DOM does not receive document-level CSS: every Lit component
  composes `baseStyles` (box-sizing reset) from
  `src/components/base-styles.ts` into its `static styles` array.
- Zero runtime dependencies beyond Lit; animations are pure CSS in
  components, sounds are Web Audio (no assets).
- Ephemeral social features (reactions, celebrations) ride the WebSocket
  broadcast and are never persisted to Durable Object storage.
- After changing `wrangler.jsonc`, rerun `npx wrangler types`.
- After adding or recoloring a theme in `src/styles.css`, rerun
  `scripts/generate-og.sh` (needs `brew install librsvg`) — it regenerates
  the per-theme social-preview PNGs in `public/og/` from those palettes.
- Deploy = `npm run deploy` (build + wrangler). Commit before deploying.
