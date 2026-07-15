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
const PAGES = ['index', 'getting-started', 'features', 'themes', 'api', 'agent-setup'];

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

// Classic-theme tokens, mirroring src/styles.css :root (docs pages live
// outside the app bundle, so they carry their own copy).
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
	--sp-bg: radial-gradient(ellipse at 50% -20%, #2e7d5b 0%, #1b5e43 45%, #123f2e 100%);
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
}
* { box-sizing: border-box; }
html { background: #123f2e; }
body {
	margin: 0;
	min-height: 100dvh;
	background: var(--sp-bg);
	font-family: var(--sp-font);
	padding: 24px 16px 48px;
}
.page {
	max-width: 760px;
	margin: 0 auto;
	background: var(--sp-surface);
	color: var(--sp-surface-text);
	border-radius: var(--sp-radius);
	box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
	padding: 36px 40px 44px;
}
@media (max-width: 560px) { .page { padding: 24px 20px 32px; } }
nav.docs {
	display: flex;
	gap: 4px 14px;
	flex-wrap: wrap;
	font-size: 0.9rem;
	font-weight: 600;
	margin-bottom: 18px;
	padding-bottom: 14px;
	border-bottom: 1px solid var(--sp-divider);
}
nav.docs a { color: var(--sp-muted); text-decoration: none; }
nav.docs a:hover { color: var(--sp-surface-text); }
nav.docs a.active { color: var(--sp-surface-text); border-bottom: 2px solid var(--sp-accent); }
nav.docs a.app { margin-right: auto; color: var(--sp-surface-text); }
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
</style>
</head>
<body>
<div class="page">
	<nav class="docs">
		<a class="app" href="/">🃏 Story Points</a>
		${pages
			.map(
				(p) =>
					`<a href="/docs/${p.name === 'index' ? '' : p.name}"${p.name === page.name ? ' class="active"' : ''}>${
						p.name === 'index' ? 'Docs' : p.meta.title
					}</a>`,
			)
			.join('\n\t\t')}
	</nav>
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
</div>
<script>
document.getElementById('copy-md').addEventListener('click', async (e) => {
	const res = await fetch('/docs/${page.name}.md');
	await navigator.clipboard.writeText(await res.text());
	e.target.textContent = '✓ Copied';
	setTimeout(() => (e.target.textContent = '⧉ Copy as Markdown'), 1500);
});
</script>
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

## Docs

- [Overview](${SITE}/docs/index.md): ${pages[0].meta.description}
${guides}

## API quick reference

- POST ${SITE}/api/room/<room>/queue — import stories (text lines or JSON {"items":[…]}; ?mode=replace)
- GET ${SITE}/api/room/<room>/export — session results as JSON (?format=csv for CSV)
- GET ${SITE}/api/room/<room>/peek — {"exists": bool, "name"?, "theme"?}

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
