const KEY = 'sp:recent-rooms';
const MAX = 6;

export interface RecentRoom {
	id: string;
	/** the room's display name at last visit ('' if unnamed) */
	name: string;
	lastSeen: number;
}

export function getRecentRooms(): RecentRoom[] {
	try {
		const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentRoom[];
		return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string') : [];
	} catch {
		return [];
	}
}

/** Upsert a room to the top of the recents list (while seated, and on leave). */
export function touchRecentRoom(id: string, name: string): void {
	const list = getRecentRooms().filter((r) => r.id !== id);
	list.unshift({ id, name: name ?? '', lastSeen: Date.now() });
	localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}
