// Renders docs/*.md → public/docs/*.html (+ raw .md twins) and generates
// /llms.txt + /llms-full.txt for agent discoverability. Runs as part of
// `npm run build`, before Vite copies public/. Zero runtime deps — `marked`
// is build-time only, like rsvg-convert for the OG images.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

// marked stopped emitting heading ids by default — restore them so anchors
// like /docs/api#agent-setup work.
marked.use({
	renderer: {
		heading({ tokens, depth }) {
			const text = this.parser.parseInline(tokens);
			const id = text
				.replace(/<[^>]+>/g, '')
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
			return `<h${depth} id="${id}">${text}</h${depth}>\n`;
		},
	},
});

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE = 'https://story-points.danielrose7.workers.dev';
const OUT = path.join(root, 'public');
// Fixed order — drives the nav, llms.txt sections, and llms-full.txt.
const PAGES = ['index', 'getting-started', 'features', 'themes', 'compare', 'api', 'agent-setup'];

fs.mkdirSync(path.join(OUT, 'docs'), { recursive: true });

/** docs/*.md front matter is two fields, parsed by hand. */
function parse(src) {
	const m = src.match(/^---\n([\s\S]*?)\n---\n/);
	const meta = Object.fromEntries(
		(m?.[1] ?? '').split('\n').map((line) => {
			const i = line.indexOf(':');
			return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
		}),
	);
	return { meta, body: m ? src.slice(m[0].length).trimStart() : src };
}

function lastUpdated(file) {
	try {
		const d = execSync(`git log -1 --format=%as -- ${JSON.stringify(file)}`, { cwd: root })
			.toString()
			.trim();
		if (d) return d;
	} catch {
		/* not committed yet */
	}
	return new Date().toISOString().slice(0, 10);
}

const pages = PAGES.map((name) => {
	const file = path.join(root, 'docs', `${name}.md`);
	const { meta, body } = parse(fs.readFileSync(file, 'utf8'));
	return { name, file, meta, body };
});

// Shared footer data — the Lit <points-footer> renders the same JSON.
const FOOTER = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'footer-links.json'), 'utf8'));

const footerHtml = `
<footer class="site">
	<div class="foot-inner">
		<div class="foot-cols">
			<div class="foot-brand">
				<div class="foot-brand-title">${FOOTER.brand.title}</div>
				<div class="foot-brand-tagline">${FOOTER.brand.tagline}</div>
			</div>
			${FOOTER.groups
				.map(
					(g) => `<div class="foot-group">
				<div class="foot-title">${g.title}</div>
				${g.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join('\n\t\t\t\t')}
			</div>`,
				)
				.join('\n\t\t\t')}
		</div>
		<div class="foot-bottom">
			<a class="mountain-link" href="${FOOTER.credit.href}" target="_blank" rel="noopener noreferrer"><span class="mountain-label">${FOOTER.credit.label}</span></a>
			<div class="foot-legal">${FOOTER.legal}</div>
		</div>
	</div>
</footer>`;

