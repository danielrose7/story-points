import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { baseStyles } from './base-styles';
import type { Role, RoomStateView } from '../../shared/types';
import { RoomConnection, type ConnectionStatus } from '../connection';
import { clearRoomSession, getSavedName, getSavedRole, getUserId, saveName, saveRole } from '../identity';
import { navigate } from '../main';
import { REACTION_EMOJI } from '../../shared/types';
import './settings-panel';
import './fx-layer';

class RoomPage extends LitElement {
	static properties = {
		roomId: { type: String },
		state: { state: true },
		status: { state: true },
		error: { state: true },
		nameDraft: { state: true },
		roleDraft: { state: true },
		showSettings: { state: true },
		elapsed: { state: true },
		copied: { state: true },
		storyDraft: { state: true },
	};

	roomId = '';
	state: RoomStateView | null = null;
	status: ConnectionStatus = 'connecting';
	error = '';
	nameDraft = getSavedName();
	roleDraft: Role = 'voter';
	showSettings = false;
	elapsed = 0;
	copied = false;
	storyDraft = '';

	private conn: RoomConnection | null = null;
	private timerHandle: ReturnType<typeof setInterval> | null = null;
	private storyEditing = false;
	private storySendHandle: ReturnType<typeof setTimeout> | null = null;
	private lastReactionSent = 0;
	private storyHadYolo = false;

	private get fx() {
		return this.shadowRoot?.querySelector('points-fx') as
			| (HTMLElement & {
					spawnReaction(e: string, n: string): void;
					celebrate(k: string, d?: object): void;
					toast(m: string): void;
					flames(): void;
			  })
			| null;
	}

	connectedCallback(): void {
		super.connectedCallback();
		const conn = new RoomConnection(this.roomId, getUserId());
		this.conn = conn;
		conn.onState = (state) => {
			const justRevealed = !(this.state?.revealed ?? false) && state.revealed;
			this.state = state;
			this.error = '';
			if (justRevealed) this.celebrateReveal(state);
			document.documentElement.dataset.theme = state.settings.theme ?? 'classic';
			const yolo = /\byolo\b/i.test(state.story);
			if (yolo && !this.storyHadYolo) this.fx?.flames();
			this.storyHadYolo = yolo;
			// While you're typing, your draft wins over server echoes; remote
			// edits land once you leave the field.
			if (!this.storyEditing) this.storyDraft = state.story;
		};
		conn.onStatus = (status) => (this.status = status);
		conn.onError = (message) => (this.error = message);
		conn.onReaction = (emoji, _from, name) => this.fx?.spawnReaction(emoji, name);

		// Reclaim a previous seat in this room without showing the join gate.
		const savedRole = getSavedRole(this.roomId);
		const savedName = getSavedName();
		if (savedRole && savedName) {
			this.roleDraft = savedRole;
			conn.send({ type: 'join', name: savedName, role: savedRole });
		}
		conn.connect();

		this.timerHandle = setInterval(() => {
			const s = this.state;
			if (s) this.elapsed = Math.max(0, (s.revealedAt ?? Date.now()) - s.roundStartedAt);
		}, 1000);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		delete document.documentElement.dataset.theme;
		this.conn?.close();
		this.conn = null;
		if (this.timerHandle) clearInterval(this.timerHandle);
	}

