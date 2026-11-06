/*
 * Hands out the gifts between the games (game/crossover/gifts.ts) and remembers the ones just
 * received, so the toast in the layout can say where they came from. A game calls `receive` when
 * it loads; its callback applies each gift to its own save and says which ones it really took (a
 * full stash, for example, leaves the gift waiting for the next visit).
 */
import {
	claimedGifts,
	dueGifts,
	markClaimed,
	readProgress,
	type GiftGame,
	type GiftId
} from '#lib/game/crossover/gifts.js';
import { localStore, type Store } from '#lib/services/storage.js';

class CrossoverStore {
	/** Gifts that arrived during this visit and were not dismissed yet */
	received = $state<GiftId[]>([]);

	announce(ids: readonly GiftId[]) {
		if (ids.length > 0) this.received = [...this.received, ...ids];
	}

	dismiss() {
		this.received = [];
	}
}

let shared: CrossoverStore | undefined;

export function crossover(): CrossoverStore {
	shared ??= new CrossoverStore();
	return shared;
}

/** Applies the due gifts of one game; `apply` returns the ids it actually took */
export function receive(
	game: GiftGame,
	apply: (ids: GiftId[]) => GiftId[],
	store: Store = localStore()
): GiftId[] {
	const due = dueGifts(game, readProgress(store), claimedGifts(store));
	if (due.length === 0) return [];
	const taken = apply(due);
	markClaimed(store, taken);
	if (typeof window !== 'undefined') crossover().announce(taken);
	return taken;
}