// Builds the Silverton ridge underline from the page's --sp-confetti tokens
// (data-URI SVGs can't use var(); same trick as <points-footer> in the app).
// Plain string, not a template literal: it nests inside the page template.
const ridgeScript = [
	'<script>',
	'(function () {',
	"\tvar s = getComputedStyle(document.documentElement);",
	"\tvar cs = s.getPropertyValue('--sp-confetti').split(',').map(function (c) { return c.trim(); }).filter(Boolean);",
	"\tvar a = s.getPropertyValue('--sp-accent').trim();",
	'\tvar c1 = cs[0] || a, c2 = cs[1] || a, c3 = cs[2] || a;',
	"\tfunction uri(svg) { return 'url(\"data:image/svg+xml;charset=utf8,' + encodeURIComponent(svg) + '\")'; }",
	"\tvar rest = \"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 16'><defs><linearGradient id='g' x1='0' y1='0' x2='300' y2='0' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='\" + c1 + \"'/><stop offset='.5' stop-color='\" + c2 + \"'/><stop offset='1' stop-color='\" + c3 + \"'/></linearGradient></defs><line x1='0' y1='12' x2='300' y2='12' stroke='url(#g)' stroke-width='2'/></svg>\";",
	"\tvar hover = \"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 16'><defs><linearGradient id='g' x1='0' y1='0' x2='600' y2='0' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='\" + c1 + \"'/><stop offset='.17' stop-color='\" + c2 + \"'/><stop offset='.33' stop-color='\" + c3 + \"'/><stop offset='.5' stop-color='\" + c1 + \"'/><stop offset='.67' stop-color='\" + c2 + \"'/><stop offset='.83' stop-color='\" + c3 + \"'/><stop offset='1' stop-color='\" + c1 + \"'/><animateTransform attributeName='gradientTransform' type='translate' from='0' to='-300' dur='3s' repeatCount='indefinite'/></linearGradient></defs><path fill='none' stroke='url(#g)' stroke-width='2' stroke-linejoin='round' d='M0,14 L15,12 L35,10 L55,4 L65,8 L80,7 L100,6 L120,6 L140,5 L155,3 L165,5 L175,4 L185,6 L205,1 L220,5 L240,7 L255,4 L270,8 L285,11 L300,13'/></svg>\";",
	"\tdocument.documentElement.style.setProperty('--ridge-rest', uri(rest));",
	"\tdocument.documentElement.style.setProperty('--ridge-hover', uri(hover));",
	'})();',
	'</' + 'script>',
].join('\n');

