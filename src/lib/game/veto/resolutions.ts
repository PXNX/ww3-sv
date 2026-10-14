/*
 * The resolution generator. The draft texts themselves are translated messages (veto_res_01 to
 * veto_res_NN, see components/vetoText.ts) because the jokes cannot be assembled from word parts
 * in every language; this module only decides which one flashes next and what its draft number is.
 */
import { RECENT_MEMORY } from './config.js';
import { randomInt, type Random } from '../random.js';

/** How many silly draft resolutions exist (veto_res_01 ... veto_res_36) */
export const RESOLUTION_COUNT = 36;

export interface Resolution {
	/** Which of the draft texts, 0 to RESOLUTION_COUNT - 1 */
	index: number;
	/** The draft's four-digit number, shown on the paper */
	number: number;
}

/** Message key of a draft text, for example veto_res_07 */
export function resolutionKey(index: number): string {
	return `veto_res_${String(index + 1).padStart(2, '0')}`;
}

/** The draft number as printed, for example S/RES/4821 */
export function formatDraftNumber(number: number): string {
	return `S/RES/${number}`;
}

/**
 * Picks the next resolution: never one of the most recent ones, so the player does not see the
 * same joke twice in a row. `recent` lists earlier picks, newest last.
 */
export function generateResolution(random: Random, recent: readonly number[] = []): Resolution {
	const blocked = new Set(recent.slice(-Math.min(RECENT_MEMORY, RESOLUTION_COUNT - 1)));
	const free: number[] = [];
	for (let index = 0; index < RESOLUTION_COUNT; index++) {
		if (!blocked.has(index)) free.push(index);
	}
	const index = free[randomInt(random, 0, free.length)];
	return { index, number: randomInt(random, 1000, 10000) };
}
