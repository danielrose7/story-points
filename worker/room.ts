import { DurableObject } from 'cloudflare:workers';
import type {
	ClientMessage,
	ParticipantView,
	Role,
	RoomSettings,
	RoomStateView,
	RoundRecord,
	ServerMessage,
} from '../shared/types';
import { ALL_REACTION_EMOJI, defaultSettings, seasonalTheme, THEMES } from '../shared/types';
import type { ThemeChoice, ThemeId } from '../shared/types';

/** 'seasonal' rooms follow the calendar; resolved fresh on every view. */
function resolveTheme(choice: ThemeChoice): ThemeId {
	return choice === 'seasonal' ? seasonalTheme(new Date()) : choice;
}

interface Participant {
	name: string;
	role: Role;
	lastSeen: number;
	joinedAt: number;
}

interface PersistedRoom {
	settings: RoomSettings;
	story: string;
	revealed: boolean;
	revealedAt: number | null;
	roundStartedAt: number;
	/** finished rounds, newest first (may be undefined in pre-history rooms) */
	history?: RoundRecord[];
	/** stories waiting their turn (may be undefined in pre-queue rooms) */
	queue?: string[];
	/** epoch ms when the running countdown auto-reveals; null/undefined = none */
	countdownEndsAt?: number | null;
	/** current host */
	ownerId: string | null;
	/** who reclaims the host role on return (first joiner, or explicit transferee) */
	founderId: string | null;
	participants: Record<string, Participant>;
	votes: Record<string, string>;
}

const ROOM_KEY = 'room';
// Seats older than this with no live socket are pruned from the persisted map.
// Generous so a room reused every ~2 weeks keeps everyone's name and role.
const SEAT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
// Finished rounds kept per room — plenty for a session or three of lookback.
const MAX_HISTORY = 50;
// A room untouched for this long (no writes, no live sockets) deletes itself
// via the alarm below. Longer than SEAT_TTL so reusable rooms never vanish
// while anyone's seat is still worth keeping.
const IDLE_TTL_MS = 120 * 24 * 60 * 60 * 1000;
// Ticket-queue bounds — enough for a hefty backlog-refinement session.
const MAX_QUEUE_ITEMS = 100;
const MAX_QUEUE_ITEM_LEN = 500;

/** Trim, drop empties, cap counts — shared by the WS message and POST /queue. */
function sanitizeQueue(items: unknown): string[] {
	return (Array.isArray(items) ? items : [])
		.map((s) => String(s ?? '').trim().slice(0, MAX_QUEUE_ITEM_LEN))
		.filter(Boolean)
		.slice(0, MAX_QUEUE_ITEMS);
}

export class Room extends DurableObject<Env> {
	private room: PersistedRoom | null = null;

	private async load(): Promise<PersistedRoom> {
		if (!this.room) {
			this.room =
				(await this.ctx.storage.get<PersistedRoom>(ROOM_KEY)) ?? {
					// Fresh rooms default to theme 'seasonal' — it tracks the
					// calendar until the host pins one in settings.
					settings: defaultSettings(),
					story: '',
					revealed: false,
					revealedAt: null,
					roundStartedAt: Date.now(),
					ownerId: null,
					founderId: null,
					participants: {},
					votes: {},
				};
		}
		return this.room;
	}

	private async save(): Promise<void> {
		if (!this.room) return;
		await this.ctx.storage.put(ROOM_KEY, this.room);
		// One alarm serves two jobs: a running countdown (seconds away) wins;
		// otherwise every write pushes the idle self-destruct out.
		await this.ctx.storage.setAlarm(this.room.countdownEndsAt ?? Date.now() + IDLE_TTL_MS);
	}