// Classic-theme tokens, mirroring src/styles.css :root (docs pages live
// outside the app bundle, so they carry their own copy). Layout is
// Cloudflare-docs-style: sticky header, left sidebar nav, prose column,
// full-width footer.
const template = (page, html) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${page.meta.title} — Story Points</title>
<meta name="description" content="${page.meta.description}" />
<meta property="og:title" content="${page.meta.title} — Story Points" />
<meta property="og:description" content="${page.meta.description}" />
<meta property="og:image" content="${SITE}/og/classic.png?v=1" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🃏</text></svg>" />
<style>
:root {
	--sp-surface: #ffffff;
	--sp-surface-text: #1c2b24;
	--sp-muted: #5f7268;
	--sp-accent: #ffb300;
	--sp-accent-text: #3a2b00;
	--sp-border: #ccd6d0;
	--sp-divider: #eef2ef;
	--sp-btn-bg: #f4f7f5;
	--sp-code-bg: rgba(0, 0, 0, 0.07);
	--sp-radius: 14px;
	--sp-font: 'Avenir Next', 'Segoe UI', system-ui, -apple-system, sans-serif;
	--sp-confetti: #ffb300, #37d67a, #4fa3ff, #ff5c8a, #b980ff, #fff176;
}
* { box-sizing: border-box; }
html { background: var(--sp-surface); }
body {
	margin: 0;
	min-height: 100dvh;
	display: flex;
	flex-direction: column;
	background: var(--sp-surface);
	color: var(--sp-surface-text);
	font-family: var(--sp-font);
}
header.site {
	position: sticky;
	top: 0;
	z-index: 10;
	background: var(--sp-surface);
	border-bottom: 1px solid var(--sp-divider);
}
.header-inner {
	max-width: 1160px;
	margin: 0 auto;
	padding: 10px 20px;
	display: flex;
	align-items: center;
	gap: 16px;
}
.brand {
	font-weight: 800;
	font-size: 1.05rem;
	text-decoration: none;
	color: var(--sp-surface-text);
	margin-right: auto;
}
.header-inner a.gh {
	color: var(--sp-muted);
	text-decoration: none;
	font-size: 0.9rem;
}
.header-inner a.gh:hover { color: var(--sp-surface-text); }
a.cta {
	background: var(--sp-accent);
	color: var(--sp-accent-text);
	text-decoration: none;
	font-weight: 700;
	font-size: 0.9rem;
	padding: 8px 14px;
	border-radius: 8px;
}
.shell {
	flex: 1;
	max-width: 1160px;
	margin: 0 auto;
	width: 100%;
	display: grid;
	grid-template-columns: 220px minmax(0, 1fr);
	gap: 32px;
	padding: 0 20px;
}
nav.side {
	border-right: 1px solid var(--sp-divider);
	padding: 24px 16px 24px 0;
}
.side-sticky { position: sticky; top: 66px; }
.side-title {
	font-size: 0.72rem;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: var(--sp-muted);
	margin: 14px 0 6px;
}
.side-title:first-child { margin-top: 0; }
nav.side a {
	display: block;
	padding: 5px 10px;
	border-radius: 7px;
	font-size: 0.92rem;
	text-decoration: none;
	color: var(--sp-muted);
	border-left: 2px solid transparent;
}
nav.side a:hover { color: var(--sp-surface-text); background: var(--sp-btn-bg); }
nav.side a.active {
	color: var(--sp-surface-text);
	font-weight: 700;
	background: var(--sp-btn-bg);
	border-left: 2px solid var(--sp-accent);
	border-radius: 0 7px 7px 0;
}
main {
	padding: 24px 0 48px;
	max-width: 760px;
	min-width: 0;
}
@media (max-width: 760px) {
	.shell { grid-template-columns: 1fr; gap: 0; }
	nav.side {
		border-right: none;
		border-bottom: 1px solid var(--sp-divider);
		padding: 10px 0;
	}
	.side-sticky { position: static; display: flex; gap: 2px 10px; flex-wrap: wrap; align-items: center; }
	.side-title { display: none; }
	nav.side a, nav.side a.active { border-left: none; border-radius: 7px; }
	a.cta { display: none; }
}
.toolbar {
	display: flex;
	gap: 4px 14px;
	flex-wrap: wrap;
	align-items: center;
	font-size: 0.82rem;
	color: var(--sp-muted);
	margin: 0 0 6px;
}
.toolbar a, .toolbar button {
	color: var(--sp-muted);
	background: none;
	border: none;
	padding: 0;
	font: inherit;
	cursor: pointer;
	text-decoration: none;
}
.toolbar a:hover, .toolbar button:hover { color: var(--sp-surface-text); }
.toolbar .sep { opacity: 0.5; }
h1 { margin: 6px 0 12px; font-size: 2rem; }
h2 { margin: 28px 0 8px; font-size: 1.25rem; }
p, li { line-height: 1.55; }
a { color: inherit; }
code {
	background: var(--sp-code-bg);
	padding: 2px 6px;
	border-radius: 6px;
	font-size: 0.9em;
}
pre {
	background: var(--sp-code-bg);
	padding: 14px 16px;
	border-radius: 10px;
	overflow-x: auto;
}
pre code { background: none; padding: 0; }
blockquote {
	margin: 0;
	padding: 2px 16px;
	border-left: 3px solid var(--sp-accent);
	color: var(--sp-muted);
}
table {
	border-collapse: collapse;
	font-size: 0.88rem;
	margin: 12px 0;
	display: block;
	overflow-x: auto;
	max-width: 100%;
}
th, td {
	border: 1px solid var(--sp-border);
	padding: 6px 10px;
	text-align: left;
	vertical-align: top;
}
th { background: var(--sp-btn-bg); }
tbody th:first-child, tbody td:first-child { font-weight: 600; white-space: nowrap; }
footer.site {
	border-top: 1px solid var(--sp-divider);
	background: var(--sp-btn-bg);
	color: var(--sp-muted);
	font-size: 0.85rem;
}
.foot-inner { max-width: 1160px; margin: 0 auto; padding: 32px 20px 20px; }
.foot-cols {
	display: flex;
	flex-wrap: wrap;
	gap: 28px 56px;
	padding-bottom: 24px;
}
.foot-brand { flex: 1 1 200px; min-width: 180px; }
.foot-brand-title { font-weight: 800; font-size: 1rem; color: var(--sp-surface-text); margin-bottom: 6px; }
.foot-brand-tagline { line-height: 1.45; max-width: 26ch; }
.foot-title {
	font-size: 0.72rem;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: var(--sp-surface-text);
	font-weight: 700;
	margin-bottom: 8px;
}
.foot-group a {
	display: block;
	color: inherit;
	text-decoration: none;
	padding: 2px 0;
}
.foot-group a:hover { color: var(--sp-surface-text); text-decoration: underline; }
.foot-bottom {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: 6px 24px;
	border-top: 1px solid var(--sp-border);
	padding-top: 14px;
}
.foot-legal { opacity: 0.8; font-size: 0.78rem; }
.mountain-link { display: inline-block; text-decoration: none; color: inherit; }
.mountain-label {
	display: inline;
	background-repeat: no-repeat;
	background-position: 0 100%;
	background-size: 100% 16px;
	padding-bottom: 10px;
	background-image: var(--ridge-rest);
}
.mountain-link:hover .mountain-label { background-image: var(--ridge-hover); }
</style>
</head>
<body>
<header class="site">
	<div class="header-inner">
		<a class="brand" href="/">🃏 Story Points</a>
		<a class="gh" href="https://github.com/danielrose7/story-points">GitHub</a>
		<a class="cta" href="/">Create a room →</a>
	</div>
