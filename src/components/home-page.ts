import { LitElement, html, css } from 'lit';
import { baseStyles } from './base-styles';
import { generateRoomSlug } from '../slug';
import { navigate } from '../main';

class HomePage extends LitElement {
	static properties = {
		joinCode: { state: true },
		lostPath: { attribute: false },
		lostRoomExists: { state: true },
	};

	joinCode = '';
	lostPath = '';
	lostRoomExists: boolean | null = null;

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
				.then((r) => r.json() as Promise<{ exists: boolean }>)
				.then(({ exists }) => (this.lostRoomExists = exists))
				.catch(() => (this.lostRoomExists = false));
		}
	}

	static styles = [
		baseStyles,
		css`
		:host {
			display: grid;
			place-items: center;
			min-height: 100vh;
			padding: 24px;
		}
		.stack {
			display: grid;
			gap: 16px;
			max-width: 460px;
			width: 100%;
		}
		.panel.lost {
			background: #fff8e6;
			border: 2px dashed var(--ap-accent);
		}
		.lost-code {
			font-size: 2.6rem;
			font-weight: 900;
			letter-spacing: 0.1em;
		}
		.lost-msg code {
			background: rgba(0, 0, 0, 0.07);
			padding: 2px 8px;
			border-radius: 6px;
			word-break: break-all;
		}
		.lost-hint {
			color: var(--ap-muted);
			margin: 6px 0 14px;
		}
		.panel {
			background: var(--ap-surface);
			color: var(--ap-surface-text);
			border-radius: var(--ap-radius);
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
			color: var(--ap-muted);
			margin: 0 0 28px;
		}
		button.primary {
			width: 100%;
			padding: 14px;
			font-size: 1.1rem;
			font-weight: 700;
			border: none;
			border-radius: 10px;
			background: var(--ap-accent);
			color: var(--ap-accent-text);
			cursor: pointer;
			transition: transform 0.1s ease;
		}
		button.primary:hover {
			transform: translateY(-2px);
		}
		.divider {
			margin: 24px 0 16px;
			color: var(--ap-muted);
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
			padding: 12px;
			border: 1px solid #ccd6d0;
			border-radius: 10px;
			font-size: 1rem;
		}
		form button {
			padding: 12px 18px;
			border: 1px solid #ccd6d0;
			background: #f4f7f5;
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
				<h1>🃏 Agile Points</h1>
				<p class="tagline">Estimate together, in realtime.</p>
				<button class="primary" @click=${this.createRoom}>Create a room</button>
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
			</div>
		`;
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
		navigate(`/room/${generateRoomSlug()}`);
	};

	private joinRoom = (e: SubmitEvent) => {
		e.preventDefault();
		const code = this.joinCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
		if (code) navigate(`/room/${code}`);
	};
}

customElements.define('points-home', HomePage);
