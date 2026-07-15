export { Room } from './room';
export { Stats } from './stats';
import { seasonalTheme, THEMES, type RoomPeek } from '../shared/types';

const ROOM_API_RE = /^\/api\/room\/([a-z0-9-]{1,64})\/(ws|peek|export|queue)$/;
const ROOM_PAGE_RE = /^\/room\/([a-z0-9-]{1,64})$/;

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const api = url.pathname.match(ROOM_API_RE);
		if (api) {
			const id = env.ROOM.idFromName(api[1]);
			return env.ROOM.get(id).fetch(request);
		}

		// Aggregate usage counters for the home-page stats strip. Public,
		// integers only. Short browser cache keeps refresh-spam off the DO.
		if (url.pathname === '/api/stats' && request.method === 'GET') {
			const stats = await env.STATS.get(env.STATS.idFromName('global')).fetch(request);
			return new Response(stats.body, {
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
			});
		}

		// "/" and "/room/*" run worker-first (wrangler.jsonc) so the SPA shell
		// goes out with real social-preview tags: the room's name in the title
		// and its theme's card image — seasonal for the home page and rooms
		// that don't exist yet. Everything else is served straight from assets.
		if (url.pathname === '/' || ROOM_PAGE_RE.test(url.pathname)) {
			const shell = await env.ASSETS.fetch(request);
			return rewriteSocialTags(shell, url, env);
		}
		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

async function rewriteSocialTags(shell: Response, url: URL, env: Env): Promise<Response> {
	let title = 'Story Points';
	let description = 'Estimate together, in realtime.';
	let theme: string = seasonalTheme(new Date());

	const slug = url.pathname.match(ROOM_PAGE_RE)?.[1];
	if (slug) {
		title = `${slug} · Story Points`;
		description = 'Pull up a seat — votes stay hidden until everyone’s in.';
		try {
			const peek = (await (
				await env.ROOM.get(env.ROOM.idFromName(slug)).fetch(`${url.origin}/api/room/${slug}/peek`)
			).json()) as RoomPeek;
			if (peek.exists) {
				if (peek.name) title = `${peek.name} · Story Points`;
				if (THEMES.some((t) => t.id === peek.theme)) theme = peek.theme!;
			}
		} catch {
			// Preview tags are best-effort; fall through to seasonal defaults.
		}
	}

	const image = `${url.origin}/og/${theme}.png?v=1`;
	const content = (value: string) => ({
		element(el: Element) {
			el.setAttribute('content', value);
		},
	});
	return new HTMLRewriter()
		.on('title', {
			element(el) {
				el.setInnerContent(title);
			},
		})
		.on('meta[property="og:title"]', content(title))
		.on('meta[property="og:description"]', content(description))
		.on('meta[name="description"]', content(description))
		.on('meta[property="og:url"]', content(url.origin + url.pathname))
		.on('meta[property="og:image"]', content(image))
		.on('meta[name="twitter:image"]', content(image))
		.transform(shell);
}