</header>
<div class="shell">
	<nav class="side">
		<div class="side-sticky">
			<div class="side-title">Documentation</div>
			${pages
				.map(
					(p) =>
						`<a href="/docs/${p.name === 'index' ? '' : p.name}"${p.name === page.name ? ' class="active"' : ''}>${
							p.name === 'index' ? 'Overview' : p.meta.title
						}</a>`,
				)
				.join('\n\t\t\t')}
			<div class="side-title">Agents</div>
			<a href="/llms.txt">llms.txt</a>
		</div>
	</nav>
	<main>
		<div class="toolbar">
			<span>🕐 Last updated ${lastUpdated(page.file)}</span>
			<span class="sep">|</span>
			<button id="copy-md">⧉ Copy as Markdown</button>
			<span class="sep">|</span>
			<a href="/docs/${page.name}.md">Ⓜ️ View as Markdown</a>
			<span class="sep">|</span>
			<a href="/docs/agent-setup" title="Set up your agent to drive Story Points">🤖 Agent setup</a>
		</div>
		${html}
	</main>
</div>
${footerHtml}
<script>
document.getElementById('copy-md').addEventListener('click', async (e) => {
	const res = await fetch('/docs/${page.name}.md');
	await navigator.clipboard.writeText(await res.text());
	e.target.textContent = '✓ Copied';
	setTimeout(() => (e.target.textContent = '⧉ Copy as Markdown'), 1500);
});
</script>
${ridgeScript}
</body>
</html>
`;

for (const page of pages) {
	fs.writeFileSync(path.join(OUT, 'docs', `${page.name}.html`), template(page, marked.parse(page.body)));
	fs.writeFileSync(path.join(OUT, 'docs', `${page.name}.md`), page.body);
	console.log(`✓ docs/${page.name}.html (+ .md)`);
}

// llms.txt — curated index per llmstxt.org: H1, blockquote summary, H2 link
// sections with one-line descriptions, everything linking to raw Markdown.
const guides = pages
	.filter((p) => p.name !== 'index')
	.map((p) => `- [${p.meta.title}](${SITE}/docs/${p.name}.md): ${p.meta.description}`)
	.join('\n');
fs.writeFileSync(
	path.join(OUT, 'llms.txt'),
	`# Story Points

> Realtime pointing poker for agile teams. No accounts — a room URL is the
> invitation and the capability. Create or claim a room at ${SITE}/room/<slug>,
> vote with hidden cards, auto-reveal, themes, round history, and a plain-HTTP
> API for importing backlogs and exporting results.

