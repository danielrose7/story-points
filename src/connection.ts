import type { ClientMessage, RoomStateView, ServerMessage } from '../shared/types';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/**
 * WebSocket client for a room with automatic reconnect. On every (re)connect
 * it replays the last join message so a refreshed or briefly-offline user
 * reclaims their seat without interaction.
 */
export class RoomConnection {
	private ws: WebSocket | null = null;
	private closedByUs = false;
	private retryMs = 500;
	private pendingJoin: ClientMessage | null = null;

	onState: (state: RoomStateView) => void = () => {};
	onStatus: (status: ConnectionStatus) => void = () => {};
	onError: (message: string) => void = () => {};
	onReaction: (emoji: string, from: string, name: string) => void = () => {};

	constructor(
		private roomId: string,
		private userId: string,
	) {}

	connect(): void {
		this.closedByUs = false;
		this.onStatus(this.ws ? 'reconnecting' : 'connecting');
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		const ws = new WebSocket(`${proto}://${location.host}/api/room/${this.roomId}/ws?u=${this.userId}`);
		this.ws = ws;

		ws.addEventListener('open', () => {
			this.retryMs = 500;
			this.onStatus('open');
			if (this.pendingJoin) ws.send(JSON.stringify(this.pendingJoin));
		});
		ws.addEventListener('message', (e) => {
			const msg = JSON.parse(e.data as string) as ServerMessage;
			if (msg.type === 'state') this.onState(msg.state);
			else if (msg.type === 'reaction') this.onReaction(msg.emoji, msg.from, msg.name);
			else if (msg.type === 'error') this.onError(msg.message);
		});
		ws.addEventListener('close', () => {
			if (this.closedByUs) return;
			this.onStatus('reconnecting');
			setTimeout(() => this.connect(), this.retryMs);
			this.retryMs = Math.min(this.retryMs * 2, 8000);
		});
	}

	send(msg: ClientMessage): void {
		// Remember the join so reconnects re-claim the seat automatically.
		if (msg.type === 'join') this.pendingJoin = msg;
		if (msg.type === 'leave') this.pendingJoin = null;
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(msg));
		}
	}

	close(): void {
		this.closedByUs = true;
		this.onStatus('closed');
		this.ws?.close(1000, 'bye');
		this.ws = null;
	}
}
