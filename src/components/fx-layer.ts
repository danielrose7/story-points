import { LitElement, html, css } from 'lit';

export type CelebrationKind = 'consensus' | 'split' | 'allq';

/** Draws every animation from a pool before any repeats (shuffle bag). */
class ShuffleBag<T> {
	private bag: T[] = [];
	constructor(private items: T[]) {}
	draw(): T {
		if (this.bag.length === 0) {
			this.bag = [...this.items];
			for (let i = this.bag.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
			}
		}
		return this.bag.pop() as T;
	}
}

const RARE_DROP_CHANCE = 0.02;
const RABBIT_PILE_COUNT = 3;
const RABBIT_PILE_WINDOW_MS = 60_000;
const RABBIT_TOAST_COOLDOWN_MS = 120_000;

/**
 * Full-screen, pointer-transparent overlay for ephemeral effects: floating
 * emoji reactions and reveal celebrations. Imperative API — the room page
 * calls spawnReaction()/celebrate(); nothing here touches room state.
 */
class FxLayer extends LitElement {
	private rabbitTimes: number[] = [];
	private lastRabbitToast = 0;
	private lastReact: { emoji: string; name: string; time: number } | null = null;
	private bags: Record<CelebrationKind, ShuffleBag<string>> = {
		consensus: new ShuffleBag(['confetti', 'rocket', 'chart', 'jackpot']),
		split: new ShuffleBag(['scratch', 'bell']),
		allq: new ShuffleBag(['coffee', 'shrug']),
	};