Key facts: rooms persist between sessions (Cloudflare Durable Objects); the
room slug in the URL is the only credential; the API base is ${SITE}.
Free and open source (MIT), self-hostable on the Cloudflare Workers free
plan. Built by Daniel Rose (https://gobloom.io) in Silverton, CO.

## Docs

- [Overview](${SITE}/docs/index.md): ${pages[0].meta.description}
${guides}

## API quick reference

- POST ${SITE}/api/room/<room>/queue — import stories (text lines or JSON {"items":[…]}; ?mode=replace)
- GET ${SITE}/api/room/<room>/export — session results as JSON (?format=csv for CSV)
- GET ${SITE}/api/room/<room>/peek — {"exists": bool, "locked"?, "name"?, "theme"?}
- Protected rooms (opt-in) return 401 from queue/export: send the room's
  6-char code as ?code= or an X-Room-Code header — it's in the invite link.
  Ask the user for it; never guess (10 misses = 15-minute lockout).

## Optional

- [Full docs in one file](${SITE}/llms-full.txt): all pages concatenated
- [Source repository](https://github.com/danielrose7/story-points): Workers + Durable Objects + Lit
`,
);
console.log('✓ llms.txt');

// /agent-setup/prompt.md — the one-step setup prompt (Cloudflare-style):
// an instruction file agents fetch and execute. Self-contained; no install.
fs.mkdirSync(path.join(OUT, 'agent-setup'), { recursive: true });
fs.writeFileSync(
	path.join(OUT, 'agent-setup', 'prompt.md'),
	`# Story Points agent setup

You are setting yourself up to drive Story Points (${SITE}), a realtime
pointing-poker app, on the user's behalf. Complete these steps yourself.

## 1. Learn the surface

Fetch and read:

- ${SITE}/llms.txt — documentation index
- ${SITE}/docs/api.md — the full API reference

## 2. Remember these facts

- Base URL: ${SITE}
- A room lives at ${SITE}/room/<slug> (lowercase letters, digits, dashes).
  The slug is the only credential — treat room URLs the user gives you as
  capabilities, and don't post their contents elsewhere.
- Import stories into a room's queue:
  POST ${SITE}/api/room/<slug>/queue
  (body: plain text one story per line, or JSON {"items": ["…"]};
  append by default, ?mode=replace to swap; 403 = host disabled the queue)
- Export session results (queue + round history with vote counts):
  GET ${SITE}/api/room/<slug>/export        (JSON)
  GET ${SITE}/api/room/<slug>/export?format=csv
- Check whether a room exists: GET ${SITE}/api/room/<slug>/peek
- Protected rooms return 401 from queue/export: ask the user for the room
  code (it rides their invite link as ?code=) and send it as an
  "X-Room-Code" header. Never brute-force it — checks lock after ten misses.

## 3. Typical workflows

- "Queue up these tickets for estimation" → gather stories from the user's
  tracker (their CLI/MCP tools — Jira, Linear, gh) or a file, then POST them
  to the room's queue. Confirm with the {"queued": N} response.
- "What did we estimate?" → GET the export, summarize story → points.
- "Write the estimates back" → GET the export, then update the user's
  tracker using their own tooling. Story Points holds no tracker
  credentials, by design.

## 4. When you can't reach the tracker

If a scope the user gives you (a URL, a view name) isn't resolvable with
your available tools after a try or two, STOP and ask. Do not escalate into
browser automation or reverse-engineering private APIs. Good fallbacks to
offer the user:

- an API-resolvable filter instead (Linear: project/cycle/team/label/search;
  Jira: JQL; GitHub: repo/milestone/label)
- a CSV export from their tracker's UI (Linear: any view's ⋯ menu →
  "Export issues as CSV") — they can import it in the room directly, or you
  can parse it and POST the "ID Title" lines yourself

## 5. Confirm to the user

Tell the user you're set up, name the room you're pointed at (if any), and
list the three things you can now do: import a backlog, report session
results, write estimates back to their tracker.
`,
);
console.log('✓ agent-setup/prompt.md');

// sitemap.xml — home + docs pages, so AI/search crawlers (which read HTML,
// not llms.txt) find everything worth citing.
const urls = ['/', ...pages.map((p) => `/docs/${p.name === 'index' ? '' : p.name}`)];
fs.writeFileSync(
	path.join(OUT, 'sitemap.xml'),
	`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		urls.map((u) => `\t<url><loc>${SITE}${u}</loc></url>`).join('\n') +
		`\n</urlset>\n`,
);
console.log('✓ sitemap.xml');

// Leads with plain text — starting with an HTML comment makes content-type
// sniffing serve it as text/html.
fs.writeFileSync(
	path.join(OUT, 'llms-full.txt'),
	`Story Points — full documentation (${SITE})\n\n` +
		pages.map((p) => `Source: ${SITE}/docs/${p.name}.md\n\n${p.body}`).join('\n\n---\n\n'),
);
console.log('✓ llms-full.txt');
