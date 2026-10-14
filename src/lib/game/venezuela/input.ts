/*
 * Held-button bookkeeping. Several things can press the same button at once (a finger on the
 * on-screen zone and a key on the keyboard, or two fingers, since moving and jumping are held at
 * the same time), so each press is remembered under its own source and a button counts as down while
 * any source still holds it.
 */
import type { Input } from './player';

export type Action = 'left' | 'right' | 'jump' | 'slam';

export class HeldInput {
	#held = new Map<Action, Set<string>>();
	#jumpPressed = false;
	#slamPressed = false;

	/** A source (a pointer id or a key code) presses or releases an action */
	set(source: string, action: Action, down: boolean) {
		let sources = this.#held.get(action);
		if (!sources) {
			sources = new Set();
			this.#held.set(action, sources);
		}
		if (down) {
			if (sources.size === 0 && action === 'jump') this.#jumpPressed = true;
			if (sources.size === 0 && action === 'slam') this.#slamPressed = true;
			sources.add(source);
		} else {
			sources.delete(source);
		}
	}

	isDown(action: Action): boolean {
		return (this.#held.get(action)?.size ?? 0) > 0;
	}

	/** The input for the next step; reading it uses up the "jump/slam was pressed" edges */
	read(): Input {
		const left = this.isDown('left');
		const right = this.isDown('right');
		const move = left === right ? 0 : right ? 1 : -1;
		const input: Input = { move, jumpHeld: this.isDown('jump'), jumpPressed: this.#jumpPressed };
		if (this.#slamPressed) input.slamPressed = true;
		this.#jumpPressed = false;
		this.#slamPressed = false;
		return input;
	}

	/** Lets go of everything, for example when the game pauses or the tab is hidden */
	clear() {
		this.#held.clear();
		this.#jumpPressed = false;
		this.#slamPressed = false;
	}
}

/** The action a keyboard key stands for, if any */
export const KEY_ACTIONS: Readonly<Record<string, Action>> = {
	ArrowLeft: 'left',
	KeyA: 'left',
	ArrowRight: 'right',
	KeyD: 'right',
	ArrowUp: 'jump',
	KeyW: 'jump',
	Space: 'jump',
	ArrowDown: 'slam',
	KeyS: 'slam'
};