	static styles = [
		baseStyles,
		css`
		:host {
			display: block;
			max-width: 860px;
			margin: 0 auto;
			padding: 20px 16px 60px;
		}
		header {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 12px;
			flex-wrap: wrap;
			margin-bottom: 14px;
		}
		header .brand {
			font-weight: 800;
			font-size: 1.15rem;
			color: #eaf6ef;
			text-decoration: none;
			cursor: pointer;
		}
		.room-code {
			font-family: ui-monospace, monospace;
			opacity: 0.85;
		}
		.conn {
			font-size: 0.8rem;
			opacity: 0.8;
		}
		.panel {
			background: var(--ap-surface);
			color: var(--ap-surface-text);
			border-radius: var(--ap-radius);
			padding: 22px;
			box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
			margin-bottom: 18px;
		}
		.error {
			background: #fdecea;
			color: #b3261e;
			border-radius: 8px;
			padding: 10px 14px;
			margin-bottom: 14px;
		}

		/* Join gate */
		.gate {
			max-width: 420px;
			margin: 10vh auto 0;
			text-align: center;
		}
		.gate h2 {
			margin-top: 0;
		}
		.gate input {
			width: 100%;
			padding: 12px;
			font-size: 1.05rem;
			border: 1px solid #ccd6d0;
			border-radius: 10px;
			margin-bottom: 14px;
		}
		.roles {
			display: flex;
			gap: 10px;
			margin-bottom: 18px;
		}
		.roles button {
			flex: 1;
			padding: 12px;
			border-radius: 10px;
			border: 2px solid #ccd6d0;
			background: #fff;
			font-size: 0.95rem;
			cursor: pointer;
		}
		.roles button.active {
			border-color: var(--ap-accent);
			background: #fff8e6;
			font-weight: 700;
		}
		.join-btn {
			width: 100%;
			padding: 13px;
			border: none;
			border-radius: 10px;
			background: var(--ap-accent);
			color: var(--ap-accent-text);
			font-size: 1.05rem;
			font-weight: 700;
			cursor: pointer;
		}

		/* Toolbar */
		.toolbar {
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
			align-items: center;
		}
		.toolbar .spacer {
			flex: 1;
		}
		.btn {
			padding: 10px 16px;
			border-radius: 10px;
			border: 1px solid #ccd6d0;
			background: #f4f7f5;
			font-weight: 600;
			cursor: pointer;
		}
		.btn.primary {
			background: var(--ap-accent);
			border-color: var(--ap-accent);
			color: var(--ap-accent-text);
		}
		.btn.quiet {
			background: transparent;
		}
		.timer {
			font-family: ui-monospace, monospace;
			font-size: 1rem;
			color: var(--ap-muted);
		}
		.timer.amber {
			color: #c8860a;
			font-weight: 700;
		}
		.timer.rabbit {
			color: #d84a4a;
			font-weight: 700;
		}
		.timer .bun {
			display: inline-block;
			animation: bun-hop 0.5s ease-in-out infinite alternate;
		}
		@keyframes bun-hop {
			from {
				transform: translateY(0);
			}
			to {
				transform: translateY(-5px);
			}
		}

		/* Story */
		textarea.story {
			width: 100%;
			border: 1px solid #ccd6d0;
			border-radius: 10px;
			padding: 10px;
			font: inherit;
			resize: vertical;
			min-height: 52px;
		}
		label.field {
			display: block;
			font-size: 0.8rem;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--ap-muted);
			margin-bottom: 6px;
		}

		/* Deck */
		.deck {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
		}
		.card {
			min-width: 58px;
			height: 84px;
			border-radius: 10px;
			border: 2px solid #d6ded9;
			background: var(--ap-card);
			font-size: 1.25rem;
			font-weight: 700;
			cursor: pointer;
			transition: transform 0.12s ease, box-shadow 0.12s ease;
			padding: 0 10px;
		}
		.card:hover:not(:disabled) {
			transform: translateY(-6px);
			box-shadow: 0 10px 18px rgba(0, 0, 0, 0.18);
		}
		.card.selected {
			border-color: var(--ap-accent);
			background: #fff4d6;
			transform: translateY(-6px);
		}
		.card:disabled {
			opacity: 0.5;
			cursor: default;
		}

		/* Players */
		table {
			width: 100%;
			border-collapse: collapse;
		}
		th {
			text-align: left;
			font-size: 0.8rem;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--ap-muted);
			padding: 6px 8px;
			border-bottom: 2px solid #e3eae6;
		}
		td {
			padding: 10px 8px;
			border-bottom: 1px solid #eef2ef;
			font-size: 1.02rem;
		}
		.tag {
			font-size: 0.72rem;
			background: #eef2ef;
			border-radius: 6px;
			padding: 2px 7px;
			margin-left: 8px;
			color: var(--ap-muted);
			vertical-align: middle;
		}
		.vote-chip {
			display: inline-grid;
			place-items: center;
			min-width: 42px;
			height: 56px;
			border-radius: 8px;
			font-weight: 800;
			font-size: 1.1rem;
			padding: 0 8px;
		}
		.vote-chip.hidden-vote {
			background: var(--ap-card-back);
			color: transparent;
		}
		.vote-chip.shown {
			background: #fff4d6;
			border: 2px solid var(--ap-accent);
			color: var(--ap-surface-text);
		}
		tr.seat {
			animation: deal-in 0.35s ease-out backwards;
		}
		@keyframes deal-in {
			from {
				opacity: 0;
				transform: translateX(-24px);
			}
			to {
				opacity: 1;
				transform: translateX(0);
			}
		}
		.vote-chip.shown.flip {
			animation: flip-in 0.5s ease-out backwards;
		}
		@keyframes flip-in {
			0% {
				transform: perspective(400px) rotateY(90deg) scale(0.8);
			}
			60% {
				transform: perspective(400px) rotateY(-18deg) scale(1.05);
			}
			100% {
				transform: perspective(400px) rotateY(0deg) scale(1);
			}
		}
		.vote-chip.waiting {
			background: #f1f4f2;
			color: #b9c4be;
			font-weight: 400;
		}

		/* Results */
		.stats {
			display: flex;
			gap: 26px;
			flex-wrap: wrap;
		}
		.stat .num {
			font-size: 1.9rem;
			font-weight: 800;
		}
		.stat .lbl {
			font-size: 0.8rem;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--ap-muted);
		}
		.consensus {
			font-size: 1.1rem;
			font-weight: 700;
			color: #1b5e43;
		}

		/* Reactions */
		.reactions {
			display: flex;
			gap: 6px;
			flex-wrap: wrap;
			justify-content: center;
			margin-bottom: 18px;
		}
		.react {
			font-size: 1.3rem;
			line-height: 1;
			padding: 9px 11px;
			border-radius: 999px;
			border: none;
			background: rgba(255, 255, 255, 0.14);
			cursor: pointer;
			transition: transform 0.1s ease, background 0.1s ease;
		}
		.react:hover {
			transform: translateY(-3px) scale(1.15);
			background: rgba(255, 255, 255, 0.28);
		}
		.react:active {
			transform: scale(0.92);
		}

		/* Invite */
		.invite {
			display: flex;
			gap: 10px;
			align-items: center;
			flex-wrap: wrap;
		}
		.invite code {
			background: #f1f4f2;
			padding: 8px 12px;
			border-radius: 8px;
			font-size: 0.92rem;
		}
		`,
	];