	/** Countdown auto-reveal when one is running; idle cleanup otherwise. */
	async alarm(): Promise<void> {
		const room = await this.load();
		if (room.countdownEndsAt != null) {
			if (Date.now() >= room.countdownEndsAt - 250) {
				room.countdownEndsAt = null;
				room.revealed = true;
				room.revealedAt ??= Date.now();
			}
			await this.save(); // re-arms: next countdown tick or idle TTL
			this.broadcast(room);
			return;
		}
		if (this.ctx.getWebSockets().length > 0) {
			// Someone is connected (just quietly) — check back later.
			await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
			return;
		}
		this.room = null;
		// deleteAll() does not clear a pending alarm — do both.
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const slug = url.pathname.match(/^\/api\/room\/([a-z0-9-]{1,64})\//)?.[1] ?? '';

		// Plain-HTTP integration surface (the room slug is the capability,
		// same as the app itself) — see "API" in the README. Anything that
		// can run curl can import a backlog and export the results.
		if (url.pathname.endsWith('/export') && request.method === 'GET') {
			return this.handleExport(slug, url.searchParams.get('format'));
		}
		if (url.pathname.endsWith('/queue') && request.method === 'POST') {
			return this.handleQueueImport(request, url.searchParams.get('mode'));
		}

		if (url.pathname.endsWith('/peek')) {
			// Rooms are created lazily, so "exists" = someone has been here before.
			// Reads storage directly (not load()) to avoid materializing the room.
			const stored = await this.ctx.storage.get<PersistedRoom>(ROOM_KEY);
			if (!stored) return Response.json({ exists: false });
			// Name + theme feed the social-preview meta tags in worker/index.ts.
			return Response.json({
				exists: true,
				name: stored.settings.roomName,
				theme: resolveTheme(stored.settings.theme),
			});
		}
		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('Expected WebSocket', { status: 426 });
		}
		const userId = new URL(request.url).searchParams.get('u');
		if (!userId || userId.length > 64) {
			return new Response('Missing user id', { status: 400 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		// Tag with userId so we can find this user's sockets after hibernation.
		this.ctx.acceptWebSocket(server, [userId]);
		server.serializeAttachment({ userId });

		const room = await this.load();
		const participant = room.participants[userId];
		if (participant) {
			participant.lastSeen = Date.now();
			await this.save();
		}
		// Presence may have changed for everyone; sockets aren't sendable until
		// after we return, so let hibernation deliver the first state via a
		// microtask-safe broadcast on the next event. Send eagerly instead:
		this.broadcast(room);

		return new Response(null, { status: 101, webSocket: client });
	}

	/** GET /export — session results as JSON (default) or CSV. */
	private async handleExport(slug: string, format: string | null): Promise<Response> {
		const stored = await this.ctx.storage.get<PersistedRoom>(ROOM_KEY);
		if (!stored) return Response.json({ error: 'no such room' }, { status: 404 });
		const history = stored.history ?? [];
		if (format === 'csv') {
			const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
			const lines = [
				'story,ended_at,duration_seconds,votes',
				...history.map((r) =>
					[
						esc(r.story),
						new Date(r.endedAt).toISOString(),
						String(Math.round(r.durationMs / 1000)),
						esc(r.votes.map((v) => `${v.label}×${v.count}`).join('; ')),
					].join(','),
				),
			];
			return new Response(lines.join('\n') + '\n', {
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename="${slug}-history.csv"`,
				},
			});
		}
		return Response.json({
			room: slug,
			name: stored.settings.roomName,
			exportedAt: new Date().toISOString(),
			queue: stored.queue ?? [],
			history: history.map((r) => ({
				story: r.story,
				endedAt: new Date(r.endedAt).toISOString(),
				durationSeconds: Math.round(r.durationMs / 1000),
				votes: r.votes,
			})),
		});
	}

	/** POST /queue — JSON {items: []} or text/plain (one story per line).
	 *  Appends by default; ?mode=replace swaps the whole queue. */
	private async handleQueueImport(request: Request, mode: string | null): Promise<Response> {
		let items: string[];
		try {
			const body = await request.text();
			if (request.headers.get('Content-Type')?.includes('json')) {
				items = sanitizeQueue((JSON.parse(body) as { items?: unknown }).items);
			} else {
				items = sanitizeQueue(body.split('\n'));
			}
		} catch {
			return Response.json({ error: 'expected JSON {"items": [...]} or one story per line' }, { status: 400 });
		}
		const room = await this.load();
		if (room.settings.ticketQueue === false) {
			return Response.json({ error: 'the ticket queue is disabled in this room’s settings' }, { status: 403 });
		}
		room.queue = mode === 'replace' ? items : sanitizeQueue([...(room.queue ?? []), ...items]);
		await this.save();
		this.broadcast(room); // connected clients see the imported queue live
		return Response.json({ queued: room.queue.length });
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		const { userId } = ws.deserializeAttachment() as { userId: string };
		let msg: ClientMessage;
		try {
			msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
		} catch {
			return;
		}
		const room = await this.load();

		switch (msg.type) {
			case 'join': {
				const name = String(msg.name ?? '').trim().slice(0, 40);
				const role: Role = msg.role === 'observer' ? 'observer' : 'voter';
				if (!name) return this.sendError(ws, 'Name is required');
				const existing = room.participants[userId];
				room.participants[userId] = {
					name,
					role,
					lastSeen: Date.now(),
					joinedAt: existing?.joinedAt ?? Date.now(),
				};
				if (!room.ownerId) room.ownerId = userId;
				room.founderId ??= room.ownerId;
				if (role === 'observer') delete room.votes[userId];
				this.pruneStaleSeats(room);
				this.ensureHost(room);
				break;
			}
			case 'vote': {
				const p = room.participants[userId];
				if (!p || p.role !== 'voter' || room.revealed) return;
				if (msg.value === null) {
					delete room.votes[userId];
				} else {
					const value = String(msg.value).slice(0, 20);
					if (!room.settings.deck.some((c) => c.value === value)) return;
					room.votes[userId] = value;
				}
				this.maybeAutoReveal(room);
				break;
			}
			case 'reveal': {
				if (!room.participants[userId]) return;
				room.revealed = true;
				room.revealedAt ??= Date.now();
				room.countdownEndsAt = null;
				break;
			}
			case 'countdown': {
				if (!room.participants[userId] || room.revealed) return;
				if (room.settings.countdown === false) return;
				room.countdownEndsAt =
					msg.action === 'start'
						? Date.now() + (room.settings.countdownSeconds ?? 60) * 1000
						: null;
				break;
			}
			case 'clear': {
				if (!room.participants[userId]) return;
				// "Next ticket" (clearStory) after a reveal closes out a real
				// round — record it. A plain "Re-vote" discards the round.
				if (msg.clearStory && room.revealed) this.recordRound(room);
				room.votes = {};
				room.revealed = false;
				room.revealedAt = null;
				room.countdownEndsAt = null;
				room.roundStartedAt = Date.now();
				// "Next ticket" pulls the next queued story; blank if none
				// (or if the queue feature is switched off).
				if (msg.clearStory) {
					room.story = (room.settings.ticketQueue !== false ? room.queue?.shift() : undefined) ?? '';
				}
				break;
			}
			case 'story': {
				if (!room.participants[userId]) return;
				room.story = String(msg.text ?? '').slice(0, 2000);
				break;
			}
			case 'queue': {
				if (!room.participants[userId]) return;
				if (room.settings.ticketQueue === false) return;
				room.queue = sanitizeQueue(msg.items);
				break;
			}
			case 'settings': {
				if (room.ownerId !== userId) return this.sendError(ws, 'Only the room owner can change settings');
				const s = msg.settings;
				const deck = (Array.isArray(s?.deck) ? s.deck : [])
					.map((c) => ({
						label: String(c?.label ?? '').trim().slice(0, 20),
						value: String(c?.value ?? '').trim().slice(0, 20),
						group: String(c?.group ?? '').trim().slice(0, 20) || undefined,
					}))
					.filter((c) => c.label && c.value)
					.slice(0, 30);
				if (deck.length === 0) return this.sendError(ws, 'Deck needs at least one card');
				room.settings = {
					roomName: String(s?.roomName ?? '').trim().slice(0, 60),
					deck,
					autoReveal: Boolean(s?.autoReveal),
					theme: s?.theme === 'seasonal' || THEMES.some((t) => t.id === s?.theme) ? s.theme : 'classic',
					// default on; only an explicit false turns it off (old clients omit it)
					timerSounds: s?.timerSounds !== false,
					keepHistory: s?.keepHistory !== false,
					ticketQueue: s?.ticketQueue !== false,
					countdown: s?.countdown !== false,
					countdownSeconds: Math.min(600, Math.max(5, Math.round(Number(s?.countdownSeconds)) || 60)),
				};
				// Drop votes for values no longer in the deck.
				for (const [id, v] of Object.entries(room.votes)) {
					if (!deck.some((c) => c.value === v)) delete room.votes[id];
				}
				break;
			}
			case 'reaction': {
				const sender = room.participants[userId];
				if (!sender) return;
				if (!ALL_REACTION_EMOJI.includes(msg.emoji)) return;
				// Ephemeral: fan out and forget — no storage write, no state broadcast.
				const payload: ServerMessage = { type: 'reaction', emoji: msg.emoji, from: userId, name: sender.name };
				for (const socket of this.ctx.getWebSockets()) this.send(socket, payload);
				return;
			}
			case 'clearHistory': {
				if (room.ownerId !== userId) return this.sendError(ws, 'Only the host can clear the history');
				room.history = [];
				break;
			}
			case 'transferHost': {
				if (room.ownerId !== userId) return this.sendError(ws, 'Only the host can hand off the host role');
				const to = String(msg.to ?? '');
				if (!room.participants[to]) return;
				// An explicit hand-off moves the reclaim rights too.
				room.ownerId = to;
				room.founderId = to;
				break;
			}
			case 'leave': {
				delete room.participants[userId];
				delete room.votes[userId];
				this.ensureHost(room);
				await this.save();
				this.broadcast(room);
				for (const socket of this.ctx.getWebSockets(userId)) socket.close(1000, 'left');
				return;
			}
			default:
				return;
		}

		const p = room.participants[userId];
		if (p) p.lastSeen = Date.now();
		await this.save();
		this.broadcast(room);
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		const room = await this.load();
		// A voter dropping off changes presence and can complete the round.
		this.maybeAutoReveal(room);
		this.ensureHost(room);
		await this.save();
		this.broadcast(room);
	}

	async webSocketError(): Promise<void> {
		const room = await this.load();
		this.broadcast(room);
	}

	/** Users with at least one live socket right now. */
	private connectedIds(): Set<string> {
		const ids = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as { userId?: string } | null;
			if (att?.userId) ids.add(att.userId);
		}
		return ids;
	}

	/**
	 * Host succession: the founder reclaims the role whenever present;
	 * otherwise, if the current host is gone, the longest-seated connected
	 * participant takes over.
	 */
	private ensureHost(room: PersistedRoom): void {
		const connected = this.connectedIds();
		if (room.founderId && connected.has(room.founderId) && room.participants[room.founderId]) {
			room.ownerId = room.founderId;
			return;
		}
		if (room.ownerId && connected.has(room.ownerId) && room.participants[room.ownerId]) return;
		const candidates = Object.entries(room.participants)
			.filter(([id]) => connected.has(id))
			.sort((a, b) => (a[1].joinedAt ?? a[1].lastSeen ?? 0) - (b[1].joinedAt ?? b[1].lastSeen ?? 0));
		if (candidates.length > 0) room.ownerId = candidates[0][0];
	}

	/** Fold the revealed round into history (aggregate counts, deck order). */
	private recordRound(room: PersistedRoom): void {
		// Old rooms predate keepHistory; undefined means the default (on).
		if (room.settings.keepHistory === false) return;
		const counts = new Map<string, number>();
		for (const v of Object.values(room.votes)) counts.set(v, (counts.get(v) ?? 0) + 1);
		if (counts.size === 0) return;
		const votes: RoundRecord['votes'] = room.settings.deck
			.filter((c) => counts.has(c.value))
			.map((c) => ({ label: c.label, value: c.value, count: counts.get(c.value)! }));
		const endedAt = Date.now();
		room.history = [
			{
				story: room.story,
				endedAt,
				durationMs: Math.max(0, (room.revealedAt ?? endedAt) - room.roundStartedAt),
				votes,
			},
			...(room.history ?? []),
		].slice(0, MAX_HISTORY);
	}

	private maybeAutoReveal(room: PersistedRoom): void {
		if (!room.settings.autoReveal || room.revealed) return;
		const connected = this.connectedIds();
		const voters = Object.entries(room.participants).filter(
			([id, p]) => p.role === 'voter' && connected.has(id),
		);
		if (voters.length > 0 && voters.every(([id]) => room.votes[id] !== undefined)) {
			room.revealed = true;
			room.revealedAt ??= Date.now();
			room.countdownEndsAt = null;
		}
	}

	private pruneStaleSeats(room: PersistedRoom): void {
		const connected = this.connectedIds();
		const cutoff = Date.now() - SEAT_TTL_MS;
		for (const [id, p] of Object.entries(room.participants)) {
			if (!connected.has(id) && p.lastSeen < cutoff) {
				delete room.participants[id];
				delete room.votes[id];
			}
		}
	}

	private viewFor(room: PersistedRoom, userId: string): RoomStateView {
		const connected = this.connectedIds();
		const participants: ParticipantView[] = Object.entries(room.participants)
			.filter(([id]) => connected.has(id))
			.map(([id, p]) => {
				const vote = room.votes[id];
				return {
					id,
					name: p.name,
					role: p.role,
					hasVoted: vote !== undefined,
					vote: vote !== undefined && (room.revealed || id === userId) ? vote : null,
					isOwner: id === room.ownerId,
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
		return {
			settings: room.settings,
			story: room.story,
			revealed: room.revealed,
			revealedAt: room.revealedAt ?? null,
			roundStartedAt: room.roundStartedAt,
			participants,
			you: userId,
			youJoined: room.participants[userId] !== undefined && connected.has(userId),
			history: room.settings.keepHistory === false ? [] : (room.history ?? []),
			queue: room.settings.ticketQueue === false ? [] : (room.queue ?? []),
			theme: resolveTheme(room.settings.theme),
			countdownEndsAt: room.countdownEndsAt ?? null,
		};
	}

	private broadcast(room: PersistedRoom): void {
		for (const ws of this.ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as { userId?: string } | null;
			if (!att?.userId) continue;
			this.send(ws, { type: 'state', state: this.viewFor(room, att.userId) });
		}
	}

	private send(ws: WebSocket, msg: ServerMessage): void {
		try {
			ws.send(JSON.stringify(msg));
		} catch {
			// Socket already gone; close event will rebroadcast.
		}
	}

	private sendError(ws: WebSocket, message: string): void {
		this.send(ws, { type: 'error', message });
	}
}
