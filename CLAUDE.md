# Agile Points — project conventions

## Colors: theme tokens only, never raw values

All colors MUST be expressed as `var(--ap-*)` tokens defined in
`src/styles.css` `:root`. Never write raw hex/rgb/hsl color values in
component styles, inline styles, or JS — themes (space, surf, …) work by
overriding these tokens, and any hardcoded color silently breaks theming.

- Need a color that has no token? Add a semantic token to `:root` in
  `src/styles.css` (and consider per-theme overrides), then use the token.
- Name tokens by role (`--ap-border`, `--ap-highlight`), not by hue.
- Allowed exceptions: black-alpha `rgba(0,0,0,…)` box-shadows/text-shadows
  (depth, not palette).
- Custom properties inherit into shadow DOM, so tokens work everywhere —
  including JS-built elements (read via `getComputedStyle` if needed; see
  confetti in `src/components/fx-layer.ts`).

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
- Deploy = `npm run deploy` (build + wrangler). Commit before deploying.
