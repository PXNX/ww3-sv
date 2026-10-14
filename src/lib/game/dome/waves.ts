/*
 * Wave generator: every wave is a seeded list of rocket launches. Waves bring more rockets, faster
 * flights and shorter gaps, with a growing share of fast rockets and of rockets that land
 * harmlessly in the sea or a field (decoys for your interceptors).
 */
import {
	FAST_FACTOR,
	FAST_SHARE_END,
	FAST_SHARE_START,
	FIELD_START,
	HARMLESS_SHARE_END,
	HARMLESS_SHARE_START,
	SEA_END,
	TARGETS,
	WORLD_WIDTH
} from './config.js';
import { pickWeighted, type Random } from '#lib/game/random.js';
import { highestPoint, type Flight } from './trajectory.js';

export type RocketKind = 'normal' | 'fast';

export interface WaveParams {
	count: number;
	/** Flight time of a normal rocket */
	flightMs: number;
	/** Average time between launches */
	gapMs: number;
	harmlessShare: number;
	fastShare: number;
}

export interface Spawn {
	/** Time after the wave starts */
	atMs: number;
	kind: RocketKind;
	flight: Flight;
	/** Index into TARGETS of the building it is aimed at, or null when it lands harmlessly */
	targetIndex: number | null;
}

/** Waves after this one stop getting harder in the ramped values (the count keeps its own cap) */
const RAMP_WAVES = 12;
const MAX_COUNT = 30;
/** Arcs stay at least this far below the top edge */
const TOP_MARGIN = 10;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export function waveParams(wave: number): WaveParams {
	const n = Math.max(1, Math.floor(wave));
	const ramp = Math.min(1, (n - 1) / (RAMP_WAVES - 1));
	return {
		count: Math.min(MAX_COUNT, 4 + 2 * n),
		flightMs: Math.max(3000, 8800 - 480 * (n - 1)),
		gapMs: Math.max(480, 1700 - 100 * (n - 1)),
		harmlessShare: lerp(HARMLESS_SHARE_START, HARMLESS_SHARE_END, ramp),
		fastShare: lerp(FAST_SHARE_START, FAST_SHARE_END, ramp)
	};
}

/** A landing column that hits nothing: the sea or the field */
function harmlessImpact(random: Random): number {
	if (random() < 0.5) return 16 + random() * (SEA_END - 32);
	return FIELD_START + 16 + random() * (WORLD_WIDTH - FIELD_START - 32);
}

function buildFlight(impactX: number, flightMs: number, random: Random): Flight {
	// Rockets come in from either side, whichever gives a clearly visible arc
	let startX = random() < 0.5 ? -24 : WORLD_WIDTH + 24;
	if (Math.abs(impactX - startX) < 180) startX = impactX < WORLD_WIDTH / 2 ? WORLD_WIDTH + 24 : -24;
	const startY = 20 + random() * 90;
	const flight: Flight = {
		startX,
		startY,
		impactX,
		lift: 70 + random() * 90,
		flightMs
	};
	while (highestPoint(flight) < TOP_MARGIN && flight.lift > 10) flight.lift *= 0.9;
	return flight;
}

/** Plans the launches of one wave, in time order */
export function planWave(wave: number, random: Random): Spawn[] {
	const params = waveParams(wave);
	const spawns: Spawn[] = [];
	let atMs = 0;
	for (let i = 0; i < params.count; i++) {
		const harmless = random() < params.harmlessShare;
		let targetIndex: number | null = null;
		let impactX: number;
		if (harmless) {
			impactX = harmlessImpact(random);
		} else {
			targetIndex = pickWeighted(
				random,
				TARGETS.map((target, index) => ({ item: index, weight: target.weight }))
			);
			const target = TARGETS[targetIndex];
			impactX = target.x + (random() * 2 - 1) * target.halfWidth * 0.7;
		}
		const kind: RocketKind = random() < params.fastShare ? 'fast' : 'normal';
		const jitter = 0.9 + random() * 0.25;
		const flightMs = Math.round(params.flightMs * jitter * (kind === 'fast' ? FAST_FACTOR : 1));
		spawns.push({
			atMs: Math.round(atMs),
			kind,
			flight: buildFlight(impactX, flightMs, random),
			targetIndex
		});
		// Now and then a rocket follows right behind the last one (a salvo)
		const salvo = wave >= 2 && random() < 0.18;
		atMs += salvo ? params.gapMs * 0.15 : params.gapMs * (0.6 + random() * 0.8);
	}
	return spawns;
}
