import { LitElement, html, css } from 'lit';
import { baseStyles } from './base-styles';
import './site-footer';
import { generateRoomSlug } from '../slug';
import { navigate } from '../router';
import { t, tn, fmtNum, timeAgo } from '../i18n';
import { applyTheme, todaysTheme } from '../theme';
import { getRecentRooms, type RecentRoom } from '../recents';
import { ROOM_PRESETS, type RoomPeek, type StatsSnapshot } from '../../shared/types';

// The lifetime counter only shows once it's social proof rather than an
// empty-restaurant sign; live activity is compelling at any size.
const VOTES_DISPLAY_FLOOR = 2500;

class HomePage extends LitElement {
	static properties = {
		joinCode: { state: true },
		lostPath: { attribute: false },
		lostRoomExists: { state: true },
		recents: { state: true },
		stats: { state: true },
	};

	joinCode = '';
	preset = 'sprint';
	lostPath = '';
	lostRoomExists: boolean | null = null;
	recents: RecentRoom[] = getRecentRooms();
	stats: StatsSnapshot | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		// Home wears the season's colors (the head script painted them already).
		applyTheme(todaysTheme());
		// Keep "Jump back in" live: another tab touching a room fires
		// `storage`; returning via the back/forward cache fires `pageshow`.
		window.addEventListener('storage', this.refreshRecents);
		window.addEventListener('pageshow', this.refreshRecents);
		fetch('/api/stats')
			.then((r) => r.json() as Promise<StatsSnapshot>)
			.then((s) => (this.stats = s))
			.catch(() => {}); // the strip is a nicety — never an error state
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener('storage', this.refreshRecents);
		window.removeEventListener('pageshow', this.refreshRecents);
	}

	private refreshRecents = () => {
		this.recents = getRecentRooms();
	};

	/** Turn a lost URL into a plausible room slug: /Team%20Alpha! → team-alpha */
	private get lostSlug(): string {
		try {
			return decodeURIComponent(this.lostPath)
				.replace(/^\/(room\/)?/, '')
				.toLowerCase()
				.replace(/[^a-z0-9-]+/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-|-$/g, '')
				.slice(0, 64);
		} catch {
			return '';
		}
	}

	willUpdate(changed: Map<string, unknown>): void {
		if (changed.has('lostPath') && this.lostSlug) {
			this.lostRoomExists = null;
			fetch(`/api/room/${this.lostSlug}/peek`)
				.then((r) => r.json() as Promise<RoomPeek>)
				.then(({ exists }) => (this.lostRoomExists = exists))
				.catch(() => (this.lostRoomExists = false));
		}
	}

	static styles = [
		baseStyles,
		css`
		/* App-first landing: the hero owns the whole first viewport (the
		   create/join card IS the product); how-it-works, features, and the
		   open-source note exist only for whoever scrolls. */
		:host {
			display: flex;
			flex-direction: column;
			align-items: center;
			min-height: 100vh;
			min-height: 100dvh;
			padding: 24px 24px 16px;
		}
		.hero {
			min-height: calc(100dvh - 40px);
			display: grid;
			place-content: center;
			justify-items: center;
			gap: 18px;
			width: 100%;
		}
		.trust {
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			gap: 6px 8px;
			font-size: 0.8rem;
			color: var(--sp-on-bg);
			opacity: 0.85;
		}
		.trust span {
			padding: 4px 12px;
			border-radius: 999px;
			border: 1px solid color-mix(in srgb, var(--sp-on-bg) 30%, transparent);
		}
		.below {
			width: 100%;
			max-width: 820px;
			color: var(--sp-on-bg);
			display: grid;
			gap: 28px;
			padding: 40px 0 8px;
		}
		.below h2 {
			font-size: 0.8rem;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			opacity: 0.65;
			margin: 0 0 12px;
			text-align: center;
		}
		.steps {
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			gap: 10px 28px;
			margin: 0;
			padding: 0;
			list-style: none;
			text-align: center;
		}
		.steps li {
			max-width: 200px;
		}
		.step-num {
			display: inline-grid;
			place-items: center;
			width: 26px;
			height: 26px;
			border-radius: 50%;
			background: var(--sp-accent);
			color: var(--sp-accent-text);
			font-weight: 800;
			font-size: 0.85rem;
			margin-bottom: 6px;
		}
		.steps .how {
			opacity: 0.8;
			font-size: 0.88rem;
			line-height: 1.4;
		}
		.feats {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 12px;
		}
		.feat {
			display: block;
			padding: 16px 18px;
			border-radius: 12px;
			background: color-mix(in srgb, var(--sp-surface) 10%, transparent);
			border: 1px solid color-mix(in srgb, var(--sp-on-bg) 18%, transparent);
			color: inherit;
			text-decoration: none;
			line-height: 1.45;
			font-size: 0.9rem;
		}
		.feat:hover {
			background: color-mix(in srgb, var(--sp-surface) 18%, transparent);
			border-color: color-mix(in srgb, var(--sp-on-bg) 32%, transparent);
		}
		.feat strong {
			display: block;
			margin-bottom: 4px;
		}
		.feat .more {
			opacity: 0.7;
			font-size: 0.82rem;
		}
		.oss {
			text-align: center;
			font-size: 0.9rem;
			opacity: 0.85;
			line-height: 1.5;
			margin: 0;
		}
		.oss a {
			color: inherit;
		}
		points-footer {
			margin-top: 40px;
		}
		.stack {
			min-width: 0;
		}
		/* grid tracks size to item min-content; without this a long room name
		   in the recents list pushes every panel wider than the viewport */
		.stack > * {
			min-width: 0;
		}
		.stack {
			display: grid;
			gap: 16px;
			max-width: 460px;
			width: 100%;
		}
		.panel.recents {
			text-align: left;
			padding: 20px 24px;
		}
		.recents-title {
			font-size: 0.8rem;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--sp-muted);
			margin-bottom: 10px;
		}
		.recent {
			display: flex;
			align-items: baseline;
			gap: 10px;
			padding: 10px 12px;
			border-radius: 10px;
			text-decoration: none;
			color: var(--sp-surface-text);
			background: var(--sp-btn-bg);
			border: 1px solid var(--sp-divider);
			margin-bottom: 6px;
		}
		.recent:hover {
			border-color: var(--sp-accent);
			background: var(--sp-highlight);
		}
		.recent-name {
			font-weight: 700;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.recent-slug {
			font-family: ui-monospace, monospace;
			font-size: 0.8rem;
			color: var(--sp-muted);
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.recent-when {
			margin-left: auto;
			font-size: 0.8rem;
			color: var(--sp-muted);
			white-space: nowrap;
		}
		.panel.lost {
			background: var(--sp-highlight);
			border: 2px dashed var(--sp-accent);
		}
		.lost-code {
			font-size: 2.6rem;
			font-weight: 900;
			letter-spacing: 0.1em;
		}
		.lost-msg code {
			background: var(--sp-code-bg);
			padding: 2px 8px;
			border-radius: 6px;
			word-break: break-all;
		}
		.lost-hint {
			color: var(--sp-muted);
			margin: 6px 0 14px;
		}
		.panel {
			background: var(--sp-surface);
			color: var(--sp-surface-text);
			border-radius: var(--sp-radius);
			padding: 40px 44px;
			max-width: 460px;
			width: 100%;
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
			text-align: center;
		}
		h1 {
			margin: 0 0 4px;
			font-size: 2rem;
		}
		.tagline {
			color: var(--sp-muted);
			margin: 0 0 28px;
		}
		button.primary {
			width: 100%;
			padding: 14px;
			font-size: 1.1rem;
			font-weight: 700;
			border: none;
			border-radius: 10px;
			background: var(--sp-accent);
			color: var(--sp-accent-text);
			cursor: pointer;
			transition: transform 0.1s ease;
		}
		button.primary:hover {
			transform: translateY(-2px);
		}
		.preset-row {
			display: flex;
			gap: 8px;
			align-items: center;
			justify-content: center;
			margin-top: 10px;
			font-size: 0.85rem;
			color: var(--sp-muted);
		}
		.preset-row select {
			font: inherit;
			padding: 6px 8px;
			border: 1px solid var(--sp-border);
			border-radius: 8px;
			background: var(--sp-btn-bg);
			color: var(--sp-surface-text);
		}
		.stats {
			margin-top: 20px;
			font-size: 0.82rem;
			color: var(--sp-muted);
		}
		.stats-sep {
			margin: 0 8px;
			opacity: 0.6;
		}
		.live-dot {
			display: inline-block;
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--sp-accent);
			margin-right: 2px;
			animation: live-pulse 2s ease-in-out infinite;
		}
		@keyframes live-pulse {
			50% { opacity: 0.4; }
		}
		.divider {
			margin: 24px 0 16px;
			color: var(--sp-muted);
			font-size: 0.85rem;
			text-transform: uppercase;
			letter-spacing: 0.1em;
		}
		form {
			display: flex;
			gap: 8px;
		}
		input {
			flex: 1;
			/* flex min-width:auto would force the panel wider than its
			   container on small screens (placeholder's intrinsic width) */
			min-width: 0;
			padding: 12px;
			border: 1px solid var(--sp-border);
			border-radius: 10px;
			font-size: 1rem;
		}
		form button {
			padding: 12px 18px;
			border: 1px solid var(--sp-border);
			background: var(--sp-btn-bg);
			border-radius: 10px;
			font-weight: 600;
			cursor: pointer;
		}
		`,
	];

	render() {
		return html`
			<div class="hero">
			<div class="stack">
				${this.lostPath ? this.renderLost() : ''}
				<div class="panel">
				<h1>🃏 Story Points</h1>
				<p class="tagline">${t('Estimate together, in realtime.')}</p>
				<button class="primary" @click=${this.createRoom}>${t('Create a room')}</button>
				<label class="preset-row">
					<span>${t('starting from')}</span>
					<select @change=${(e: Event) => (this.preset = (e.target as HTMLSelectElement).value)}>
						${ROOM_PRESETS.map(
							(p) => html`<option value=${p.id} title=${t(p.description)} ?selected=${p.id === this.preset}>
								${t(p.label)}
							</option>`,
						)}
					</select>
				</label>
				<div class="divider">${t('or join an existing one')}</div>
				<form @submit=${this.joinRoom}>
					<input
						placeholder=${t('room name, e.g. brave-gold-otter')}
						.value=${this.joinCode}
						@input=${(e: InputEvent) => (this.joinCode = (e.target as HTMLInputElement).value)}
					/>
					<button type="submit">${t('Join')}</button>
				</form>
				${this.renderStats()}
				</div>
				${this.recents.length ? this.renderRecents() : ''}
			</div>
			<div class="trust">
				<span>${t('Free forever')}</span>
				<span>${t('Open source (MIT)')}</span>
				<span>${t('No accounts')}</span>
			</div>
			</div>

			<div class="below">
				<div>
					<h2>${t('How it works')}</h2>
					<ol class="steps">
						<li>
							<span class="step-num">1</span>
							<div class="how">${t('Create a room — or claim any URL you like')}</div>
						</li>
						<li>
							<span class="step-num">2</span>
							<div class="how">${t('Share the link; the URL is the invite')}</div>
						</li>
						<li>
							<span class="step-num">3</span>
							<div class="how">${t('Vote in secret, reveal together, discuss')}</div>
						</li>
					</ol>
				</div>
				<div class="feats">
					<a class="feat" href="/docs/api">
						<strong>🤖 ${t('Agent-ready')}</strong>
						${t('Import backlogs and export results over a plain-HTTP API; llms.txt and a one-step setup prompt for AI agents.')}
						<div class="more">${t('API docs')} →</div>
					</a>
					<a class="feat" href="/docs/themes">
						<strong>🎨 ${t('17 themes')}</strong>
						${t('Card table to spaceship, plus a full seasonal calendar — new rooms dress for the date.')}
						<div class="more">${t('Browse themes')} →</div>
					</a>
					<a class="feat" href="/docs/features">
						<strong>📜 ${t('History & export')}</strong>
						${t('Every round recorded; copy out as Markdown or CSV, or pull JSON from the API.')}
						<div class="more">${t('All features')} →</div>
					</a>
				</div>
				<p class="oss">
					${t('MIT-licensed and')} <a href="/docs/self-host">${t('self-hostable in three commands')}</a>
					${t('— no paywall, no catch.')}
					<a href="https://github.com/danielrose7/story-points">GitHub</a> ·
					<a href="/docs/compare">${t('How it compares')}</a>
				</p>
			</div>
			<points-footer></points-footer>
		`;
	}

	/** Social-proof strip: live activity whenever it's non-zero, the lifetime
	 *  vote counter once it clears the display floor. Nothing → no element. */
	private renderStats() {
		const s = this.stats;
		if (!s) return '';
		const parts = [];
		if (s.liveRooms > 0) {
			parts.push(
				html`<span class="live-dot"></span> ${tn(
					s.liveRooms,
					'1 team estimating right now',
					'%1 teams estimating right now',
				)}`,
			);
		}
		if (s.votes >= VOTES_DISPLAY_FLOOR) {
			parts.push(html`${t('%1 votes cast', fmtNum(s.votes))}`);
		}
		if (parts.length === 0) return '';
		return html`<div class="stats">
			${parts.map((p, i) => html`${i > 0 ? html`<span class="stats-sep">·</span>` : ''}${p}`)}
		</div>`;
	}

	private renderRecents() {
		return html`
			<div class="panel recents">
				<div class="recents-title">${t('Jump back in')}</div>
				${this.recents.map(
					(r) => html`
						<a class="recent" href="/room/${r.id}" @click=${(e: MouseEvent) => this.openRecent(e, r.id)}>
							<span class="recent-name">${r.name || r.id}</span>
							${r.name ? html`<span class="recent-slug">${r.id}</span>` : ''}
							<span class="recent-when">${timeAgo(r.lastSeen)}</span>
						</a>
					`,
				)}
			</div>
		`;
	}

	private openRecent(e: MouseEvent, id: string): void {
		e.preventDefault();
		navigate(`/room/${id}`);
	}

	private renderLost() {
		const slug = this.lostSlug;
		return html`
			<div class="panel lost">
				<div class="lost-code">4🂠4</div>
				<p class="lost-msg"><code>${this.lostPath}</code> isn't a page here.</p>
				${slug
					? this.lostRoomExists === null
						? html`<p class="lost-hint">Checking if “${slug}” is a room…</p>`
						: this.lostRoomExists
							? html`
									<p class="lost-hint">But <strong>${slug}</strong> is an existing room!</p>
									<button class="primary" @click=${() => navigate(`/room/${slug}`)}>Join “${slug}”</button>
								`
							: html`
									<p class="lost-hint">It could be a room, though — nobody has claimed it yet.</p>
									<button class="primary" @click=${() => navigate(`/room/${slug}`)}>
										Create room “${slug}”
									</button>
								`
					: html`<p class="lost-hint">Pick a room below instead.</p>`}
			</div>
		`;
	}

	private createRoom = async () => {
		const q = this.preset && this.preset !== 'sprint' ? `?preset=${this.preset}` : '';
		// A slug is a capability: colliding with a live room would drop the
		// creator into a stranger's session. Peek before claiming (word lists
		// give ~10k combos per locale); after 4 taken-slugs in a row, stop
		// gambling and bolt on a 4-digit suffix (~96M effective names).
		for (let i = 0; i < 4; i++) {
			const slug = generateRoomSlug();
			try {
				const peek = (await fetch(`/api/room/${slug}/peek`).then((r) => r.json())) as RoomPeek;
				if (!peek.exists) return navigate(`/room/${slug}${q}`);
			} catch {
				// peek unavailable — better to proceed than to block creation
				return navigate(`/room/${slug}${q}`);
			}
		}
		const n = 1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000);
		navigate(`/room/${generateRoomSlug()}-${n}${q}`);
	};

	private joinRoom = (e: SubmitEvent) => {
		e.preventDefault();
		// Read the live input value: autofill/dictation can set it without
		// ever firing input events, leaving component state stale until blur.
		const raw = (e.currentTarget as HTMLFormElement).querySelector('input')?.value ?? this.joinCode;
		const code = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
		if (code) navigate(`/room/${code}`);
	};
}

customElements.define('points-home', HomePage);
