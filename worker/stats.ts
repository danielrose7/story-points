import { DurableObject } from 'cloudflare:workers';

interface Totals {
	votes: number;
	rounds: number;
	rooms: number;
}

interface PresenceEntry {
	players: number;
	at: number;
}

const TOTALS_KEY = 'totals';
const PRESENCE_KEY = 'presence';
// A room that hasn't reported presence in this long is treated as gone —
// covers rooms that died without sending a final zero (eviction, crash).
const PRESENCE_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Singleton (idFromName('global')) aggregate counters for the home-page
 * stats strip: lifetime votes/rounds/rooms plus "estimating right now"
 * presence. Rooms report fire-and-forget; a lost message costs a count,
 * never a session. GET returns integers only — room slugs are capabilities
 * and never leave this object.
 */
export class Stats extends DurableObject<Env> {
	private totals: Totals | null = null;
	private presence: Record<string, PresenceEntry> | null = null;

	private async load(): Promise<{ totals: Totals; presence: Record<string, PresenceEntry> }> {
		this.totals ??= (await this.ctx.storage.get<Totals>(TOTALS_KEY)) ?? { votes: 0, rounds: 0, rooms: 0 };
		this.presence ??= (await this.ctx.storage.get<Record<string, PresenceEntry>>(PRESENCE_KEY)) ?? {};
		return { totals: this.totals, presence: this.presence };
	}

	async fetch(request: Request): Promise<Response> {
		const { totals, presence } = await this.load();
		const url = new URL(request.url);

		if (request.method === 'POST' && url.pathname === '/bump') {
			const body = (await request.json().catch(() => ({}))) as Partial<Totals>;
			totals.votes += Math.max(0, Math.round(Number(body.votes)) || 0);
			totals.rounds += Math.max(0, Math.round(Number(body.rounds)) || 0);
			totals.rooms += Math.max(0, Math.round(Number(body.rooms)) || 0);
			await this.ctx.storage.put(TOTALS_KEY, totals);
			return new Response(null, { status: 204 });
		}

		if (request.method === 'POST' && url.pathname === '/presence') {
			const body = (await request.json().catch(() => ({}))) as { room?: string; players?: number };
			const room = String(body.room ?? '').slice(0, 64);
			const players = Math.max(0, Math.round(Number(body.players)) || 0);
			if (!room) return new Response(null, { status: 400 });
			if (players === 0) {
				delete presence[room];
			} else {
				presence[room] = { players, at: Date.now() };
			}
			await this.ctx.storage.put(PRESENCE_KEY, presence);
			// Stale eviction keeps "right now" honest even if a room never
			// says goodbye. One standing alarm is plenty.
			if ((await this.ctx.storage.getAlarm()) === null && Object.keys(presence).length > 0) {
				await this.ctx.storage.setAlarm(Date.now() + PRESENCE_TTL_MS);
			}
			return new Response(null, { status: 204 });
		}

		// GET / — the public snapshot: counts only, never slugs.
		const cutoff = Date.now() - PRESENCE_TTL_MS;
		const live = Object.values(presence).filter((p) => p.at >= cutoff);
		return Response.json({
			votes: totals.votes,
			rounds: totals.rounds,
			rooms: totals.rooms,
			liveRooms: live.length,
			livePlayers: live.reduce((n, p) => n + p.players, 0),
		});
	}

	async alarm(): Promise<void> {
		const { presence } = await this.load();
		const cutoff = Date.now() - PRESENCE_TTL_MS;
		for (const [room, p] of Object.entries(presence)) {
			if (p.at < cutoff) delete presence[room];
		}
		await this.ctx.storage.put(PRESENCE_KEY, presence);
		if (Object.keys(presence).length > 0) {
			await this.ctx.storage.setAlarm(Date.now() + PRESENCE_TTL_MS);
		}
	}
}
