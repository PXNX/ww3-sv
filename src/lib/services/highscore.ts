/*
 * Personal bests, stored locally and kept separately per mode (and per variant, such as a
 * difficulty level). Keys are built from parts, for example ['minefield', 'hard', 'time'].
 */
import { isFiniteNumber, localStore, type Store } from './storage';

export type BestDirection = 'higher' | 'lower';

export interface BestResult {
	isNewBest: boolean;
	best: number | null;
	previous: number | null;
}

export interface Highscores {
	get(parts: readonly string[]): number | null;
	submit(parts: readonly string[], value: number, direction?: BestDirection): BestResult;
}

export function bestKey(parts: readonly string[]): string {
	return ['best', ...parts].join(':');
}

export function createHighscores(store: Store): Highscores {
	const get = (parts: readonly string[]) =>
		store.read<number | null>(bestKey(parts), null, isFiniteNumber);

	return {
		get,
		submit(parts, value, direction = 'higher') {
			const previous = get(parts);
			if (!Number.isFinite(value)) return { isNewBest: false, best: previous, previous };

			const isNewBest =
				previous === null
					? // A first game only counts as a best if something was actually scored
						direction === 'lower' || value > 0
					: direction === 'higher'
						? value > previous
						: value < previous;

			if (!isNewBest) return { isNewBest, best: previous, previous };
			store.write(bestKey(parts), value);
			return { isNewBest, best: value, previous };
		}
	};
}

let shared: Highscores | undefined;

export function highscores(): Highscores {
	shared ??= createHighscores(localStore());
	return shared;
}
