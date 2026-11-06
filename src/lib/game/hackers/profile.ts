/*
 * The unit's profile, kept between runs in local storage: the DogeLite bank that survived the last
 * runs, the hardware bought with it, and the addresses marked as favourites in the target list.
 * Software is per-run on purpose; this file only holds what a hermit carries from one night to the
 * next. Everything here is pure, so the store can stay thin.
 */
import { isFiniteNumber } from '#lib/services/storage.js';
import {
	emptyHardware,
	hardwareCost,
	hardwareSpec,
	isHardware,
	type Hardware,
	type HardwareId
} from './hardware.js';
import { emptyBotnet, type Botnet } from './botnet.js';

export interface HackersProfile {
	/** DogeLite left over from finished runs */
	bank: number;
	/** The unit's own machine */
	hardware: Hardware;
	/** Botnet + data from previous runs */
	botnet: Botnet;
	/** Addresses marked in the target list */
	favorites: string[];
	/** Ids of the cast's emails read on bank desktops, the hermit's lore archive */
	lore?: number[];
	/** Systems of the cast's wider network whose link was followed */
	network?: string[];
}

/** Key of the stored profile, without the local storage prefix */
export const HACKERS_PROFILE_KEY = 'hackers:profile';

export function defaultProfile(): HackersProfile {
	return { bank: 0, hardware: emptyHardware(), botnet: emptyBotnet(), favorites: [] };
}

export function isProfile(value: unknown): value is HackersProfile {
	if (!value || typeof value !== 'object') return false;
	const profile = value as Record<string, unknown>;
	return (
		isFiniteNumber(profile.bank) &&
		profile.bank >= 0 &&
		isHardware(profile.hardware) &&
		(profile.botnet === undefined ||
			(typeof profile.botnet === 'object' &&
				typeof (profile.botnet as Record<string, unknown>).nodes === 'number')) &&
		Array.isArray(profile.favorites) &&
		profile.favorites.every((ip) => typeof ip === 'string') &&
		(profile.lore === undefined ||
			(Array.isArray(profile.lore) && profile.lore.every((id) => Number.isInteger(id)))) &&
		(profile.network === undefined ||
			(Array.isArray(profile.network) && profile.network.every((id) => typeof id === 'string')))
	);
}

/** Puts what a finished run earned into the bank */
export function bankRun(profile: HackersProfile, score: number): HackersProfile {
	if (!Number.isFinite(score) || score <= 0) return profile;
	return { ...profile, bank: profile.bank + Math.floor(score) };
}

/** What the next level of a part costs for this profile; null once it is maxed */
export function nextHardwareCost(profile: HackersProfile, id: HardwareId): number | null {
	return hardwareCost(id, profile.hardware[id]);
}

/** Buys a level of hardware from the bank; null when it is maxed or too expensive */
export function buyHardware(profile: HackersProfile, id: HardwareId): HackersProfile | null {
	const cost = nextHardwareCost(profile, id);
	if (cost === null || profile.bank < cost) return null;
	return {
		...profile,
		bank: profile.bank - cost,
		hardware: { ...profile.hardware, [id]: profile.hardware[id] + 1 }
	};
}

/** Remaining headroom before the part is maxed */
export function hardwareMaxed(profile: HackersProfile, id: HardwareId): boolean {
	return profile.hardware[id] >= hardwareSpec(id).maxLevel;
}

export function isFavorite(profile: HackersProfile, ip: string): boolean {
	return profile.favorites.includes(ip);
}

/** Adds a botnet node from data */
export function addBotnetNode(profile: HackersProfile, dataCost: number): HackersProfile | null {
	if (profile.botnet.data < dataCost) return null;
	return {
		...profile,
		botnet: {
			...profile.botnet,
			nodes: profile.botnet.nodes + 1,
			data: profile.botnet.data - dataCost
		}
	};
}

/** Marks or unmarks an address, keeping the rest of the list in order */
export function toggleFavorite(profile: HackersProfile, ip: string): HackersProfile {
	if (ip.length === 0) return profile;
	return {
		...profile,
		favorites: isFavorite(profile, ip)
			? profile.favorites.filter((entry) => entry !== ip)
			: [...profile.favorites, ip]
	};
}