	static styles = css`
		:host {
			position: fixed;
			inset: 0;
			pointer-events: none;
			z-index: 1000;
			overflow: hidden;
		}
		.float {
			position: absolute;
			bottom: 80px;
			font-size: 2.2rem;
			animation: float-up 2.6s ease-out forwards;
			text-align: center;
		}
		.float .who,
		.hopper .who {
			display: block;
			font-size: 0.65rem;
			font-family: var(--ap-font);
			color: var(--ap-toast-text);
			text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
			margin-top: -4px;
		}
		@keyframes float-up {
			0% {
				transform: translateY(0) scale(0.6);
				opacity: 0;
			}
			12% {
				opacity: 1;
				transform: translateY(-30px) scale(1.15);
			}
			100% {
				transform: translateY(-46vh) translateX(var(--drift, 0px)) scale(1);
				opacity: 0;
			}
		}
		.hopper {
			position: absolute;
			bottom: 12px;
			left: -60px;
			font-size: 2.4rem;
			animation: hop-across 3.4s linear forwards;
		}
		@keyframes hop-across {
			0% {
				transform: translateX(0) translateY(0);
			}
			100% {
				transform: translateX(calc(100vw + 120px)) translateY(0);
			}
		}
		.hopper .inner {
			display: inline-block;
			animation: hop 0.42s ease-in-out infinite alternate;
		}
		@keyframes hop {
			from {
				transform: translateY(0) rotate(-4deg);
			}
			to {
				transform: translateY(-26px) rotate(4deg);
			}
		}
		.toast {
			position: absolute;
			top: 18px;
			left: 50%;
			transform: translateX(-50%);
			background: var(--ap-toast-bg);
			color: var(--ap-toast-text);
			font-family: var(--ap-font);
			font-weight: 600;
			padding: 12px 20px;
			border-radius: 999px;
			box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
			animation: toast-in-out 5s ease forwards;
			white-space: nowrap;
		}
		@keyframes toast-in-out {
			0% {
				opacity: 0;
				transform: translateX(-50%) translateY(-20px);
			}
			8%,
			88% {
				opacity: 1;
				transform: translateX(-50%) translateY(0);
			}
			100% {
				opacity: 0;
				transform: translateX(-50%) translateY(-20px);
			}
		}

		.collide {
			position: absolute;
			top: 42%;
			font-size: 3rem;
		}
		.collide.l {
			left: 18%;
			animation: collide-l 0.55s ease-in forwards;
		}
		.collide.r {
			right: 18%;
			animation: collide-r 0.55s ease-in forwards;
		}
		@keyframes collide-l {
			to {
				transform: translateX(calc(32vw - 50%));
				opacity: 0;
			}
		}
		@keyframes collide-r {
			to {
				transform: translateX(calc(-32vw + 50%));
				opacity: 0;
			}
		}
		.boom {
			position: absolute;
			top: 40%;
			left: 50%;
			font-size: 4rem;
			transform: translateX(-50%);
			animation: pop-in 0.4s 0.5s cubic-bezier(0.2, 2, 0.4, 1) both, fade-late 1.4s forwards;
		}

		/* Celebrations */
		.confetti {
			position: absolute;
			top: -16px;
			width: 10px;
			height: 16px;
			animation: confetti-fall var(--dur, 2.8s) ease-in var(--delay, 0s) forwards;
		}
		@keyframes confetti-fall {
			0% {
				transform: translateY(0) rotate(0deg);
				opacity: 1;
			}
			100% {
				transform: translateY(105vh) rotate(var(--spin, 540deg)) translateX(var(--sway, 40px));
				opacity: 0.9;
			}
		}
		.rocket {
			position: absolute;
			bottom: -70px;
			left: 8vw;
			font-size: 4rem;
			animation: rocket-fly 2.2s cubic-bezier(0.3, 0, 0.6, 1) forwards;
		}
		@keyframes rocket-fly {
			0% {
				transform: translate(0, 0) rotate(0deg) scale(0.8);
				opacity: 1;
			}
			100% {
				transform: translate(85vw, -110vh) rotate(8deg) scale(1.2);
				opacity: 1;
			}
		}
		.puff {
			position: absolute;
			font-size: 1.6rem;
			animation: puff-fade 1.6s ease-out var(--delay, 0s) forwards;
			opacity: 0;
		}
		@keyframes puff-fade {
			0% {
				opacity: 0;
				transform: scale(0.4);
			}
			20% {
				opacity: 0.9;
			}
			100% {
				opacity: 0;
				transform: scale(1.6) translateY(10px);
			}
		}
		.chart {
			position: absolute;
			inset: 0;
			display: grid;
			place-items: center;
		}
		.chart svg {
			width: min(70vw, 520px);
			height: auto;
			filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.35));
		}
		.chart polyline {
			fill: none;
			stroke: var(--ap-fx-line);
			stroke-width: 6;
			stroke-linecap: round;
			stroke-linejoin: round;
			stroke-dasharray: 600;
			stroke-dashoffset: 600;
			animation: draw-line 1.4s ease-out forwards;
		}
		@keyframes draw-line {
			to {
				stroke-dashoffset: 0;
			}
		}
		.chart .payoff {
			position: absolute;
			font-size: 3rem;
			animation: pop-in 0.5s 1.3s cubic-bezier(0.2, 2, 0.4, 1) both;
		}
		.big-text {
			position: absolute;
			inset: 0;
			display: grid;
			place-items: center;
			font-family: var(--ap-font);
			font-size: clamp(2rem, 7vw, 4.5rem);
			font-weight: 900;
			color: var(--ap-fx-gold);
			-webkit-text-stroke: 2px var(--ap-fx-gold-stroke);
			text-align: center;
			animation: pop-in 0.5s cubic-bezier(0.2, 2, 0.4, 1) both, fade-late 2.6s forwards;
		}
		@keyframes pop-in {
			from {
				transform: scale(0.2);
				opacity: 0;
			}
			to {
				transform: scale(1);
				opacity: 1;
			}
		}
		@keyframes fade-late {
			0%,
			80% {
				opacity: 1;
			}
			100% {
				opacity: 0;
			}
		}
		:host(.shake) {
			animation: fx-shake 0.5s linear;
		}
		@keyframes fx-shake {
			0%, 100% { transform: translateX(0); }
			20% { transform: translateX(-14px) rotate(-0.5deg); }
			40% { transform: translateX(12px) rotate(0.4deg); }
			60% { transform: translateX(-8px); }
			80% { transform: translateX(6px); }
		}
		.faller {
			position: absolute;
			top: -50px;
			font-size: 2rem;
			animation: confetti-fall var(--dur, 3s) ease-in var(--delay, 0s) forwards;
		}
		.trex {
			position: absolute;
			bottom: 8px;
			left: -90px;
			font-size: 4.5rem;
			animation: trex-walk 6s linear forwards;
		}
		@keyframes trex-walk {
			0% {
				transform: translateX(0) scaleX(-1);
			}
			100% {
				transform: translateX(calc(100vw + 200px)) scaleX(-1);
			}
		}
		.trex .inner {
			display: inline-block;
			animation: stomp 0.5s ease-in-out infinite alternate;
		}
		@keyframes stomp {
			from {
				transform: translateY(0) rotate(-2deg);
			}
			to {
				transform: translateY(-8px) rotate(2deg);
			}
		}
	`;

	render() {
		return html``;
	}

	// ---------- reactions ----------

	spawnReaction(emoji: string, name: string): void {
		if (emoji === '🐇') return this.spawnRabbit(name);
		const el = document.createElement('span');
		el.className = 'float';
		el.style.left = `${8 + Math.random() * 84}%`;
		el.style.setProperty('--drift', `${Math.round(Math.random() * 80 - 40)}px`);
		el.innerHTML = `${emoji}<span class="who"></span>`;
		(el.querySelector('.who') as HTMLElement).textContent = name;
		this.addTemp(el, 2700);

		// FigJam-style "high five": two people, same emoji, within 2s → collision.
		const now = Date.now();
		if (this.lastReact && this.lastReact.emoji === emoji && this.lastReact.name !== name && now - this.lastReact.time < 2000) {
			this.lastReact = null;
			this.highFive(emoji);
		} else {
			this.lastReact = { emoji, name, time: now };
		}
	}

	private highFive(emoji: string): void {
		for (const side of ['l', 'r'] as const) {
			const el = document.createElement('span');
			el.className = `collide ${side}`;
			el.textContent = emoji;
			this.addTemp(el, 900);
		}
		const boom = document.createElement('span');
		boom.className = 'boom';
		boom.textContent = '💥';
		this.addTemp(boom, 1500);
	}

