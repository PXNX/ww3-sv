/*
 * The reactive avatar store: one look shared by the start screen, the profile page and the games
 * that draw the player. Reads and writes local storage; a player who never opened the editor gets
 * the default agent. The agent is the player's Telegram identity: until the game runs as a Mini App
 * with a Telegram account, everyone sees an anonymous hooded figure instead of the saved look.
 */
import { localStore } from '#lib/services/storage.js';
import { telegram } from '#lib/stores/telegram.svelte.js';
import { ANONYMOUS_LOOK, cyclePart, DEFAULT_LOOK, parseLook, randomLook, withPart } from './look';
import type { AvatarLook, LookAllowed, LookPart } from './look';

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

	/** True while no Telegram account is signed in; the agent then stays masked */
	get anonymous(): boolean {
		return telegram().user === null;
	}

	/** The look to draw: the saved one once signed in with Telegram, the hooded figure before */
	get shown(): AvatarLook {
		return this.anonymous ? ANONYMOUS_LOOK : this.look;
	}

	set(part: LookPart, value: string) {
		this.#commit(withPart(this.look, part, value));
	}

	cycle(part: LookPart, step = 1) {
		this.#commit(cyclePart(this.look, part, step));
	}

	randomize(allowed?: LookAllowed) {
		this.#commit(randomLook(undefined, allowed));
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
