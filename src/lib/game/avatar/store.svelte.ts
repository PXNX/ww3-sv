/*
 * The reactive avatar store: one look shared by the start screen, the profile page and the games
 * that draw the player. Reads and writes local storage; a player who never opened the editor gets
 * the default agent.
 */
import { localStore } from '#lib/services/storage.js';
import { cyclePart, DEFAULT_LOOK, parseLook, randomLook, withPart } from './look';
import type { AvatarLook, LookPart } from './look';

const AVATAR_KEY = 'avatar:look';

class AvatarStore {
	look = $state<AvatarLook>(DEFAULT_LOOK);
	/** True once the player has changed anything, so the start screen can stop nudging */
	customized = $state(false);

	constructor() {
		const stored = parseLook(localStore().read<unknown>(AVATAR_KEY, null));
		if (stored) {
			this.look = stored;
			this.customized = true;
		}
	}

	set(part: LookPart, value: string) {
		this.#commit(withPart(this.look, part, value));
	}

	cycle(part: LookPart, step = 1) {
		this.#commit(cyclePart(this.look, part, step));
	}

	randomize() {
		this.#commit(randomLook());
	}

	reset() {
		this.#commit(DEFAULT_LOOK);
	}

	#commit(look: AvatarLook) {
		this.look = look;
		this.customized = true;
		localStore().write(AVATAR_KEY, look);
	}
}

let shared: AvatarStore | undefined;

/** The app-wide avatar store (created on first use) */
export function avatar(): AvatarStore {
	shared ??= new AvatarStore();
	return shared;
}
