/*
 * Saving and loading the idle game. The save is a small versioned JSON object in local storage.
 * Loading never trusts it: anything that is not a plain object of the current version with sane
 * numbers is treated as no save at all, unknown ids are dropped and counts are clamped, so a
 * corrupt or hand-edited save cannot break the game.
 */
import type { Random } from '#lib/game/random.js';
import type { Store } from '#lib/services/storage.js';
import { MAX_OWNED, PRODUCER_IDS, ACHIEVEMENTS, UPGRADES } from './config.js';
import { createState } from './state.js';
import type { TycoonState } from './types.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'tycoon:save';

export interface SaveData {
	version: number;
	/** When the game was last saved, in milliseconds since 1970 (decides the offline progress) */
	savedAt: number;
	barrels: number;
	runTotal: number;
	lifetime: number;
	taps: number;
	owned: Record<string, number>;
	upgrades: string[];
	prestigePoints: number;
	prestiges: number;
	achievements: string[];
	eventsHandled: number;
	sanctionsEvaded: number;
}

export function serialize(state: TycoonState, now: number): SaveData {
	return {
		version: SAVE_VERSION,
		savedAt: now,
		barrels: state.barrels,
		runTotal: state.runTotal,
		lifetime: state.lifetime,
		taps: state.taps,
		owned: { ...state.owned },
		upgrades: [...state.upgrades],
		prestigePoints: state.prestigePoints,
		prestiges: state.prestiges,
		achievements: [...state.achievements],
		eventsHandled: state.eventsHandled,
		sanctionsEvaded: state.sanctionsEvaded
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A finite number of at least zero, or undefined */
function amount(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function knownIds(value: unknown, known: readonly string[]): string[] {
	if (!Array.isArray(value)) return [];
	const wanted = new Set(value);
	return known.filter((id) => wanted.has(id));
}

/** Steps an older save up to the current version; undefined when it cannot be read */
function migrate(raw: Record<string, unknown>): Record<string, unknown> | undefined {
	if (raw.version === SAVE_VERSION) return raw;
	// Future versions (or no version at all) are not understood: better a fresh start than a guess
	return undefined;
}

/**
 * Turns whatever was in storage into a game state, or null when it is not a usable save.
 * The random source is only used to schedule the first crisis.
 */
export function parseSave(
	raw: unknown,
	random: Random
): { state: TycoonState; savedAt: number } | null {
	if (!isRecord(raw)) return null;
	const data = migrate(raw);
	if (!data) return null;

	const savedAt = amount(data.savedAt);
	const barrels = amount(data.barrels);
	const runTotal = amount(data.runTotal);
	const lifetime = amount(data.lifetime);
	if (savedAt === undefined || barrels === undefined) return null;
	if (runTotal === undefined || lifetime === undefined) return null;

	const state = createState(random);
	state.barrels = barrels;
	// Totals can never be lower than what is in the bank
	state.runTotal = Math.max(runTotal, barrels);
	state.lifetime = Math.max(lifetime, state.runTotal);
	state.taps = Math.floor(amount(data.taps) ?? 0);
	state.prestigePoints = Math.floor(amount(data.prestigePoints) ?? 0);
	state.prestiges = Math.floor(amount(data.prestiges) ?? 0);
	state.eventsHandled = Math.floor(amount(data.eventsHandled) ?? 0);
	state.sanctionsEvaded = Math.floor(amount(data.sanctionsEvaded) ?? 0);

	const owned = isRecord(data.owned) ? data.owned : {};
	for (const id of PRODUCER_IDS) {
		state.owned[id] = Math.min(MAX_OWNED, Math.floor(amount(owned[id]) ?? 0));
	}
	state.upgrades = knownIds(
		data.upgrades,
		UPGRADES.map((upgrade) => upgrade.id)
	);
	state.achievements = knownIds(
		data.achievements,
		ACHIEVEMENTS.map((achievement) => achievement.id)
	);
	return { state, savedAt };
}

export function writeSave(store: Store, state: TycoonState, now: number): boolean {
	return store.write(SAVE_KEY, serialize(state, now));
}

/** Reads the saved game; null when there is none or it is unusable */
export function readSave(
	store: Store,
	random: Random
): { state: TycoonState; savedAt: number } | null {
	return parseSave(store.read<unknown>(SAVE_KEY, null), random);
}

export function clearSave(store: Store): void {
	store.remove(SAVE_KEY);
}
