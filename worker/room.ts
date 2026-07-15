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
import { ALL_REACTION_EMOJI, defaultSettings, ROOM_PRESETS, seasonalTheme, THEMES } from '../shared/types';
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
	/** 6-char access code; null/undefined = open room (the default) */
	accessCode?: string | null;
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
// A room empty this long is "everyone left" (vs a quick refresh); returning
// to it mid-round restarts the clock when freshClock is on.
const FRESH_CLOCK_AFTER_MS = 5 * 60 * 1000;
// Ticket-queue bounds — enough for a hefty backlog-refinement session.
const MAX_QUEUE_ITEMS = 100;
const MAX_QUEUE_ITEM_LEN = 500;

// Access-code brute-force posture: short codes are only safe with hard rate
// limits (see the Dell service-tag breach). 10 bad guesses locks the room's
// code checks for 15 minutes. The counter lives in DO memory — hibernation
// resets it, which only slows an attacker further.
const CODE_MAX_FAILS = 10;
const CODE_LOCKOUT_MS = 15 * 60 * 1000;
// Airline-PNR alphabet: no 0/O/1/I lookalikes. 31^6 ≈ 887M combinations.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Constant-time-ish comparison — no early exit on first mismatch. */
function codeMatches(expected: string, given: string): boolean {
	const a = expected.toUpperCase();
	const b = given.trim().toUpperCase();
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Trim, drop empties, cap counts — shared by the WS message and POST /queue. */
function sanitizeQueue(items: unknown): string[] {
	return (Array.isArray(items) ? items : [])
		.map((s) => String(s ?? '').trim().slice(0, MAX_QUEUE_ITEM_LEN))
		.filter(Boolean)
		.slice(0, MAX_QUEUE_ITEMS);
}

export class Room extends DurableObject<Env> {
	private room: PersistedRoom | null = null;
	/** true until the room's first save — creation presets apply only then */
	private freshRoom = false;
	/** shared bad-guess counter for unlock messages and API code checks */
	private codeFails = 0;
	private codeLockedUntil = 0;

	/** Rate-limited code check; false = wrong code OR currently locked out. */
	private checkCode(room: PersistedRoom, given: string): boolean {
		if (!room.accessCode) return true;
		if (Date.now() < this.codeLockedUntil) return false;
		if (codeMatches(room.accessCode, given)) {
			this.codeFails = 0;
			return true;
		}
		if (++this.codeFails >= CODE_MAX_FAILS) {
			this.codeFails = 0;
			this.codeLockedUntil = Date.now() + CODE_LOCKOUT_MS;
		}
		return false;
	}

	/** Is this socket allowed to see the room? Open rooms: always. */
	private socketUnlocked(ws: WebSocket, room: PersistedRoom): boolean {
		if (!room.accessCode) return true;
		const att = ws.deserializeAttachment() as { unlocked?: boolean } | null;
		return att?.unlocked === true;
	}

	private async load(): Promise<PersistedRoom> {
		if (!this.room) {
			const stored = await this.ctx.storage.get<PersistedRoom>(ROOM_KEY);
			this.freshRoom = stored === undefined;
			this.room =
				stored ?? {
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
		if (
			(url.pathname.endsWith('/export') && request.method === 'GET') ||
			(url.pathname.endsWith('/queue') && request.method === 'POST')
		) {
			// Protected rooms require the code on the API too — ?code= or
			// X-Room-Code header. Same rate-limited counter as the app gate.
			const stored = await this.ctx.storage.get<PersistedRoom>(ROOM_KEY);
			if (stored?.accessCode) {
				const given = url.searchParams.get('code') ?? request.headers.get('X-Room-Code') ?? '';
				if (!this.checkCode(stored, given)) {
					return Response.json(
						{ error: 'this room requires a code — pass ?code= or an X-Room-Code header (ask the room host)' },
						{ status: 401 },
					);
				}
			}
			if (url.pathname.endsWith('/export')) return this.handleExport(slug, url.searchParams.get('format'));
			return this.handleQueueImport(request, url.searchParams.get('mode'));
		}

		if (url.pathname.endsWith('/peek')) {
			// Rooms are created lazily, so "exists" = someone has been here before.
			// Reads storage directly (not load()) to avoid materializing the room.
			const stored = await this.ctx.storage.get<PersistedRoom>(ROOM_KEY);
			if (!stored) return Response.json({ exists: false });
			// Locked rooms don't leak their name to unauthenticated peeks.
			if (stored.accessCode) {
				return Response.json({ exists: true, locked: true, theme: resolveTheme(stored.settings.theme) });
			}
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
		// Locked rooms challenge each new socket instead of streaming state;
		// the client answers with an `unlock` message (auto, if it has the
		// code stored from a previous visit).
		if (room.accessCode) {
			this.send(server, { type: 'locked' });
		}
		// Fresh clock: this is the first connection into a room everyone left
		// mid-round a while ago — restart the timer instead of resuming a
		// days-old count. Checked before lastSeen updates below.
		let dirty = false;
		if (room.settings.freshClock !== false && !room.revealed && this.connectedIds().size <= 1) {
			const lastActive = Math.max(0, ...Object.values(room.participants).map((p) => p.lastSeen));
			if (Date.now() - lastActive > FRESH_CLOCK_AFTER_MS) {
				room.roundStartedAt = Date.now();
				dirty = true;
			}
		}
		const participant = room.participants[userId];
		if (participant) {
			participant.lastSeen = Date.now();
			dirty = true;
		}
		if (dirty) await this.save();
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

		// Locked room: nothing gets through until this socket presents the code.
		if (!this.socketUnlocked(ws, room)) {
			if (msg.type !== 'unlock') return this.send(ws, { type: 'locked' });
			if (this.checkCode(room, msg.code ?? '')) {
				ws.serializeAttachment({ ...(ws.deserializeAttachment() as object), unlocked: true });
				this.send(ws, { type: 'state', state: this.viewFor(room, userId) });
			} else {
				this.sendError(
					ws,
					Date.now() < this.codeLockedUntil
						? 'Too many wrong codes — try again in about 15 minutes'
						: 'That code isn’t right',
				);
			}
			return;
		}

		switch (msg.type) {
			case 'unlock': {
				// Already unlocked (or an open room) — just refresh their state.
				this.send(ws, { type: 'state', state: this.viewFor(room, userId) });
				return;
			}
			case 'setCode': {
				if (room.ownerId !== userId) return this.sendError(ws, 'Only the host can change the room code');
				room.accessCode = msg.enabled ? generateCode() : null;
				// Turning protection on never kicks the people already here.
				if (msg.enabled) {
					for (const socket of this.ctx.getWebSockets()) {
						socket.serializeAttachment({ ...(socket.deserializeAttachment() as object), unlocked: true });
					}
				}
				break;
			}
			case 'join': {
				const name = String(msg.name ?? '').trim().slice(0, 40);
				const role: Role = msg.role === 'observer' ? 'observer' : 'voter';
				if (!name) return this.sendError(ws, 'Name is required');
				// The join that creates the room may carry a creation preset.
				if (this.freshRoom) {
					const preset = ROOM_PRESETS.find((p) => p.id === msg.preset);
					if (preset) room.settings = { ...room.settings, ...structuredClone(preset.settings) };
					this.freshRoom = false;
				}
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
					voteStats: s?.voteStats !== false,
					anonymousVotes: s?.anonymousVotes === true,
					awayVotes: s?.awayVotes !== false,
					freshClock: s?.freshClock !== false,
					agentPrompts: s?.agentPrompts !== false,
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

	/** Aggregate votes into deck-ordered counts (history + reveal stats).
	 *  Away votes (voter disconnected) count unless the room opted out. */
	private voteCounts(room: PersistedRoom): Array<{ label: string; value: string; count: number }> {
		const includeAway = room.settings.awayVotes !== false;
		const connected = this.connectedIds();
		const counts = new Map<string, number>();
		for (const [id, v] of Object.entries(room.votes)) {
			if (!includeAway && !connected.has(id)) continue;
			counts.set(v, (counts.get(v) ?? 0) + 1);
		}
		return room.settings.deck
			.filter((c) => counts.has(c.value))
			.map((c) => ({ label: c.label, value: c.value, count: counts.get(c.value)! }));
	}

	/** Fold the revealed round into history (aggregate counts, deck order). */
	private recordRound(room: PersistedRoom): void {
		// Old rooms predate keepHistory; undefined means the default (on).
		if (room.settings.keepHistory === false) return;
		const votes = this.voteCounts(room);
		if (votes.length === 0) return;
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
		// Away seats (voted this round, then disconnected) stay visible so the
		// table matches the counts — unless the room opted out of away votes.
		const includeAway = room.settings.awayVotes !== false;
		const participants: ParticipantView[] = Object.entries(room.participants)
			.filter(([id]) => connected.has(id) || (includeAway && room.votes[id] !== undefined))
			.map(([id, p]) => {
				const vote = room.votes[id];
				// Anonymous rooms never attribute votes to seats — reveal or
				// not — except your own, which you already know.
				const visible = id === userId || (room.revealed && room.settings.anonymousVotes !== true);
				return {
					id,
					name: p.name,
					role: p.role,
					hasVoted: vote !== undefined,
					vote: vote !== undefined && visible ? vote : null,
					isOwner: id === room.ownerId,
					away: connected.has(id) ? undefined : true,
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
			// The host sees the code (to share it); nobody else does.
			accessCode: userId === room.ownerId && room.accessCode ? room.accessCode : undefined,
			requiresCode: room.accessCode ? true : undefined,
			history: room.settings.keepHistory === false ? [] : (room.history ?? []),
			queue: room.settings.ticketQueue === false ? [] : (room.queue ?? []),
			theme: resolveTheme(room.settings.theme),
			countdownEndsAt: room.countdownEndsAt ?? null,
			voteCounts: room.revealed ? this.voteCounts(room) : [],
		};
	}

	private broadcast(room: PersistedRoom): void {
		for (const ws of this.ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as { userId?: string } | null;
			if (!att?.userId) continue;
			// Sockets that haven't presented the code see nothing.
			if (!this.socketUnlocked(ws, room)) continue;
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
