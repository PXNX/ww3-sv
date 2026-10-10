/*
 * The wave generator: a wave is a list of enemies. Soldiers are grouped in platoons that walk
 * close together (clumps are what mortars are for), with a gap between platoons; aerial enemies
 * are spread over the rest of the wave. From wave 6 on, every fourth wave also has a rush: a sudden
 * mass of soldiers pouring onto the road all at once (the time to call an airstrike). The same
 * seed always makes the same wave.
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
	/** Part of the sudden mass assault of this wave */
	rush?: boolean;
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
	runners: number;
	shields: number;
	btrs: number;
	buggies: number;
	medics: number;
	officers: number;
	sappers: number;
	tanks: number;
	platoons: number;
	shaheds: number;
	helis: number;
	bombers: number;
	swarms: number;
	/** Soldiers in the sudden mass assault (0 when the wave has none) */
	rush: number;
}

/** Whether the wave brings the sudden mass assault */
export function hasRush(wave: number): boolean {
	return wave >= 6 && (wave - 6) % 4 === 0;
}

/** `crowd` scales the enemy counts for maps with a longer road */
export function waveComposition(wave: number, crowd = 1): WaveComposition {
	const w = Math.max(1, Math.floor(wave));
	const scale = (count: number) => (count <= 0 ? 0 : Math.max(1, Math.round(count * crowd)));
	return {
		grunts: scale(6 + 2 * w),
		scouts: scale(w < 2 ? 0 : Math.min(2 + w, 20)),
		brutes: scale(w < 3 ? 0 : Math.floor((w - 1) / 2) + (w % 5 === 0 ? 2 : 0)),
		runners: scale(w < 4 ? 0 : Math.min(14, w - 1)),
		shields: scale(w < 5 ? 0 : Math.min(10, Math.floor((w - 3) / 2))),
		btrs: scale(w < 8 ? 0 : Math.min(5, 1 + Math.floor((w - 8) / 3))),
		buggies: scale(w < 5 ? 0 : Math.min(10, 1 + Math.floor((w - 5) / 2))),
		medics: scale(w < 6 ? 0 : Math.min(5, 1 + Math.floor((w - 6) / 3))),
		officers: scale(w < 7 ? 0 : Math.min(4, 1 + Math.floor((w - 7) / 4))),
		sappers: scale(w < 9 ? 0 : Math.min(8, 2 + Math.floor((w - 9) / 2))),
		tanks: scale(w < 12 ? 0 : Math.min(4, 1 + Math.floor((w - 12) / 3))),
		platoons: Math.min(6, 1 + Math.floor((w + 1) / 2)),
		shaheds: scale(w < 3 ? 0 : Math.min(8, 1 + Math.floor((w - 3) / 2))),
		helis: scale(w < 7 ? 0 : Math.min(5, 1 + Math.floor((w - 7) / 3))),
		bombers: scale(w < 10 ? 0 : Math.min(3, 1 + Math.floor((w - 10) / 5))),
		swarms: w < 6 || w % 3 !== 0 ? 0 : scale(Math.min(10, 3 + Math.floor(w / 3))),
		rush: hasRush(w) ? scale(Math.min(40, 6 + 2 * w)) : 0
	};
}

export function waveSize(wave: number, crowd = 1): number {
	const c = waveComposition(wave, crowd);
	return (
		c.grunts +
		c.scouts +
		c.brutes +
		c.runners +
		c.shields +
		c.btrs +
		c.buggies +
		c.medics +
		c.officers +
		c.sappers +
		c.tanks +
		c.shaheds +
		c.helis +
		c.bombers +
		c.swarms +
		c.rush
	);
}

/** Spacing inside a platoon and between platoons */
const CLUMP_GAP_MS: readonly [number, number] = [260, 480];
const PLATOON_GAP_MS: readonly [number, number] = [3200, 5200];
/** Spacing inside the mass assault: nearly all at once */
const RUSH_GAP_MS: readonly [number, number] = [90, 170];
/** The mass assault hits when this share of the ground troops has been sent */
const RUSH_AT = 0.55;
/** How long before the rush the player is warned */
export const RUSH_WARNING_MS = 4200;

const SPEED_SCALE: Record<EnemyKind, readonly [number, number]> = {
	scout: [0.92, 1.2],
	grunt: [0.88, 1.12],
	brute: [0.95, 1.05],
	runner: [0.9, 1.15],
	shield: [0.92, 1.1],
	btr: [0.95, 1.05],
	medic: [0.95, 1.05],
	officer: [0.95, 1.05],
	sapper: [0.92, 1.1],
	tank: [0.95, 1.05],
	buggy: [0.92, 1.08],
	shahed: [0.92, 1.12],
	heli: [0.95, 1.05],
	bomber: [0.95, 1.05],
	swarm: [0.9, 1.1]
};

/** Aerial enemies arrive between these shares of the time the soldiers take to appear */
const AIR_WINDOW: readonly [number, number] = [0.15, 0.9];

function between(random: Random, [min, max]: readonly [number, number]): number {
	return min + random() * (max - min);
}

