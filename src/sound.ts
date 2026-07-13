const MUTE_KEY = 'ap:muted';
const VOLUME_KEY = 'ap:volume';
const DEFAULT_VOLUME = 0.7;
/** Gain at volume=1. Applied on a squared curve so the top end gets loud
 *  while the low end keeps fine control. */
const MAX_GAIN = 0.4;

export function isMuted(): boolean {
	return localStorage.getItem(MUTE_KEY) === '1';
}

export function setMuted(muted: boolean): void {
	localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

/** Personal chime volume, 0..1. */
export function getVolume(): number {
	const v = Number(localStorage.getItem(VOLUME_KEY));
	return Number.isFinite(v) && v > 0 ? Math.min(v, 1) : DEFAULT_VOLUME;
}

export function setVolume(v: number): void {
	localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(v, 1))));
}

/**
 * Tiny Web Audio chime generator — no audio assets. Browsers block audio
 * until a user gesture, so we lazily create/resume the context on first use
 * and pre-unlock on the first pointer interaction.
 */
class Chime {
	private ctx: AudioContext | null = null;

	constructor() {
		document.addEventListener('pointerdown', () => this.ensure(), { once: true });
	}

	private ensure(): AudioContext | null {
		try {
			this.ctx ??= new AudioContext();
			if (this.ctx.state === 'suspended') void this.ctx.resume();
			return this.ctx;
		} catch {
			return null;
		}
	}

	private beep(freq: number, at: number, duration = 0.14): void {
		const ctx = this.ensure();
		if (!ctx || ctx.state !== 'running') return;
		const volume = MAX_GAIN * getVolume() ** 2;
		if (volume <= 0) return;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.value = freq;
		const t = ctx.currentTime + at;
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(volume, t + 0.015);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		osc.connect(gain).connect(ctx.destination);
		osc.start(t);
		osc.stop(t + duration + 0.05);
	}

	/** 5-minute mark: one gentle mid tone. */
	amber(): void {
		this.beep(660, 0);
	}

	/** 10-minute mark: two slightly urgent higher tones. */
	rabbit(): void {
		this.beep(880, 0);
		this.beep(880, 0.22);
	}
}

export const chime = new Chime();
