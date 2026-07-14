import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { baseStyles } from './base-styles';
import type { Role, RoomStateView } from '../../shared/types';
import { RoomConnection, type ConnectionStatus } from '../connection';
import { clearRoomSession, getSavedName, getSavedRole, getUserId, saveName, saveRole } from '../identity';
import { navigate } from '../main';
import { REACTION_EMOJI, THEME_REACTIONS } from '../../shared/types';
import { chime, getVolume, isMuted, setMuted, setVolume } from '../sound';
import { applyTheme } from '../theme';
import { touchRecentRoom } from '../recents';
import './settings-panel';
import './fx-layer';

/** How long "Copied ✓" feedback lingers on any copy button. */
const COPIED_RESET_MS = 1500;

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
		copiedExport: { state: true },
		storyDraft: { state: true },
		queueDraft: { state: true },
		muted: { state: true },
		volume: { state: true },
		timerWobble: { state: true },
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
	copiedExport: 'md' | 'csv' | null = null;
	storyDraft = '';
	queueDraft = '';
	muted = isMuted();
	volume = getVolume();
	timerWobble = false;

	private conn: RoomConnection | null = null;
	private timerHandle: ReturnType<typeof setInterval> | null = null;
	private storyEditing = false;
	private storySendHandle: ReturnType<typeof setTimeout> | null = null;
	private lastReactionSent = 0;
	private storyHadYolo = false;
	private roundKey = 0;
	private lastStage = 0;

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
			// state.theme is the resolved theme ('seasonal' → today's holiday).
			applyTheme(state.theme ?? state.settings.theme ?? 'classic', this.roomId);
			if (state.youJoined) touchRecentRoom(this.roomId, state.settings.roomName);
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
			if (!s) return;
			this.elapsed = Math.max(0, (s.revealedAt ?? Date.now()) - s.roundStartedAt);

			// New round (or first sight of one, e.g. after refresh): sync the
			// stage without firing catch-up chimes at whoever just walked in.
			if (s.roundStartedAt !== this.roundKey) {
				this.roundKey = s.roundStartedAt;
				this.lastStage = this.timerStage(s);
				return;
			}
			const stage = this.timerStage(s);
			if (stage > this.lastStage) {
				const crossed15 = this.lastStage < 3 && stage >= 3;
				if ((s.settings.timerSounds ?? true) && !this.muted && stage <= 4) {
					if (stage === 1) chime.amber();
					else chime.rabbit();
				}
				if (crossed15) {
					this.fx?.toast('⏳ 15 minutes on this one — split the ticket, park it, or timebox 5 more?');
				}
				// Each new rabbit arrives with a size-up wobble.
				if (stage >= 2) {
					this.timerWobble = true;
					setTimeout(() => (this.timerWobble = false), 900);
				}
				this.lastStage = stage;
			}
		}, 1000);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
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
			color: var(--sp-on-bg-strong);
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
			display: inline-flex;
			align-items: center;
			gap: 8px;
		}
		.mute {
			border: none;
			background: var(--sp-overlay-btn);
			border-radius: 999px;
			padding: 4px 8px;
			font-size: 0.95rem;
			cursor: pointer;
		}
		.vol {
			width: 72px;
			accent-color: var(--sp-accent);
			cursor: pointer;
		}
		.panel {
			background: var(--sp-surface);
			color: var(--sp-surface-text);
			border-radius: var(--sp-radius);
			padding: 22px;
			box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
			margin-bottom: 18px;
		}
		.error {
			background: var(--sp-error-bg);
			color: var(--sp-error-text);
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
			border: 1px solid var(--sp-border);
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
			border: 2px solid var(--sp-border);
			background: var(--sp-surface);
			font-size: 0.95rem;
			cursor: pointer;
		}
		.roles button.active {
			border-color: var(--sp-accent);
			background: var(--sp-highlight);
			font-weight: 700;
		}
		.join-btn {
			width: 100%;
			padding: 13px;
			border: none;
			border-radius: 10px;
			background: var(--sp-accent);
			color: var(--sp-accent-text);
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
			border: 1px solid var(--sp-border);
			background: var(--sp-btn-bg);
			font-weight: 600;
			cursor: pointer;
		}
		.btn.primary {
			background: var(--sp-accent);
			border-color: var(--sp-accent);
			color: var(--sp-accent-text);
		}
		.btn.quiet {
			background: transparent;
		}
		.timer {
			font-family: ui-monospace, monospace;
			font-size: 1rem;
			color: var(--sp-muted);
			display: inline-block;
			transition: font-size 0.4s ease;
		}
		.timer.wobble {
			animation: timer-wobble 0.85s cubic-bezier(0.36, 0.07, 0.19, 0.97);
		}
		@keyframes timer-wobble {
			0% {
				transform: scale(1) rotate(0);
			}
			25% {
				transform: scale(1.45) rotate(-5deg);
			}
			45% {
				transform: scale(1.38) rotate(4deg);
			}
			65% {
				transform: scale(1.3) rotate(-3deg);
			}
			82% {
				transform: scale(1.12) rotate(1.5deg);
			}
			100% {
				transform: scale(1) rotate(0);
			}
		}
		.timer.amber {
			color: var(--sp-timer-warn);
			font-weight: 700;
		}
		.timer.rabbit {
			color: var(--sp-timer-late);
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
			border: 1px solid var(--sp-border);
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
			color: var(--sp-muted);
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
			border: 2px solid var(--sp-border);
			background: var(--sp-card);
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
			border-color: var(--sp-accent);
			background: var(--sp-highlight-strong);
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
			color: var(--sp-muted);
			padding: 6px 8px;
			border-bottom: 2px solid var(--sp-border-soft);
		}
		td {
			padding: 10px 8px;
			border-bottom: 1px solid var(--sp-divider);
			font-size: 1.02rem;
		}
		.tag {
			font-size: 0.72rem;
			background: var(--sp-divider);
			border-radius: 6px;
			padding: 2px 7px;
			margin-left: 8px;
			color: var(--sp-muted);
			vertical-align: middle;
		}
		.make-host {
			font-size: 0.72rem;
			border: 1px solid var(--sp-border);
			background: transparent;
			border-radius: 6px;
			padding: 2px 7px;
			margin-left: 8px;
			color: var(--sp-muted);
			cursor: pointer;
			/* dimmed, not hidden — touch screens have no hover */
			opacity: 0.55;
			transition: opacity 0.15s;
		}
		tr.seat:hover .make-host,
		.make-host:focus-visible {
			opacity: 1;
		}
		.make-host:hover {
			border-color: var(--sp-accent);
			color: var(--sp-surface-text);
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
			background: var(--sp-card-back);
			color: transparent;
		}
		.vote-chip.shown {
			background: var(--sp-highlight-strong);
			border: 2px solid var(--sp-accent);
			color: var(--sp-surface-text);
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
			background: var(--sp-chip-bg);
			color: var(--sp-waiting);
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
			color: var(--sp-muted);
		}
		.consensus {
			font-size: 1.1rem;
			font-weight: 700;
			color: var(--sp-success);
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
			background: var(--sp-overlay-btn);
			cursor: pointer;
			transition: transform 0.1s ease, background 0.1s ease;
		}
		.react:hover {
			transform: translateY(-3px) scale(1.15);
			background: var(--sp-overlay-btn-hover);
		}
		.react:active {
			transform: scale(0.92);
		}

		.btn.copied {
			border-color: var(--sp-success);
			color: var(--sp-success);
			background: var(--sp-success-bg);
			box-shadow: 0 0 0 4px var(--sp-success-ring);
			animation: copied-pop 0.35s cubic-bezier(0.2, 2, 0.4, 1);
		}
		@keyframes copied-pop {
			0% {
				transform: scale(1);
			}
			45% {
				transform: scale(1.12);
			}
			100% {
				transform: scale(1);
			}
		}

		/* Invite */
		.invite {
			display: flex;
			gap: 10px;
			align-items: center;
			flex-wrap: wrap;
		}
		.invite code {
			background: var(--sp-chip-bg);
			padding: 8px 12px;
			border-radius: 8px;
			font-size: 0.92rem;
			max-width: 100%;
			overflow-wrap: anywhere;
			word-break: break-all;
		}

		/* Vote distribution (revealed rounds with a spread) */
		.dist {
			margin-top: 18px;
			display: grid;
			gap: 7px;
		}
		.dist-row {
			display: grid;
			grid-template-columns: 52px 1fr 30px;
			align-items: center;
			gap: 10px;
		}
		.dist-label {
			font-weight: 700;
			text-align: right;
		}
		.dist-track {
			background: var(--sp-chip-bg);
			border-radius: 999px;
			height: 18px;
		}
		.dist-fill {
			height: 100%;
			min-width: 18px;
			background: var(--sp-accent);
			border-radius: 999px;
			animation: dist-grow 0.5s ease-out;
		}
		@keyframes dist-grow {
			from {
				width: 0;
			}
		}
		.dist-count {
			color: var(--sp-muted);
			font-weight: 600;
		}

		/* Round history */
		.hist-details summary {
			cursor: pointer;
			font-weight: 700;
		}
		.hist {
			display: grid;
			gap: 8px;
			margin-top: 12px;
		}
		.hist-row {
			display: grid;
			gap: 5px;
			padding: 10px 12px;
			border: 1px solid var(--sp-divider);
			border-radius: 10px;
			background: var(--sp-btn-bg);
		}
		.hist-story {
			font-weight: 600;
			overflow-wrap: anywhere;
		}
		.hist-story.untitled {
			color: var(--sp-muted);
			font-weight: 400;
			font-style: italic;
		}
		.hist-meta {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			align-items: center;
			font-size: 0.85rem;
			color: var(--sp-muted);
		}
		.hist-chip {
			background: var(--sp-chip-bg);
			color: var(--sp-surface-text);
			border-radius: 6px;
			padding: 2px 8px;
			font-weight: 700;
		}
		.hist-when {
			margin-left: auto;
			white-space: nowrap;
		}

		/* Ticket queue */
		.queue-row {
			grid-template-columns: 24px 1fr 30px;
			display: grid;
			align-items: center;
			gap: 8px;
		}
		.queue-pos {
			color: var(--sp-muted);
			font-size: 0.8rem;
			font-weight: 700;
			text-align: right;
		}
		.queue-text {
			overflow-wrap: anywhere;
		}
		.queue-remove {
			border: none;
			background: none;
			color: var(--sp-muted);
			cursor: pointer;
			border-radius: 6px;
			padding: 4px 8px;
		}
		.queue-remove:hover {
			background: var(--sp-error-bg);
			color: var(--sp-error-text);
		}
		.queue-add {
			width: 100%;
			padding: 10px;
			border: 1px solid var(--sp-border);
			border-radius: 10px;
			font: inherit;
			resize: vertical;
		}
		.btn.small {
			padding: 6px 12px;
			font-size: 0.85rem;
		}
		a.btn {
			text-decoration: none;
			color: inherit;
			display: inline-flex;
			align-items: center;
		}
		`,
	];

	render() {
		const s = this.state;
		return html`
			<header>
				<a class="brand" @click=${() => navigate('/')}>🃏 Story Points</a>
				<span class="room-code">${this.roomId}</span>
				<span class="conn">
					${this.statusLabel()}
					<button
						class="mute"
						title=${this.muted ? 'Unmute timer sounds (just for you)' : 'Mute timer sounds (just for you)'}
						@click=${this.toggleMute}
					>
						${this.muted ? '🔇' : this.volume > 0.5 ? '🔊' : '🔉'}
					</button>
					${!this.muted
						? html`<input
								class="vol"
								type="range"
								min="0.05"
								max="1"
								step="0.05"
								title="Chime volume (just for you)"
								.value=${String(this.volume)}
								@input=${(e: InputEvent) => {
									this.volume = Number((e.target as HTMLInputElement).value);
									setVolume(this.volume);
								}}
								@change=${() => chime.amber()}
							/>`
						: nothing}
				</span>
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
								<button class="btn primary" title=${s.queue?.[0] ?? ''} @click=${this.nextTicket}>
									Next ticket →
								</button>
								<button class="btn" @click=${this.revote}>Re-vote</button>
							`
						: html`
								<button class="btn primary" @click=${() => this.conn?.send({ type: 'reveal' })}>Show votes</button>
								<button class="btn" @click=${this.revote}>Re-vote</button>
							`}
					<span class="spacer"></span>
					<span
						class="timer ${this.timerMood(s)} ${this.timerWobble ? 'wobble' : ''}"
						style="font-size:${1 + this.rabbitCount(s) * 0.16}rem"
					>
						${Array.from(
							{ length: this.rabbitCount(s) },
							(_, i) => html`<span class="bun" style="animation-delay:${i * 120}ms">🐇</span>`,
						)}
						${s.revealedAt !== null ? '⏸' : '⏱'} ${this.formatElapsed()}
					</span>
				</div>
			</div>

			${s.settings.ticketQueue !== false ? this.renderQueue(s) : nothing}

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
										${me?.isOwner && p.id !== s.you
											? html`<button
													class="make-host"
													title="Make ${p.name} the host"
													@click=${() => this.conn?.send({ type: 'transferHost', to: p.id })}
												>
													👑 make host
												</button>`
											: nothing}
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
			${s.settings.keepHistory !== false && s.history?.length ? this.renderHistory(s) : nothing}

			<div class="reactions" title="React — 🐇 = we're going down a rabbit hole">
				${[...REACTION_EMOJI, ...(THEME_REACTIONS[s.theme] ?? [])].map(
					(e) => html`<button class="react" @click=${() => this.sendReaction(e)}>${e}</button>`,
				)}
			</div>

			<div class="panel">
				<label class="field">Invite your team</label>
				<div class="invite">
					<code>${location.href}</code>
					<button class="btn ${this.copied ? 'copied' : ''}" @click=${this.copyLink}>
						${this.copied ? 'Copied ✓' : 'Copy link'}
					</button>
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
				<button class="btn quiet" style="color:var(--sp-danger-soft)" @click=${this.leave}>Leave room</button>
			</div>

			${this.showSettings && isOwner
				? html`<points-settings
						.settings=${s.settings}
						.historyCount=${s.history?.length ?? 0}
						@save=${(e: CustomEvent) => {
							this.conn?.send({ type: 'settings', settings: e.detail });
							this.showSettings = false;
						}}
						@clear-history=${() => this.conn?.send({ type: 'clearHistory' })}
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
				${this.renderDistribution(s, votes)}
			</div>
		`;
	}

	/** Bar per deck value that got votes — only when the vote actually spread. */
	private renderDistribution(s: RoomStateView, votes: string[]) {
		const counts = new Map<string, number>();
		for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
		if (counts.size < 2) return nothing;
		const rows = s.settings.deck.filter((c) => counts.has(c.value));
		const max = Math.max(...rows.map((c) => counts.get(c.value)!));
		return html`
			<div class="dist">
				${rows.map((c) => {
					const n = counts.get(c.value)!;
					return html`
						<div class="dist-row">
							<span class="dist-label">${c.label}</span>
							<div class="dist-track">
								<div class="dist-fill" style="width:${(n / max) * 100}%"></div>
							</div>
							<span class="dist-count">${n}</span>
						</div>
					`;
				})}
			</div>
		`;
	}

	private renderQueue(s: RoomStateView) {
		const queue = s.queue ?? [];
		return html`
			<div class="panel">
				<details class="hist-details">
					<summary>🗂 Up next (${queue.length})</summary>
					<div class="hist">
						${queue.map(
							(item, i) => html`
								<div class="hist-row queue-row">
									<span class="queue-pos">${i + 1}</span>
									<span class="queue-text">${item}</span>
									<button
										class="queue-remove"
										title="Remove from queue"
										@click=${() => this.setQueue(queue.filter((_, j) => j !== i))}
									>
										✕
									</button>
								</div>
							`,
						)}
						<textarea
							class="queue-add"
							rows="3"
							placeholder="Add tickets — one per line"
							.value=${this.queueDraft}
							@input=${(e: InputEvent) => (this.queueDraft = (e.target as HTMLTextAreaElement).value)}
						></textarea>
						<div class="toolbar">
							<button class="btn" ?disabled=${!this.queueDraft.trim()} @click=${this.addToQueue}>
								Add to queue
							</button>
						</div>
					</div>
				</details>
			</div>
		`;
	}

	private setQueue(items: string[]): void {
		this.conn?.send({ type: 'queue', items });
	}

	private addToQueue = (): void => {
		const items = this.queueDraft.split('\n').map((l) => l.trim()).filter(Boolean);
		if (items.length === 0) return;
		this.setQueue([...(this.state?.queue ?? []), ...items]);
		this.queueDraft = '';
	};

	private renderHistory(s: RoomStateView) {
		return html`
			<div class="panel">
				<details class="hist-details">
					<summary>📜 Round history (${s.history.length})</summary>
					<div class="toolbar" style="margin-top:10px">
						<button class="btn small" @click=${() => this.copyExport('md')}>
							${this.copiedExport === 'md' ? 'Copied ✓' : 'Copy Markdown'}
						</button>
						<button class="btn small" @click=${() => this.copyExport('csv')}>
							${this.copiedExport === 'csv' ? 'Copied ✓' : 'Copy CSV'}
						</button>
						<a class="btn small" href="/api/room/${this.roomId}/export" download>Download JSON</a>
						<a class="btn small" href="/api/room/${this.roomId}/export?format=csv" download>Download CSV</a>
					</div>
					<div class="hist">
						${s.history.map(
							(r) => html`
								<div class="hist-row">
									<span class="hist-story ${r.story ? '' : 'untitled'}">${r.story || 'Untitled round'}</span>
									<div class="hist-meta">
										${r.votes.map((v) => html`<span class="hist-chip">${v.label}${v.count > 1 ? ` ×${v.count}` : ''}</span>`)}
										<span>⏱ ${this.formatDuration(r.durationMs)}</span>
										<span class="hist-when">${this.timeAgo(r.endedAt)}</span>
									</div>
								</div>
							`,
						)}
					</div>
				</details>
			</div>
		`;
	}

	/** History → clipboard, Markdown table or CSV (mirrors GET /export). */
	private copyExport = async (kind: 'md' | 'csv'): Promise<void> => {
		const history = this.state?.history ?? [];
		let text: string;
		if (kind === 'md') {
			text = [
				'| Story | Votes | Duration |',
				'| --- | --- | --- |',
				...history.map(
					(r) =>
						`| ${(r.story || 'Untitled').replaceAll('|', '\\|')} | ${r.votes
							.map((v) => `${v.label}×${v.count}`)
							.join(', ')} | ${this.formatDuration(r.durationMs)} |`,
				),
			].join('\n');
		} else {
			const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
			text = [
				'story,ended_at,duration_seconds,votes',
				...history.map((r) =>
					[
						esc(r.story),
						new Date(r.endedAt).toISOString(),
						String(Math.round(r.durationMs / 1000)),
						esc(r.votes.map((v) => `${v.label}×${v.count}`).join('; ')),
					].join(','),
				),
			].join('\n');
		}
		await navigator.clipboard.writeText(text);
		this.copiedExport = kind;
		setTimeout(() => (this.copiedExport = null), COPIED_RESET_MS);
	};

	private formatDuration(ms: number): string {
		const total = Math.round(ms / 1000);
		const m = Math.floor(total / 60);
		const sec = total % 60;
		return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(sec).padStart(2, '0')}`;
	}

	private timeAgo(ts: number): string {
		const mins = Math.round((Date.now() - ts) / 60_000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.round(hours / 24)}d ago`;
	}

	private labelFor(s: RoomStateView, value: string): string {
		return s.settings.deck.find((c) => c.value === value)?.label ?? value;
	}

	/** Escalation stage: 0 calm, 1 = >5min, 2 = >10min, … one more per 5 min. */
	private timerStage(s: RoomStateView): number {
		if (s.revealedAt !== null) return 0;
		return [5, 10, 15, 20, 25].filter((min) => this.elapsed > min * 60_000).length;
	}

	/** Timer personality: calm → amber at 5 min → red with hopping rabbits from 10 min. */
	private timerMood(s: RoomStateView): '' | 'amber' | 'rabbit' {
		const stage = this.timerStage(s);
		return stage >= 2 ? 'rabbit' : stage === 1 ? 'amber' : '';
	}

	/** One rabbit at 10 min, another every 5 min after, capped at 4. */
	private rabbitCount(s: RoomStateView): number {
		return Math.min(Math.max(this.timerStage(s) - 1, 0), 4);
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

	private toggleMute = () => {
		this.muted = !this.muted;
		setMuted(this.muted);
	};

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
		// The server pulls the next queued story into place; mirror it locally
		// so a blur-flush of a stale empty draft can't clobber it.
		this.storyDraft = this.state?.queue?.[0] ?? '';
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
		// Prefer the live input value — autofill can set it without input events.
		const live = this.shadowRoot?.querySelector<HTMLInputElement>('.gate input')?.value;
		const name = (live ?? this.nameDraft).trim();
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
		// Leaving frees the seat but keeps the room in "Jump back in" — the
		// room you just left is the one you're most likely to want back.
		touchRecentRoom(this.roomId, this.state?.settings.roomName ?? '');
		navigate('/');
	};

	private copyLink = async () => {
		await navigator.clipboard.writeText(location.href);
		this.copied = true;
		setTimeout(() => (this.copied = false), COPIED_RESET_MS);
	};
}

customElements.define('points-room', RoomPage);
