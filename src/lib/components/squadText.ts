/* Wording and small helpers shared by the friends and squad panels */
import { m } from '#lib/paraglide/messages.js';
import type { SquadActionResult } from '#lib/stores/squad.svelte.js';

/** What to tell the player after an action; null when it worked */
export function squadResultText(result: SquadActionResult): string | null {
	switch (result) {
		case 'ok':
			return null;
		case 'SQUAD_FULL':
			return m.squad_error_full();
		case 'NOT_ONLINE':
			return m.squad_error_not_online();
		case 'NOT_FRIENDS':
			return m.squad_error_not_friends();
		case 'INVITE_EXPIRED':
			return m.squad_error_expired();
		case 'NOT_LEADER':
			return m.squad_error_not_leader();
		default:
			return m.squad_error_failed();
	}
}

/** The first letter of a name, for an avatar without a photo */
export function initialOf(name: string): string {
	return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

const AVATAR_COLORS = ['#ff6b3d', '#22c3b0', '#7a3fe0', '#ffb020', '#3d8bff', '#e0457b', '#5cb85c'];

/** A steady colour per player id, so the same friend always looks the same */
export function avatarColor(id: string): string {
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