	/** Easter egg: the story box said YOLO. */
	flames(): void {
		this.rain(['🔥', '🔥', '✨']);
		this.toast('🔥 YOLO estimation detected');
	}

	private spawnRabbit(name: string): void {
		const el = document.createElement('span');
		el.className = 'hopper';
		el.innerHTML = `<span class="inner">🐇</span><span class="who"></span>`;
		(el.querySelector('.who') as HTMLElement).textContent = name;
		this.addTemp(el, 3500);

		const now = Date.now();
		this.rabbitTimes = this.rabbitTimes.filter((t) => now - t < RABBIT_PILE_WINDOW_MS);
		this.rabbitTimes.push(now);
		if (this.rabbitTimes.length >= RABBIT_PILE_COUNT && now - this.lastRabbitToast > RABBIT_TOAST_COOLDOWN_MS) {
			this.lastRabbitToast = now;
			this.rabbitTimes = [];
			this.toast('🐇🕳️ Side quest detected — park it and move on?');
		}
	}

	toast(message: string): void {
		const el = document.createElement('div');
		el.className = 'toast';
		el.textContent = message;
		this.addTemp(el, 5200);
	}

	// ---------- celebrations ----------

	celebrate(kind: CelebrationKind, detail?: { min?: string; max?: string }): void {
		if (Math.random() < RARE_DROP_CHANCE) return this.trex();
		const pick = this.bags[kind].draw();
		switch (pick) {
			case 'confetti':
				return this.confetti();
			case 'rocket':
				return this.rocket();
			case 'chart':
				return this.chart();
			case 'jackpot':
				return this.bigText('🎰 JACKPOT! 🎰');
			case 'scratch':
				return this.shakeText(`${detail?.min ?? '?'} vs ${detail?.max ?? '?'}?! 💿⏸️`);
			case 'bell':
				return this.shakeText(`🥊 ${detail?.min ?? '?'} vs ${detail?.max ?? '?'} — DING DING! 🛎️`);
			case 'coffee':
				return this.rain(['☕', '☕', '☕', '🫖']);
			case 'shrug':
				return this.bigText('🤷 404: estimate not found');
		}
	}

	private confetti(): void {
		const colors = getComputedStyle(this)
			.getPropertyValue('--ap-confetti')
			.split(',')
			.map((c) => c.trim())
			.filter(Boolean);
		for (let i = 0; i < 60; i++) {
			const el = document.createElement('span');
			el.className = 'confetti';
			el.style.left = `${Math.random() * 100}%`;
			el.style.background = colors[i % colors.length];
			el.style.setProperty('--dur', `${2 + Math.random() * 1.8}s`);
			el.style.setProperty('--delay', `${Math.random() * 0.6}s`);
			el.style.setProperty('--spin', `${360 + Math.random() * 540}deg`);
			el.style.setProperty('--sway', `${Math.random() * 120 - 60}px`);
			this.addTemp(el, 4800);
		}
	}

	private rocket(): void {
		const rocket = document.createElement('span');
		rocket.className = 'rocket';
		rocket.textContent = '🚀';
		this.addTemp(rocket, 2400);
		for (let i = 0; i < 6; i++) {
			const puff = document.createElement('span');
			puff.className = 'puff';
			puff.textContent = '💨';
			puff.style.left = `${6 + i * 13}vw`;
			puff.style.bottom = `${i * 15}vh`;
			puff.style.setProperty('--delay', `${i * 0.25}s`);
			this.addTemp(puff, 2600);
		}
	}

	private chart(): void {
		const wrap = document.createElement('div');
		wrap.className = 'chart';
		wrap.innerHTML = `
			<svg viewBox="0 0 400 240">
				<polyline points="20,220 90,190 150,205 230,120 290,140 380,30"></polyline>
			</svg>
			<span class="payoff">📈 To the moon!</span>
		`;
		this.addTemp(wrap, 3200);
	}

	private bigText(text: string): void {
		const el = document.createElement('div');
		el.className = 'big-text';
		el.textContent = text;
		this.addTemp(el, 2700);
	}

	private shakeText(text: string): void {
		this.classList.add('shake');
		setTimeout(() => this.classList.remove('shake'), 600);
		this.bigText(text);
	}

	private rain(emoji: string[]): void {
		for (let i = 0; i < 24; i++) {
			const el = document.createElement('span');
			el.className = 'faller';
			el.textContent = emoji[i % emoji.length];
			el.style.left = `${Math.random() * 100}%`;
			el.style.setProperty('--dur', `${2.2 + Math.random() * 1.6}s`);
			el.style.setProperty('--delay', `${Math.random() * 0.8}s`);
			this.addTemp(el, 5000);
		}
	}

	private trex(): void {
		const el = document.createElement('span');
		el.className = 'trex';
		el.innerHTML = `<span class="inner">🦖</span>`;
		this.addTemp(el, 6200);
	}

	private addTemp(el: HTMLElement, lifetimeMs: number): void {
		this.shadowRoot?.appendChild(el);
		setTimeout(() => el.remove(), lifetimeMs);
	}
}

customElements.define('points-fx', FxLayer);
