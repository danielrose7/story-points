/**
 * Normalize pasted or uploaded ticket lists into queue lines ("ID Title").
 * Understands tracker CSV exports — Linear ("ID","Team","Title",… with
 * multi-line quoted descriptions) and Jira ("Issue key","Summary",…) — plus
 * TSV and plain lines.
 */

/** Minimal RFC-4180 CSV parser: quoted fields, "" escapes, newlines inside quotes. */
export function parseCsv(text: string, sep = ','): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') {
				inQuotes = false;
			} else {
				field += c;
			}
		} else if (c === '"') {
			inQuotes = true;
		} else if (c === sep) {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			if (row.some((f) => f.trim())) rows.push(row);
			row = [];
		} else {
			field += c;
		}
	}
	row.push(field);
	if (row.some((f) => f.trim())) rows.push(row);
	return rows;
}

const ID_HEADERS = ['id', 'issue key', 'key', 'identifier', 'number'];
const TITLE_HEADERS = ['title', 'summary', 'name'];

export interface TicketRecord {
	id: string;
	title: string;
}

/** Structured records from a tracker CSV/TSV export, or null if the text
 *  isn't a table with a Title/Summary column. */
export function extractTicketRecords(text: string): TicketRecord[] | null {
	const trimmed = text.trim();
	const fromTable = (rows: string[][]): TicketRecord[] | null => {
		if (rows.length < 2 || rows[0].length < 2) return null;
		const header = rows[0].map((h) => h.trim().toLowerCase());
		const idCol = header.findIndex((h) => ID_HEADERS.includes(h));
		const titleCol = header.findIndex((h) => TITLE_HEADERS.includes(h));
		if (titleCol === -1) return null;
		return rows
			.slice(1)
			.map((r) => ({
				id: idCol >= 0 ? (r[idCol] ?? '').trim() : '',
				title: (r[titleCol] ?? '').trim(),
			}))
			.filter((t) => t.id || t.title);
	};
	if (trimmed.includes('\t')) {
		const tsv = fromTable(parseCsv(trimmed, '\t'));
		if (tsv) return tsv;
	}
	return fromTable(parseCsv(trimmed));
}

/**
 * Pasted/uploaded text → one queue line per ticket ("ID Title URL").
 * `linkFor` (when provided) appends a ticket URL for records with an id —
 * the room renders trailing URLs as ↗ links.
 */
export function extractTickets(text: string, linkFor?: (id: string) => string | null): string[] {
	const records = extractTicketRecords(text);
	if (records) {
		return records.map((t) => {
			const url = t.id && linkFor ? linkFor(t.id) : null;
			return [t.id, t.title, url].filter(Boolean).join(' ');
		});
	}
	// Plain lines: strip list bullets/checkboxes, drop empties.
	return text
		.split('\n')
		.map((l) => l.replace(/^\s*(?:[-*•]|\[[ x]\]|\d+[.)])\s*/i, '').trim())
		.filter(Boolean);
}

/* ── Linear link construction ─────────────────────────────────────────── */

const LINEAR_WS_KEY = 'sp:linear-workspace';
const LINEAR_ID = /^[A-Z][A-Z0-9]*-\d+$/;

/** Learn the workspace slug from any linear.app URL the user has handy. */
export function linearWorkspaceFromText(text: string): string | null {
	return text.match(/linear\.app\/([a-z0-9-]+)\//i)?.[1] ?? null;
}

export function getLinearWorkspace(): string {
	return localStorage.getItem(LINEAR_WS_KEY) ?? '';
}

export function setLinearWorkspace(slug: string): void {
	if (slug) localStorage.setItem(LINEAR_WS_KEY, slug);
}

/** URL builder for Linear-looking ticket ids, if we know the workspace. */
export function linearLinkFor(workspace: string): (id: string) => string | null {
	return (id) => (workspace && LINEAR_ID.test(id) ? `https://linear.app/${workspace}/issue/${id}` : null);
}
