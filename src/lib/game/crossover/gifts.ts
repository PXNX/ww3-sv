/*
 * Gifts between the games: something reached in one mode unlocks something in another. Every gift
 * names the game that earns it, a plain condition read from that game's own save, and the game that
 * receives it. The receiving game asks for its due gifts when it loads, applies them to its own
 * save, and marks them claimed in one shared list, so each gift arrives exactly once (and the list
 * travels with the cloud save). Conditions only ever grow, so a gift never becomes undone.
 */
import {
	SAVE_KEY as BEACHHEAD_SAVE_KEY,
	parseSave as parseBeachhead
} from '#lib/game/beachhead/campaign.js';
import { EMAILS, NETWORK } from '#lib/game/hackers/lore.js';
import { HACKERS_PROFILE_KEY, isProfile as isHackersProfile } from '#lib/game/hackers/profile.js';
import { parseProfile as parseRaid } from '#lib/game/raid/profile.js';
import type { Store } from '#lib/services/storage.js';

export type GiftId = 'prigo-hammer' | 'raid-veteran' | 'hackers-archive' | 'hackers-network';
export type GiftGame = 'beachhead' | 'raid' | 'hackers' | 'career';

export interface Gift {
	id: GiftId;
	from: GiftGame;
	to: GiftGame;
}

export const GIFTS: readonly Gift[] = [
	// Prigozhin trained up in Beachhead brings his hammer to the raids
	{ id: 'prigo-hammer', from: 'beachhead', to: 'raid' },
	// A seasoned raider sends crystals home to the beachhead
	{ id: 'raid-veteran', from: 'raid', to: 'beachhead' },
	// Every email of the cast read: the Supreme Leader pays in Fake News
	{ id: 'hackers-archive', from: 'hackers', to: 'career' },
	// Half the network found: a stash of free DogeLite for the hermit's bank
	{ id: 'hackers-network', from: 'hackers', to: 'hackers' }
];

/** Where the claimed gifts are listed */
export const CLAIMED_KEY = 'crossover:claimed';
/** The Beachhead hero level that sends the hammer */
export const PRIGO_HERO_LEVEL = 3;
export const RAID_VETERAN_RAIDS = 10;
export const NETWORK_GIFT_SYSTEMS = 3;
export const ARCHIVE_COINS = 300;
export const NETWORK_DOGELITE = 500;

/** What the conditions need, read from each game's save */
export interface CrossoverProgress {
	beachheadHeroLevel: number;
	raids: number;
	hackersMail: number;
	hackersNetwork: number;
}

export function readProgress(store: Store): CrossoverProgress {
	const beachhead = parseBeachhead(store.read<unknown>(BEACHHEAD_SAVE_KEY, null));
	const raid = parseRaid(store.read<unknown>('raid:profile', null));
	const hackers = store.read<unknown>(HACKERS_PROFILE_KEY, null);
	const profile = isHackersProfile(hackers) ? hackers : null;
	return {
		beachheadHeroLevel: beachhead?.hero.level ?? 0,
		raids: raid?.raids ?? 0,
		hackersMail: new Set(profile?.lore ?? []).size,
		hackersNetwork: new Set(profile?.network ?? []).size
	};
}

export function earned(id: GiftId, progress: CrossoverProgress): boolean {
	switch (id) {
		case 'prigo-hammer':
			return progress.beachheadHeroLevel >= PRIGO_HERO_LEVEL;
		case 'raid-veteran':
			return progress.raids >= RAID_VETERAN_RAIDS;
		case 'hackers-archive':
			return progress.hackersMail >= EMAILS.length;
		case 'hackers-network':
			return progress.hackersNetwork >= Math.min(NETWORK_GIFT_SYSTEMS, NETWORK.length);
	}
}

export function claimedGifts(store: Store): GiftId[] {
	const value = store.read<unknown>(CLAIMED_KEY, []);
	if (!Array.isArray(value)) return [];
	return value.filter((id): id is GiftId => GIFTS.some((gift) => gift.id === id));
}

/** The gifts a game should receive now: earned and not claimed yet */
export function dueGifts(
	game: GiftGame,
	progress: CrossoverProgress,
	claimed: readonly GiftId[]
): GiftId[] {
	return GIFTS.filter(
		(gift) => gift.to === game && !claimed.includes(gift.id) && earned(gift.id, progress)
	).map((gift) => gift.id);
}

/** Marks gifts as received */
export function markClaimed(store: Store, ids: readonly GiftId[]): void {
	if (ids.length === 0) return;
	store.write(CLAIMED_KEY, [...new Set([...claimedGifts(store), ...ids])]);
}
