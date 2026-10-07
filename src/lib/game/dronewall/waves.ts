/*
 * The wave generator: a wave is a list of enemies. Soldiers are grouped in platoons that walk
 * close together (clumps are what mortars are for), with a gap between platoons; aerial enemies
 * are spread over the rest of the wave. The same seed always makes the same wave.
 */
import { randomInt, shuffle, type Random } from '#lib/game/random.js';
import { isFlyerKind, type EnemyKind, type FlyerKind, type SoldierKind } from './config';

interface SpawnBase {
	/** Time since the wave started */
	atMs: number;
	/** Multiplier on the enemy's speed, so a crowd does not march in lockstep */
	speedScale: number;
	/** Sideways position on the road (soldiers) or where the flight enters (flyers), -1 to 1 */
	lane: number;
}

export interface SoldierSpawn extends SpawnBase {
	kind: SoldierKind;
}

export interface FlyerSpawn extends SpawnBase {
	kind: FlyerKind;
	/** Where the flight ends on the line, from -1 to 1 */
	exitLane: number;
}

export type SpawnEntry = SoldierSpawn | FlyerSpawn;

export function isFlyerSpawn(entry: SpawnEntry): entry is FlyerSpawn {
	return isFlyerKind(entry.kind);
}

export interface WaveComposition {
	grunts: number;
	scouts: number;
	brutes: number;
	platoons: number;
	shaheds: number;
	helis: number;
}

export function waveComposition(wave: number): WaveComposition {
	const w = Math.max(1, Math.floor(wave));
	return {
		grunts: 6 + 2 * w,
		scouts: w < 2 ? 0 : Math.min(2 + w, 20),
		brutes: w < 3 ? 0 : Math.floor((w - 1) / 2) + (w % 5 === 0 ? 2 : 0),
		platoons: Math.min(6, 1 + Math.floor((w + 1) / 2)),
		shaheds: w < 3 ? 0 : Math.min(8, 1 + Math.floor((w - 3) / 2)),
		helis: w < 7 ? 0 : Math.min(5, 1 + Math.floor((w - 7) / 3))
	};
}

export function waveSize(wave: number): number {
	const { grunts, scouts, brutes, shaheds, helis } = waveComposition(wave);
	return grunts + scouts + brutes + shaheds + helis;
}

/** Spacing inside a platoon and between platoons */
const CLUMP_GAP_MS: readonly [number, number] = [260, 480];
const PLATOON_GAP_MS: readonly [number, number] = [3200, 5200];

const SPEED_SCALE: Record<EnemyKind, readonly [number, number]> = {
	scout: [0.92, 1.2],
	grunt: [0.88, 1.12],
	brute: [0.95, 1.05],
	shahed: [0.92, 1.12],
	heli: [0.95, 1.05]
};

/** Aerial enemies arrive between these shares of the time the soldiers take to appear */
const AIR_WINDOW: readonly [number, number] = [0.15, 0.9];

function between(random: Random, [min, max]: readonly [number, number]): number {
	return min + random() * (max - min);
}

const sideways = (random: Random) => Math.round((random() * 2 - 1) * 100) / 100;

export function generateWave(wave: number, random: Random): SpawnEntry[] {
	const { grunts, scouts, brutes, platoons, shaheds, helis } = waveComposition(wave);
	// Brutes are shuffled in among the others but always sit at the back of their platoon
	const light: SoldierKind[] = shuffle(random, [
		...Array<SoldierKind>(grunts).fill('grunt'),
		...Array<SoldierKind>(scouts).fill('scout')
	]);
	const groups: SoldierKind[][] = Array.from({ length: platoons }, () => []);
	light.forEach((kind, index) => groups[index % platoons].push(kind));
	for (let i = 0; i < brutes; i++) groups[randomInt(random, 0, platoons)].push('brute');

	const entries: SpawnEntry[] = [];
	let at = 0;
	for (const group of groups) {
		for (const kind of group) {
			entries.push({
				atMs: Math.round(at),
				kind,
				speedScale: Math.round(between(random, SPEED_SCALE[kind]) * 100) / 100,
				lane: sideways(random)
			});
			at += between(random, CLUMP_GAP_MS);
		}
		at += between(random, PLATOON_GAP_MS);
	}

	// Aerial enemies come after the soldiers are drawn, so the ground part of a wave does not
	// change when the air part does
	const span = entries.length > 0 ? entries[entries.length - 1].atMs : 0;
	const air: FlyerKind[] = shuffle(random, [
		...Array<FlyerKind>(shaheds).fill('shahed'),
		...Array<FlyerKind>(helis).fill('heli')
	]);
	air.forEach((kind, index) => {
		const share =
			AIR_WINDOW[0] + ((AIR_WINDOW[1] - AIR_WINDOW[0]) * (index + random())) / air.length;
		entries.push({
			atMs: Math.round(span * share),
			kind,
			speedScale: Math.round(between(random, SPEED_SCALE[kind]) * 100) / 100,
			lane: sideways(random),
			exitLane: sideways(random)
		});
	});
	// Stable sort: soldiers keep their order, flyers slot in by time
	return entries.sort((a, b) => a.atMs - b.atMs);
}
