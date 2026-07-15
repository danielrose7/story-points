import type { Role } from '../shared/types';

const USER_ID_KEY = 'sp:user-id';
const NAME_KEY = 'sp:name';

export function getUserId(): string {
	let id = localStorage.getItem(USER_ID_KEY);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(USER_ID_KEY, id);
	}
	return id;
}

export function getSavedName(): string {
	return localStorage.getItem(NAME_KEY) ?? '';
}

export function saveName(name: string): void {
	localStorage.setItem(NAME_KEY, name);
}

export function getSavedRole(roomId: string): Role | null {
	const role = localStorage.getItem(`pp:role:${roomId}`);
	return role === 'voter' || role === 'observer' ? role : null;
}

export function saveRole(roomId: string, role: Role): void {
	localStorage.setItem(`pp:role:${roomId}`, role);
}

export function clearRoomSession(roomId: string): void {
	localStorage.removeItem(`pp:role:${roomId}`);
}

/** Access code for a protected room, remembered per device. */
export function getRoomCode(roomId: string): string | null {
	return localStorage.getItem(`sp:code:${roomId}`);
}

export function saveRoomCode(roomId: string, code: string): void {
	localStorage.setItem(`sp:code:${roomId}`, code.trim().toUpperCase());
}
