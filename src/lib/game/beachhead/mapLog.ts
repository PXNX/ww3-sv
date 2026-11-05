/*
 * The log on the sea chart: when the enemy will retake the next of your islands, and what is going on
 * out on the water. Two kinds of lines share it. The ambient ones (raiders landing, other commanders
 * attacking or taking islands) are generated from the clock so they are the same on every visit
 * within the same stretch of time; they are scenery. The real ones come from the bot's server when
 * the game runs in Telegram: other players who raided your base or were beaten off, and the bases you
 * raided yourself. Every line names the place it happened, so a tap can fly the chart there.
 */
import { TAKEBACK_INTERVAL_MS, type Resources } from './campaign.js';

/** Where a line happened: an island by its index, or your own home bay */
export type LogPlace = number | 'home';

export type LogEvent =
	| { kind: 'raiders'; island: LogPlace; atMs: number; id?: string }
	| { kind: 'attack'; player: string; island: LogPlace; atMs: number; id?: string }
	| { kind: 'taken'; player: string; island: LogPlace; atMs: number; id?: string }
	/** Another commander raided your own base and got away with part of the stock */
	| {
			kind: 'raided';
			player: string;
			island: LogPlace;
			atMs: number;
			id?: string;
			loot?: Resources;
	  }
	/** Another commander attacked your base and was beaten off */
	| { kind: 'defended'; player: string; island: LogPlace; atMs: number; id?: string }
	/** You raided another commander's base */
	| {
			kind: 'plundered';
			player: string;
			island: LogPlace;
			atMs: number;
			id?: string;
			loot?: Resources;
	  };

const PLAYERS = [
	'Admiral K.',
	'Vasco',
	'Mira Blue',
	'Commodore Oak',
	'Seagull_7',
	'Big Hodor',
	'Nadja'
];
/** A new ambient line every this long */
const SLICE_MS = 40 * 60 * 1000;

function hash(value: number): number {
	let x = (value ^ 0x9e3779b9) >>> 0;
	x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
	x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
	return (x ^ (x >>> 16)) >>> 0;
}

/** When the next of your islands falls, or null when you hold none */
export function nextRetakeAt(lastTakebackMs: number, controlled: number): number | null {
	return controlled > 0 ? lastTakebackMs + TAKEBACK_INTERVAL_MS : null;
}

/** The newest ambient lines, newest first; only about other islands, never your own base */
export function ambientEvents(nowMs: number, islandCount: number, count = 5): LogEvent[] {
	const events: LogEvent[] = [];
	const slice = Math.floor(nowMs / SLICE_MS);
	for (let back = 0; back < count; back++) {
		const index = slice - back;
		const seed = hash(index);
		const atMs = index * SLICE_MS + (seed % SLICE_MS);
		if (atMs > nowMs) continue;
		const island = (seed >>> 5) % Math.max(1, islandCount);
		const player = PLAYERS[(seed >>> 9) % PLAYERS.length];
		const kinds = ['raiders', 'attack', 'taken'] as const;
		const kind = kinds[(seed >>> 13) % kinds.length];
		const id = `ambient-${index}`;
		events.push(
			kind === 'raiders' ? { kind, island, atMs, id } : { kind, player, island, atMs, id }
		);
	}
	return events.sort((a, b) => b.atMs - a.atMs);
}

/** Real lines first in time order with the scenery mixed in, newest first, at most `limit` */
export function mergeLog(real: readonly LogEvent[], ambient: readonly LogEvent[], limit = 6) {
	return [...real, ...ambient].sort((a, b) => b.atMs - a.atMs).slice(0, limit);
}

/** Whether a line is about you: it is coloured and tapping it opens your base */
export function isPersonal(event: LogEvent): boolean {
	return event.kind === 'raided' || event.kind === 'defended' || event.kind === 'plundered';
}

/** How long ago something happened, as a compact `5m`, `3h` or `2d` */
export function ago(nowMs: number, atMs: number): string {
	const minutes = Math.max(0, Math.floor((nowMs - atMs) / 60_000));
	if (minutes < 60) return `${Math.max(1, minutes)}m`;
	const hours = Math.floor(minutes / 60);
	return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
