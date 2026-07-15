import { LitElement, html, css } from 'lit';
import { baseStyles } from './base-styles';
import './site-footer';
import { generateRoomSlug } from '../slug';
import { navigate } from '../main';
import { applyTheme, todaysTheme } from '../theme';
import { getRecentRooms, type RecentRoom } from '../recents';
import { ROOM_PRESETS, type RoomPeek } from '../../shared/types';

class HomePage extends LitElement {
	static properties = {
		joinCode: { state: true },
		lostPath: { attribute: false },
		lostRoomExists: { state: true },
		recents: { state: true },
	};

	joinCode = '';
	preset = 'sprint';
	lostPath = '';
	lostRoomExists: boolean | null = null;
	recents: RecentRoom[] = getRecentRooms();

	connectedCallback(): void {
		super.connectedCallback();
		// Home wears the season's colors (the head script painted them already).
		applyTheme(todaysTheme());
		// Keep "Jump back in" live: another tab touching a room fires
		// `storage`; returning via the back/forward cache fires `pageshow`.
		window.addEventListener('storage', this.refreshRecents);
		window.addEventListener('pageshow', this.refreshRecents);
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
		/* Standard page flow: hero vertically centered in the remaining
		   viewport, footer resting at the bottom (pushed further only by
		   content growth — recents, lost-room panel). */
		:host {
			display: flex;
			flex-direction: column;
			align-items: center;
			min-height: 100vh;
			min-height: 100dvh;
			padding: 24px 24px 16px;
		}
		.stack {
			margin: auto 0;
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
			<div class="stack">
				${this.lostPath ? this.renderLost() : ''}
				<div class="panel">
				<h1>🃏 Story Points</h1>
				<p class="tagline">Estimate together, in realtime.</p>
				<button class="primary" @click=${this.createRoom}>Create a room</button>
				<label class="preset-row">
					<span>starting from</span>
					<select @change=${(e: Event) => (this.preset = (e.target as HTMLSelectElement).value)}>
						${ROOM_PRESETS.map(
							(p) => html`<option value=${p.id} title=${p.description} ?selected=${p.id === this.preset}>
								${p.label}
							</option>`,
						)}
					</select>
				</label>
				<div class="divider">or join an existing one</div>
				<form @submit=${this.joinRoom}>
					<input
						placeholder="room name, e.g. brave-gold-otter"
						.value=${this.joinCode}
						@input=${(e: InputEvent) => (this.joinCode = (e.target as HTMLInputElement).value)}
					/>
					<button type="submit">Join</button>
				</form>
				</div>
				${this.recents.length ? this.renderRecents() : ''}
			</div>
			<points-footer></points-footer>
		`;
	}

	private renderRecents() {
		return html`
			<div class="panel recents">
				<div class="recents-title">Jump back in</div>
				${this.recents.map(
					(r) => html`
						<a class="recent" href="/room/${r.id}" @click=${(e: MouseEvent) => this.openRecent(e, r.id)}>
							<span class="recent-name">${r.name || r.id}</span>
							${r.name ? html`<span class="recent-slug">${r.id}</span>` : ''}
							<span class="recent-when">${this.timeAgo(r.lastSeen)}</span>
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

	private timeAgo(ts: number): string {
		const mins = Math.round((Date.now() - ts) / 60_000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.round(hours / 24);
		return `${days}d ago`;
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

	private createRoom = () => {
		const q = this.preset && this.preset !== 'sprint' ? `?preset=${this.preset}` : '';
		navigate(`/room/${generateRoomSlug()}${q}`);
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
