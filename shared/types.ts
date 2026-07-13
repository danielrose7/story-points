export type Role = 'voter' | 'observer';

export interface DeckCard {
	label: string;
	value: string;
}

export const THEMES = [
	{ id: 'classic', label: '🃏 Card table' },
	{ id: 'space', label: '🚀 Outer space' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export interface RoomSettings {
	roomName: string;
	deck: DeckCard[];
	/** Reveal votes automatically once every connected voter has voted */
	autoReveal: boolean;
	theme: ThemeId;
	/** Room-wide switch for timer chimes (individuals can still mute locally) */
	timerSounds: boolean;
}

export interface ParticipantView {
	id: string;
	name: string;
	role: Role;
	hasVoted: boolean;
	/** null while votes are hidden (except your own vote) */
	vote: string | null;
	isOwner: boolean;
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
}

export const REACTION_EMOJI = ['👍', '🔥', '🤔', '😂', '🎉', '👏', '☕', '🐇'] as const;

export type ClientMessage =
	| { type: 'join'; name: string; role: Role }
	| { type: 'vote'; value: string | null }
	| { type: 'reveal' }
	/** clearStory=true means "next ticket": also blank the story description */
	| { type: 'clear'; clearStory?: boolean }
	| { type: 'story'; text: string }
	| { type: 'settings'; settings: RoomSettings }
	| { type: 'reaction'; emoji: string }
	| { type: 'leave' };

export type ServerMessage =
	| { type: 'state'; state: RoomStateView }
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

export function defaultSettings(): RoomSettings {
	return {
		roomName: '',
		deck: DECK_PRESETS.fibonacci.map((c) => ({ ...c })),
		autoReveal: true,
		theme: 'classic',
		timerSounds: true,
	};
}
