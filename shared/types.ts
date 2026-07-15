export type Role = 'voter' | 'observer';

export interface DeckCard {
	label: string;
	value: string;
	/** cards sharing a group render as a labeled cluster in the voting hand */
	group?: string;
}

export const THEMES = [
	{ id: 'classic', label: '🃏 Card table' },
	{ id: 'space', label: '🚀 Outer space' },
	{ id: 'surf', label: '🏄 Surf' },
	{ id: 'birthday', label: '🎂 Birthday' },
	{ id: 'nightclub', label: '🪩 Nightclub' },
	{ id: 'newyear', label: '🧧 Lunar New Year' },
	{ id: 'valentines', label: '💘 Valentine’s' },
	{ id: 'stpatricks', label: '🍀 St. Patrick’s' },
	{ id: 'easter', label: '🌸 Easter' },
	{ id: 'mothersday', label: '🌷 Mother’s Day' },
	{ id: 'summer', label: '☀️ Summer' },
	{ id: 'july4', label: '🎆 4th of July' },
	{ id: 'backtoschool', label: '📚 Back to School' },
	{ id: 'fall', label: '🍂 Fall' },
	{ id: 'halloween', label: '🎃 Halloween' },
	{ id: 'thanksgiving', label: '🦃 Thanksgiving' },
	{ id: 'christmas', label: '🎄 Christmas' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

/** What the host picked: a pinned theme, or 'seasonal' = follow the calendar
 *  (the default; resolved to a concrete theme server-side on every view). */
export type ThemeChoice = ThemeId | 'seasonal';

export interface RoomSettings {
	roomName: string;
	deck: DeckCard[];
	/** Reveal votes automatically once every connected voter has voted */
	autoReveal: boolean;
	theme: ThemeChoice;
	/** Room-wide switch for timer chimes (individuals can still mute locally) */
	timerSounds: boolean;
	/** Record finished rounds (story, votes, duration). Off = stop recording
	 *  and hide the panel; existing entries survive until cleared. */
	keepHistory: boolean;
	/** "Up next" ticket queue. Off = hide the panel and reject API imports;
	 *  queued items survive until re-enabled. */
	ticketQueue: boolean;
	/** Voting countdown button (auto-reveals when it hits zero). */
	countdown: boolean;
	/** Countdown length in seconds (5–600). */
	countdownSeconds: number;
	/** Result extras on reveal: average, agreement %, distribution chart. */
	voteStats: boolean;
	/** Reveal shows aggregate counts only — never who voted what. */
	anonymousVotes: boolean;
	/** Keep votes from people who voted then disconnected in the round
	 *  (shown as 💤 away seats). Off = only live connections count. */
	awayVotes: boolean;
	/** Restart the round clock when the first person returns to a room
	 *  everyone left mid-round (prevents day-old timers full of rabbits). */
	freshClock: boolean;
	/** Copyable "use your agent" prompts in the queue/history panels. */
	agentPrompts: boolean;
}

/** One finished round ("Next ticket →" after a reveal). Aggregate counts
 *  only — no per-person votes are kept beyond the live round. */
export interface RoundRecord {
	story: string;
	/** when the round was closed out */
	endedAt: number;
	/** vote → reveal, matching the frozen round timer */
	durationMs: number;
	/** deck-ordered; only values that received votes */
	votes: Array<{ label: string; value: string; count: number }>;
}

export interface ParticipantView {
	id: string;
	name: string;
	role: Role;
	hasVoted: boolean;
	/** null while votes are hidden (except your own vote) */
	vote: string | null;
	isOwner: boolean;
	/** voted this round but currently disconnected */
	away?: boolean;
}

export interface RoomStateView {
	settings: RoomSettings;
	story: string;
	revealed: boolean;
	/** when the current round was revealed; the round timer freezes here */
	revealedAt: number | null;
	roundStartedAt: number;
	participants: ParticipantView[];
	/** the recipient's user id */
	you: string;
	/** whether the recipient has a seat (has joined) */
	youJoined: boolean;
	/** finished rounds, newest first; empty when keepHistory is off */
	history: RoundRecord[];
	/** stories waiting their turn; "Next ticket →" pulls from the front */
	queue: string[];
	/** settings.theme resolved to a concrete theme ('seasonal' → today's) */
	theme: ThemeId;
	/** epoch ms when the running countdown auto-reveals; null = none */
	countdownEndsAt: number | null;
	/** aggregate vote counts in deck order; populated once revealed */
	voteCounts: Array<{ label: string; value: string; count: number }>;
	/** the room's access code — sent to the host only */
	accessCode?: string;
	/** true when the room requires a code (recipients have already passed) */
	requiresCode?: boolean;
}

/** Response of GET /api/room/<slug>/peek — 404 check + social-preview tags. */
export interface RoomPeek {
	exists: boolean;
	/** room requires a code; name withheld */
	locked?: boolean;
	name?: string;
	theme?: ThemeId;
}

export const REACTION_EMOJI = ['👍', '🔥', '🤔', '😂', '🎉', '👏', '☕', '🐇'] as const;

/** Two theme-flavored tray slots appended to the core reactions. */
export const THEME_REACTIONS: Record<ThemeId, [string, string]> = {
	classic: ['🎲', '♠️'],
	space: ['🛸', '🌟'],
	surf: ['🌊', '🤙'],
	birthday: ['🎈', '🎁'],
	nightclub: ['💃', '🕺'],
	newyear: ['🧧', '🐉'],
	valentines: ['💘', '🌹'],
	stpatricks: ['🍀', '🌈'],
	easter: ['🐣', '🌸'],
	mothersday: ['🌷', '💐'],
	summer: ['🍦', '😎'],
	july4: ['🎆', '🦅'],
	backtoschool: ['📚', '✏️'],
	fall: ['🍂', '🌰'],
	halloween: ['🎃', '👻'],
	thanksgiving: ['🦃', '🥧'],
	christmas: ['🎅', '⛄'],
};

/** Everything the server accepts, regardless of the room's current theme. */
export const ALL_REACTION_EMOJI: string[] = [
	...new Set([...REACTION_EMOJI, ...Object.values(THEME_REACTIONS).flat()]),
];

/** Calendar anchors for seasonal themes ([month 1-12, day]). Non-seasonal
 *  themes have no anchor — they're manual picks in room settings. */
const THEME_ANCHORS: Array<{ id: ThemeId; month: number; day: number }> = [
	{ id: 'newyear', month: 2, day: 1 },
	{ id: 'valentines', month: 2, day: 14 },
	{ id: 'stpatricks', month: 3, day: 17 },
	{ id: 'easter', month: 4, day: 5 },
	{ id: 'mothersday', month: 5, day: 10 },
	{ id: 'summer', month: 6, day: 21 },
	{ id: 'july4', month: 7, day: 4 },
	{ id: 'backtoschool', month: 8, day: 25 },
	{ id: 'fall', month: 9, day: 22 },
	{ id: 'halloween', month: 10, day: 31 },
	{ id: 'thanksgiving', month: 11, day: 26 },
	{ id: 'christmas', month: 12, day: 25 },
];

/** Theme whose anchor date is nearest to `date`, wrapping around the year. */
export function seasonalTheme(date: Date): ThemeId {
	const dayOfYear = (d: Date) =>
		Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000);
	const today = dayOfYear(date);
	let best: ThemeId = 'classic';
	let bestDist = Infinity;
	for (const a of THEME_ANCHORS) {
		const anchorDay = dayOfYear(new Date(Date.UTC(date.getUTCFullYear(), a.month - 1, a.day)));
		const raw = Math.abs(anchorDay - today);
		const dist = Math.min(raw, 365 - raw);
		if (dist < bestDist) {
			bestDist = dist;
			best = a.id;
		}
	}
	return best;
}

export type ClientMessage =
	/** preset only applies when this join creates the room */
	| { type: 'join'; name: string; role: Role; preset?: string }
	| { type: 'vote'; value: string | null }
	| { type: 'reveal' }
	/** clearStory=true means "next ticket": also blank the story description */
	| { type: 'clear'; clearStory?: boolean }
	| { type: 'story'; text: string }
	/** replace the ticket queue (client sends its full edited list) */
	| { type: 'queue'; items: string[] }
	/** start or cancel the auto-reveal countdown for the current round */
	| { type: 'countdown'; action: 'start' | 'cancel' }
	| { type: 'settings'; settings: RoomSettings }
	| { type: 'reaction'; emoji: string }
	/** host only: hand the host role (and its reclaim rights) to another participant */
	| { type: 'transferHost'; to: string }
	/** host only: wipe the recorded round history */
	| { type: 'clearHistory' }
	/** present the room code for a locked room (per connection) */
	| { type: 'unlock'; code: string }
	/** host only: turn code protection on (generates a fresh code) or off */
	| { type: 'setCode'; enabled: boolean }
	| { type: 'leave' };

export type ServerMessage =
	| { type: 'state'; state: RoomStateView }
	/** this room requires a code; send `unlock` before anything else */
	| { type: 'locked' }
	/** ephemeral — rendered and forgotten, never stored */
	| { type: 'reaction'; emoji: string; from: string; name: string }
	| { type: 'error'; message: string };

export const DECK_PRESETS: Record<string, DeckCard[]> = {
	fibonacci: [
		{ label: '0', value: '0' },
		{ label: '½', value: '0.5' },
		{ label: '1', value: '1' },
		{ label: '2', value: '2' },
		{ label: '3', value: '3' },
		{ label: '5', value: '5' },
		{ label: '8', value: '8' },
		{ label: '13', value: '13' },
		{ label: '20', value: '20' },
		{ label: '40', value: '40' },
		{ label: '100', value: '100' },
		{ label: '?', value: '?' },
	],
	tshirt: [
		{ label: 'XS', value: 'XS' },
		{ label: 'S', value: 'S' },
		{ label: 'M', value: 'M' },
		{ label: 'L', value: 'L' },
		{ label: 'XL', value: 'XL' },
		{ label: '?', value: '?' },
	],
	powers: [
		{ label: '1', value: '1' },
		{ label: '2', value: '2' },
		{ label: '4', value: '4' },
		{ label: '8', value: '8' },
		{ label: '16', value: '16' },
		{ label: '32', value: '32' },
		{ label: '?', value: '?' },
	],
};

/** Creation presets: bundles of deck + feature toggles applied to a fresh
 *  room when its first participant joins. Everything remains editable in
 *  room settings afterwards. */
export const ROOM_PRESETS: Array<{
	id: string;
	label: string;
	description: string;
	settings: Partial<RoomSettings>;
}> = [
	{
		id: 'sprint',
		label: '🏃 Sprint planning',
		description: 'Fibonacci deck, all features on',
		settings: {},
	},
	{
		id: 'tshirt',
		label: '👕 T-shirt sizing',
		description: 'XS–XL deck, all features on',
		settings: { deck: DECK_PRESETS.tshirt },
	},
	{
		id: 'triage',
		label: '🚑 Triage',
		description: 'Severity tiers instead of points; no timer chimes',
		settings: {
			deck: [
				{ label: 'Urgent', value: 'urgent', group: 'Severity' },
				{ label: 'High', value: 'high', group: 'Severity' },
				{ label: 'Medium', value: 'medium', group: 'Severity' },
				{ label: 'Low', value: 'low', group: 'Severity' },
				{ label: 'Cancel', value: 'cancel' },
				{ label: '?', value: '?' },
			],
			timerSounds: false,
			voteStats: false,
		},
	},
	{
		id: 'minimal',
		label: '🎯 Minimal',
		description: 'Just cards and a reveal — no queue, history, stats, countdown, or chimes',
		settings: {
			ticketQueue: false,
			keepHistory: false,
			voteStats: false,
			countdown: false,
			timerSounds: false,
		},
	},
];

export function defaultSettings(): RoomSettings {
	return {
		roomName: '',
		deck: DECK_PRESETS.fibonacci.map((c) => ({ ...c })),
		autoReveal: true,
		theme: 'seasonal',
		timerSounds: true,
		keepHistory: true,
		ticketQueue: true,
		countdown: true,
		countdownSeconds: 60,
		voteStats: true,
		anonymousVotes: false,
		awayVotes: true,
		freshClock: true,
		agentPrompts: true,
	};
}