	render() {
		const s = this.state;
		return html`
			<header>
				<a class="brand" @click=${() => navigate('/')}>🃏 Agile Points</a>
				<span class="room-code">${this.roomId}</span>
				<span class="conn">${this.statusLabel()}</span>
			</header>
			${this.error ? html`<div class="error">${this.error}</div>` : nothing}
			${!s || !s.youJoined ? this.renderGate() : this.renderTable(s)}
			<points-fx></points-fx>
		`;
	}

	private statusLabel() {
		switch (this.status) {
			case 'open':
				return '● live';
			case 'reconnecting':
				return '◌ reconnecting…';
			case 'connecting':
				return '◌ connecting…';
			default:
				return '';
		}
	}

	private renderGate() {
		return html`
			<div class="panel gate">
				<h2>Take a seat</h2>
				<input
					placeholder="Your name"
					.value=${this.nameDraft}
					@input=${(e: InputEvent) => (this.nameDraft = (e.target as HTMLInputElement).value)}
					@keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.join()}
				/>
				<div class="roles">
					<button
						class=${this.roleDraft === 'voter' ? 'active' : ''}
						@click=${() => (this.roleDraft = 'voter')}
					>
						🎴 Voter
					</button>
					<button
						class=${this.roleDraft === 'observer' ? 'active' : ''}
						@click=${() => (this.roleDraft = 'observer')}
					>
						👀 Observer
					</button>
				</div>
				<button class="join-btn" @click=${this.join}>Join room</button>
			</div>
		`;
	}