const sideways = (random: Random) => Math.round((random() * 2 - 1) * 100) / 100;

const speedOf = (random: Random, kind: EnemyKind) =>
	Math.round(between(random, SPEED_SCALE[kind]) * 100) / 100;

/** The soldiers of the mass assault: mostly grunts, with runners, scouts and, later, brutes */
function rushSoldiers(random: Random, count: number, wave: number): SoldierKind[] {
	const brutes = Math.min(Math.floor(count / 8), Math.floor(wave / 5));
	const rest = count - brutes;
	const runners = Math.round(rest * 0.25);
	const scouts = Math.round(rest * 0.15);
	return shuffle(random, [
		...Array<SoldierKind>(rest - runners - scouts).fill('grunt'),
		...Array<SoldierKind>(runners).fill('runner'),
		...Array<SoldierKind>(scouts).fill('scout'),
		...Array<SoldierKind>(brutes).fill('brute')
	]);
}

export function generateWave(wave: number, random: Random, crowd = 1): SpawnEntry[] {
	const c = waveComposition(wave, crowd);
	// The heavy ones (brutes, armored cars, tanks) are shuffled in among the platoons but always
	// sit at the back of theirs
	const light: SoldierKind[] = shuffle(random, [
		...Array<SoldierKind>(c.grunts).fill('grunt'),
		...Array<SoldierKind>(c.scouts).fill('scout'),
		...Array<SoldierKind>(c.runners).fill('runner'),
		...Array<SoldierKind>(c.shields).fill('shield'),
		...Array<SoldierKind>(c.buggies).fill('buggy'),
		...Array<SoldierKind>(c.medics).fill('medic'),
		...Array<SoldierKind>(c.officers).fill('officer'),
		...Array<SoldierKind>(c.sappers).fill('sapper')
	]);
	const groups: SoldierKind[][] = Array.from({ length: c.platoons }, () => []);
	light.forEach((kind, index) => groups[index % c.platoons].push(kind));
	for (let i = 0; i < c.brutes; i++) groups[randomInt(random, 0, c.platoons)].push('brute');
	for (let i = 0; i < c.btrs; i++) groups[randomInt(random, 0, c.platoons)].push('btr');
	for (let i = 0; i < c.tanks; i++) groups[randomInt(random, 0, c.platoons)].push('tank');

	const entries: SpawnEntry[] = [];
	let at = 0;
	for (const group of groups) {
		for (const kind of group) {
			entries.push({
				atMs: Math.round(at),
				kind,
				speedScale: speedOf(random, kind),
				lane: sideways(random)
			});
			at += between(random, CLUMP_GAP_MS);
		}
		at += between(random, PLATOON_GAP_MS);
	}

	const span = entries.length > 0 ? entries[entries.length - 1].atMs : 0;

	// The mass assault is drawn after the platoons, so the platoons do not change when it does
	if (c.rush > 0) {
		let rushAt = Math.round(span * RUSH_AT);
		for (const kind of rushSoldiers(random, c.rush, wave)) {
			entries.push({
				atMs: Math.round(rushAt),
				kind,
				speedScale: speedOf(random, kind),
				lane: sideways(random),
				rush: true
			});
			rushAt += between(random, RUSH_GAP_MS);
		}
	}

	// Aerial enemies come after the soldiers are drawn, so the ground part of a wave does not
	// change when the air part does
	const air: FlyerKind[] = shuffle(random, [
		...Array<FlyerKind>(c.shaheds).fill('shahed'),
		...Array<FlyerKind>(c.helis).fill('heli'),
		...Array<FlyerKind>(c.bombers).fill('bomber')
	]);
	air.forEach((kind, index) => {
		const share =
			AIR_WINDOW[0] + ((AIR_WINDOW[1] - AIR_WINDOW[0]) * (index + random())) / air.length;
		entries.push({
			atMs: Math.round(span * share),
			kind,
			speedScale: speedOf(random, kind),
			lane: sideways(random),
			exitLane: sideways(random)
		});
	});
	// A cloud of swarm drones comes all together, from nearly the same spot
	if (c.swarms > 0) {
		const start = Math.round(span * (0.3 + random() * 0.4));
		const lane = sideways(random);
		const exit = sideways(random);
		for (let i = 0; i < c.swarms; i++) {
			entries.push({
				atMs: start + Math.round(i * between(random, [80, 200])),
				kind: 'swarm',
				speedScale: speedOf(random, 'swarm'),
				lane: Math.max(-1, Math.min(1, lane + (random() - 0.5) * 0.4)),
				exitLane: Math.max(-1, Math.min(1, exit + (random() - 0.5) * 0.5))
			});
		}
	}
	// Stable sort: soldiers keep their order, flyers slot in by time
	return entries.sort((a, b) => a.atMs - b.atMs);
}

/** When the sudden mass assault of a wave starts, or null when the wave has none */
export function rushStart(entries: readonly SpawnEntry[]): number | null {
	const first = entries.find((entry) => entry.rush);
	return first ? first.atMs : null;
}
