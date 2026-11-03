/*
 * The log on the sea chart: when the enemy will retake the next of your islands, and what is going on
 * out on the water. The ambient lines (raiders landing, other commanders attacking or taking islands)
 * are generated from the clock so they are the same on every visit within the same stretch of time.
 * They are scenery for now, not a feed of real players.
 */
import { TAKEBACK_INTERVAL_MS } from './campaign.js';

export type LogEvent =
	| { kind: 'raiders'; island: number; atMs: number }
	| { kind: 'attack'; player: string; island: number; atMs: number }
	| { kind: 'taken'; player: string; island: number; atMs: number };

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

/** The newest ambient lines, newest first */
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
		const roll = (seed >>> 13) % 3;
		events.push(
			roll === 0
				? { kind: 'raiders', island, atMs }
				: roll === 1
					? { kind: 'attack', player, island, atMs }
					: { kind: 'taken', player, island, atMs }
		);
	}
	return events.sort((a, b) => b.atMs - a.atMs);
}
