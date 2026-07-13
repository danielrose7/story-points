export { Room } from './room';

const ROOM_ID_RE = /^\/api\/room\/([a-z0-9-]{1,64})\/(ws|peek)$/;

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const match = url.pathname.match(ROOM_ID_RE);
		if (match) {
			const id = env.ROOM.idFromName(match[1]);
			return env.ROOM.get(id).fetch(request);
		}
		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
