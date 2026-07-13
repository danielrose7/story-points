import { DurableObject } from 'cloudflare:workers';
import type {
	ClientMessage,
	ParticipantView,
	Role,
	RoomSettings,
	RoomStateView,
	ServerMessage,
} from '../shared/types';
import { defaultSettings, REACTION_EMOJI, THEMES } from '../shared/types';

interface Participant {
	name: string;
	role: Role;
	lastSeen: number;
}

interface PersistedRoom {
	settings: RoomSettings;
	story: string;
	revealed: boolean;
	revealedAt: number | null;
	roundStartedAt: number;
	ownerId: string | null;
	participants: Record<string, Participant>;
	votes: Record<string, string>;
}

const ROOM_KEY = 'room';
// Seats older than this with no live socket are pruned from the persisted map.
// Generous so a room reused every ~2 weeks keeps everyone's name and role.
const SEAT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export class Room extends DurableObject<Env> {
	private room: PersistedRoom | null = null;

	private async load(): Promise<PersistedRoom> {
		if (!this.room) {
			this.room =
				(await this.ctx.storage.get<PersistedRoom>(ROOM_KEY)) ?? {
					settings: defaultSettings(),
					story: '',
					revealed: false,
					revealedAt: null,
					roundStartedAt: Date.now(),
					ownerId: null,
					participants: {},
					votes: {},
				};
		}
		return this.room;
	}

	private async save(): Promise<void> {
		if (this.room) await this.ctx.storage.put(ROOM_KEY, this.room);
	}

	async fetch(request: Request): Promise<Response> {
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
				room.participants[userId] = { name, role, lastSeen: Date.now() };
				if (!room.ownerId) room.ownerId = userId;
				if (role === 'observer') delete room.votes[userId];
				this.pruneStaleSeats(room);
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
				break;
			}
			case 'clear': {
				if (!room.participants[userId]) return;
				room.votes = {};
				room.revealed = false;
				room.revealedAt = null;
				room.roundStartedAt = Date.now();
				if (msg.clearStory) room.story = '';
				break;
			}
			case 'story': {
				if (!room.participants[userId]) return;
				room.story = String(msg.text ?? '').slice(0, 2000);
				break;
			}
			case 'settings': {
				if (room.ownerId !== userId) return this.sendError(ws, 'Only the room owner can change settings');
				const s = msg.settings;
				const deck = (Array.isArray(s?.deck) ? s.deck : [])
					.map((c) => ({
						label: String(c?.label ?? '').trim().slice(0, 20),
						value: String(c?.value ?? '').trim().slice(0, 20),
					}))
					.filter((c) => c.label && c.value)
					.slice(0, 30);
				if (deck.length === 0) return this.sendError(ws, 'Deck needs at least one card');
				room.settings = {
					roomName: String(s?.roomName ?? '').trim().slice(0, 60),
					deck,
					autoReveal: Boolean(s?.autoReveal),
					theme: THEMES.some((t) => t.id === s?.theme) ? s.theme : 'classic',
					// default on; only an explicit false turns it off (old clients omit it)
					timerSounds: s?.timerSounds !== false,
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
				if (!(REACTION_EMOJI as readonly string[]).includes(msg.emoji)) return;
				// Ephemeral: fan out and forget — no storage write, no state broadcast.
				const payload: ServerMessage = { type: 'reaction', emoji: msg.emoji, from: userId, name: sender.name };
				for (const socket of this.ctx.getWebSockets()) this.send(socket, payload);
				return;
			}
			case 'leave': {
				delete room.participants[userId];
				delete room.votes[userId];
				if (room.ownerId === userId) {
					// Hand ownership to the longest-seated remaining participant.
					const next = Object.keys(room.participants)[0] ?? null;
					room.ownerId = next;
				}
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

	private maybeAutoReveal(room: PersistedRoom): void {
		if (!room.settings.autoReveal || room.revealed) return;
		const connected = this.connectedIds();
		const voters = Object.entries(room.participants).filter(
			([id, p]) => p.role === 'voter' && connected.has(id),
		);
		if (voters.length > 0 && voters.every(([id]) => room.votes[id] !== undefined)) {
			room.revealed = true;
			room.revealedAt ??= Date.now();
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