	private renderTable(s: RoomStateView) {
		const me = s.participants.find((p) => p.id === s.you);
		const isOwner = me?.isOwner ?? false;
		const voters = s.participants.filter((p) => p.role === 'voter');
		return html`
			${s.settings.roomName ? html`<div class="panel"><strong>${s.settings.roomName}</strong></div>` : nothing}

			<div class="panel">
				<label class="field">Story description</label>
				<textarea
					class="story"
					placeholder="What are we estimating?"
					.value=${this.storyDraft}
					@focus=${() => (this.storyEditing = true)}
					@blur=${this.onStoryBlur}
					@input=${this.onStoryInput}
				></textarea>
				<div class="toolbar" style="margin-top:12px">
					${s.revealed
						? html`
								<button class="btn primary" @click=${this.nextTicket}>Next ticket →</button>
								<button class="btn" @click=${this.revote}>Re-vote</button>
							`
						: html`
								<button class="btn primary" @click=${() => this.conn?.send({ type: 'reveal' })}>Show votes</button>
								<button class="btn" @click=${this.revote}>Re-vote</button>
							`}
					<span class="spacer"></span>
					<span class="timer ${this.timerMood(s)}">
						${this.timerMood(s) === 'rabbit' ? html`<span class="bun">🐇</span>` : nothing}
						${s.revealedAt !== null ? '⏸' : '⏱'} ${this.formatElapsed()}
					</span>
				</div>
			</div>

			${me?.role === 'voter'
				? html`
						<div class="panel">
							<label class="field">Your vote</label>
							<div class="deck">
								${s.settings.deck.map((c) => {
									const selected = me.vote === c.value;
									return html`
										<button
											class="card ${selected ? 'selected' : ''}"
											?disabled=${s.revealed}
											@click=${() => this.conn?.send({ type: 'vote', value: selected ? null : c.value })}
										>
											${c.label}
										</button>
									`;
								})}
							</div>
						</div>
					`
				: nothing}

			<div class="panel">
				<label class="field">Players</label>
				<table>
					<thead>
						<tr>
							<th>Player</th>
							<th>Points</th>
						</tr>
					</thead>
					<tbody>
						${repeat(
							s.participants,
							(p) => p.id,
							(p, i) => html`
								<tr class="seat">
									<td>
										${p.name}
										${p.isOwner ? html`<span class="tag">host</span>` : nothing}
										${p.role === 'observer' ? html`<span class="tag">observer</span>` : nothing}
										${p.id === s.you ? html`<span class="tag">you</span>` : nothing}
									</td>
									<td>
										${p.role === 'observer'
											? html`—`
											: p.vote !== null
												? html`<span
														class="vote-chip shown ${s.revealed ? 'flip' : ''}"
														style="animation-delay:${i * 90}ms"
														>${this.labelFor(s, p.vote)}</span
													>`
												: p.hasVoted
													? html`<span class="vote-chip hidden-vote">?</span>`
													: html`<span class="vote-chip waiting">…</span>`}
									</td>
								</tr>
							`,
						)}
					</tbody>
				</table>
			</div>

			${s.revealed && voters.length ? this.renderStats(s) : nothing}

			<div class="reactions" title="React — 🐇 = we're going down a rabbit hole">
				${REACTION_EMOJI.map(
					(e) => html`<button class="react" @click=${() => this.sendReaction(e)}>${e}</button>`,
				)}
			</div>

			<div class="panel">
				<label class="field">Invite your team</label>
				<div class="invite">
					<code>${location.href}</code>
					<button class="btn" @click=${this.copyLink}>${this.copied ? 'Copied ✓' : 'Copy link'}</button>
				</div>
			</div>

			<div class="toolbar">
				${isOwner
					? html`<button class="btn" @click=${() => (this.showSettings = !this.showSettings)}>
							⚙️ Room settings
						</button>`
					: nothing}
				<button class="btn" @click=${this.switchRole}>
					${me?.role === 'voter' ? 'Switch to observer' : 'Switch to voter'}
				</button>
				<span class="spacer"></span>
				<button class="btn quiet" style="color:#ffd9d2" @click=${this.leave}>Leave room</button>
			</div>

			${this.showSettings && isOwner
				? html`<points-settings
						.settings=${s.settings}
						@save=${(e: CustomEvent) => {
							this.conn?.send({ type: 'settings', settings: e.detail });
							this.showSettings = false;
						}}
						@close=${() => (this.showSettings = false)}
					></points-settings>`
				: nothing}
		`;
	}

	private renderStats(s: RoomStateView) {
		const votes = s.participants
			.filter((p) => p.role === 'voter' && p.vote !== null)
			.map((p) => p.vote as string);
		const numeric = votes.map(Number).filter((n) => !Number.isNaN(n));
		const avg = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;
		const consensus = votes.length > 1 && votes.every((v) => v === votes[0]);
		return html`
			<div class="panel">
				<label class="field">Results</label>
				<div class="stats">
					<div class="stat">
						<div class="num">${votes.length}</div>
						<div class="lbl">votes</div>
					</div>
					${avg !== null
						? html`<div class="stat">
								<div class="num">${Math.round(avg * 100) / 100}</div>
								<div class="lbl">average</div>
							</div>`
						: nothing}
					${consensus ? html`<div class="consensus">🎉 Consensus!</div>` : nothing}
				</div>
			</div>
		`;
	}

