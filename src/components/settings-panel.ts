import { LitElement, html, css } from 'lit';
import { baseStyles } from './base-styles';
import type { DeckCard, RoomSettings } from '../../shared/types';
import { DECK_PRESETS, THEMES } from '../../shared/types';

/** Owner-only settings editor. Edits a local draft; emits `save` with the result. */
class SettingsPanel extends LitElement {
	static properties = {
		settings: { attribute: false },
		draft: { state: true },
	};

	settings: RoomSettings | null = null;
	draft: RoomSettings | null = null;

	willUpdate(changed: Map<string, unknown>): void {
		if (changed.has('settings') && this.settings && !this.draft) {
			this.draft = structuredClone(this.settings);
		}
	}

	static styles = [
		baseStyles,
		css`
		:host {
			display: block;
		}
		.panel {
			background: var(--ap-surface);
			color: var(--ap-surface-text);
			border-radius: var(--ap-radius);
			padding: 22px;
			box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
			margin-top: 18px;
		}
		h3 {
			margin: 0 0 16px;
		}
		label.field {
			display: block;
			font-size: 0.8rem;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--ap-muted);
			margin: 16px 0 6px;
		}
		input[type='text'] {
			padding: 9px 10px;
			border: 1px solid var(--ap-border);
			border-radius: 8px;
			font: inherit;
		}
		.room-name {
			width: 100%;
		}
		.presets {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}
		.row {
			display: grid;
			grid-template-columns: 1fr 1fr 38px 38px 38px;
			gap: 8px;
			align-items: center;
			margin-bottom: 8px;
		}
		.row input {
			min-width: 0;
		}
		.row.head {
			margin-bottom: 4px;
			font-size: 0.78rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--ap-muted);
		}
		.row button {
			border: 1px solid var(--ap-border);
			background: var(--ap-btn-bg);
			border-radius: 8px;
			padding: 8px 10px;
			cursor: pointer;
		}
		.btn {
			padding: 10px 16px;
			border-radius: 10px;
			border: 1px solid var(--ap-border);
			background: var(--ap-btn-bg);
			font-weight: 600;
			cursor: pointer;
		}
		.btn.primary {
			background: var(--ap-accent);
			border-color: var(--ap-accent);
			color: var(--ap-accent-text);
		}
		.actions {
			display: flex;
			gap: 10px;
			margin-top: 18px;
		}
		.check {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-top: 14px;
		}
		`,
	];

	render() {
		const d = this.draft;
		if (!d) return html``;
		return html`
			<div class="panel">
				<h3>Room settings</h3>

				<label class="field">Room name</label>
				<input
					type="text"
					class="room-name"
					placeholder="e.g. Plantiful web team"
					.value=${d.roomName}
					@input=${(e: InputEvent) => this.patch({ roomName: (e.target as HTMLInputElement).value })}
				/>

				<label class="field">Point values</label>
				<div class="presets">
					${Object.entries(DECK_PRESETS).map(
						([key, deck]) => html`
							<button class="btn" @click=${() => this.patch({ deck: deck.map((c) => ({ ...c })) })}>
								${key === 'fibonacci' ? 'Fibonacci' : key === 'tshirt' ? 'T-shirt' : 'Powers of 2'}
							</button>
						`,
					)}
				</div>
				<div style="margin-top:12px">
					<div class="row head">
						<span>Label</span>
						<span>Value</span>
					</div>
					${d.deck.map(
						(card, i) => html`
							<div class="row">
								<input
									type="text"
									placeholder="Label"
									.value=${card.label}
									@input=${(e: InputEvent) => this.patchCard(i, { label: (e.target as HTMLInputElement).value })}
								/>
								<input
									type="text"
									placeholder="Value"
									.value=${card.value}
									@input=${(e: InputEvent) => this.patchCard(i, { value: (e.target as HTMLInputElement).value })}
								/>
								<button title="Move up" ?disabled=${i === 0} @click=${() => this.moveCard(i, -1)}>⬆︎</button>
								<button title="Move down" ?disabled=${i === d.deck.length - 1} @click=${() => this.moveCard(i, 1)}>⬇︎</button>
								<button title="Remove" @click=${() => this.removeCard(i)}>✕</button>
							</div>
						`,
					)}
					<button class="btn" @click=${this.addCard}>+ Add value</button>
				</div>

				<label class="field">Theme</label>
				<div class="presets">
					${THEMES.map(
						(t) => html`
							<button class="btn ${d.theme === t.id ? 'primary' : ''}" @click=${() => this.patch({ theme: t.id })}>
								${t.label}
							</button>
						`,
					)}
				</div>

				<label class="check">
					<input
						type="checkbox"
						.checked=${d.autoReveal}
						@change=${(e: Event) => this.patch({ autoReveal: (e.target as HTMLInputElement).checked })}
					/>
					Reveal automatically when everyone has voted
				</label>

				<label class="check">
					<input
						type="checkbox"
						.checked=${d.timerSounds ?? true}
						@change=${(e: Event) => this.patch({ timerSounds: (e.target as HTMLInputElement).checked })}
					/>
					Timer chimes at 5 &amp; 10 minutes (room-wide; anyone can mute for themselves)
				</label>

				<div class="actions">
					<button class="btn primary" @click=${this.save}>Save settings</button>
					<button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>Cancel</button>
				</div>
			</div>
		`;
	}

	private patch(partial: Partial<RoomSettings>): void {
		if (this.draft) this.draft = { ...this.draft, ...partial };
	}

	private patchCard(i: number, partial: Partial<DeckCard>): void {
		if (!this.draft) return;
		const deck = this.draft.deck.map((c, j) => (j === i ? { ...c, ...partial } : c));
		this.draft = { ...this.draft, deck };
	}

	private moveCard(i: number, delta: number): void {
		if (!this.draft) return;
		const deck = [...this.draft.deck];
		const j = i + delta;
		if (j < 0 || j >= deck.length) return;
		[deck[i], deck[j]] = [deck[j], deck[i]];
		this.draft = { ...this.draft, deck };
	}

	private removeCard(i: number): void {
		if (!this.draft) return;
		this.draft = { ...this.draft, deck: this.draft.deck.filter((_, j) => j !== i) };
	}

	private addCard = (): void => {
		if (!this.draft) return;
		this.draft = { ...this.draft, deck: [...this.draft.deck, { label: '', value: '' }] };
	};

	private save = (): void => {
		if (!this.draft) return;
		const deck = this.draft.deck
			.map((c) => ({ label: c.label.trim(), value: c.value.trim() }))
			.filter((c) => c.label && c.value);
		this.dispatchEvent(new CustomEvent('save', { detail: { ...this.draft, deck } }));
	};
}

customElements.define('points-settings', SettingsPanel);