	private labelFor(s: RoomStateView, value: string): string {
		return s.settings.deck.find((c) => c.value === value)?.label ?? value;
	}

	/** Timer personality: calm → amber at 5 min → red with a hopping rabbit at 10 min. */
	private timerMood(s: RoomStateView): '' | 'amber' | 'rabbit' {
		if (s.revealedAt !== null) return '';
		if (this.elapsed > 10 * 60_000) return 'rabbit';
		if (this.elapsed > 5 * 60_000) return 'amber';
		return '';
	}

	private formatElapsed(): string {
		const total = Math.floor(this.elapsed / 1000);
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const sec = total % 60;
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(h)}:${pad(m)}:${pad(sec)}`;
	}

	/** Pick a celebration based on how the vote landed. */
	private celebrateReveal(s: RoomStateView): void {
		const votes = s.participants.filter((p) => p.role === 'voter' && p.vote !== null).map((p) => p.vote as string);
		if (votes.length < 2) return;
		if (votes.every((v) => v === '?')) return this.fx?.celebrate('allq');
		if (votes.every((v) => v === votes[0])) return this.fx?.celebrate('consensus');
		// "Big split" = far apart in deck order (works for numbers and t-shirts alike).
		const indices = votes
			.map((v) => s.settings.deck.findIndex((c) => c.value === v))
			.filter((i) => i >= 0);
		const lo = Math.min(...indices);
		const hi = Math.max(...indices);
		if (hi - lo >= 4) {
			this.fx?.celebrate('split', {
				min: s.settings.deck[lo]?.label,
				max: s.settings.deck[hi]?.label,
			});
		}
	}

	private sendReaction(emoji: string): void {
		const now = Date.now();
		if (now - this.lastReactionSent < 300) return;
		this.lastReactionSent = now;
		this.conn?.send({ type: 'reaction', emoji });
	}

	/** Re-vote the same ticket: clears votes and timer, keeps the description. */
	private revote = () => {
		this.conn?.send({ type: 'clear' });
	};

	/** Move on: clears votes, timer, and description, then focuses the story box. */
	private nextTicket = () => {
		if (this.storySendHandle) clearTimeout(this.storySendHandle);
		this.storySendHandle = null;
		this.storyDraft = '';
		this.conn?.send({ type: 'clear', clearStory: true });
		requestAnimationFrame(() => {
			this.shadowRoot?.querySelector<HTMLTextAreaElement>('textarea.story')?.focus();
		});
	};

	private onStoryInput = (e: InputEvent) => {
		this.storyDraft = (e.target as HTMLTextAreaElement).value;
		if (this.storySendHandle) clearTimeout(this.storySendHandle);
		this.storySendHandle = setTimeout(() => this.sendStory(), 400);
	};

	private onStoryBlur = () => {
		this.storyEditing = false;
		this.sendStory();
	};

	private sendStory(): void {
		if (this.storySendHandle) clearTimeout(this.storySendHandle);
		this.storySendHandle = null;
		if (this.storyDraft !== this.state?.story) {
			this.conn?.send({ type: 'story', text: this.storyDraft });
		}
	}

	private join = () => {
		const name = this.nameDraft.trim();
		if (!name) return;
		saveName(name);
		saveRole(this.roomId, this.roleDraft);
		this.conn?.send({ type: 'join', name, role: this.roleDraft });
	};

	private switchRole = () => {
		const me = this.state?.participants.find((p) => p.id === this.state?.you);
		if (!me) return;
		const role: Role = me.role === 'voter' ? 'observer' : 'voter';
		saveRole(this.roomId, role);
		this.conn?.send({ type: 'join', name: me.name, role });
	};

	private leave = () => {
		this.conn?.send({ type: 'leave' });
		clearRoomSession(this.roomId);
		navigate('/');
	};

	private copyLink = async () => {
		await navigator.clipboard.writeText(location.href);
		this.copied = true;
		setTimeout(() => (this.copied = false), 1500);
	};
}

customElements.define('points-room', RoomPage);
