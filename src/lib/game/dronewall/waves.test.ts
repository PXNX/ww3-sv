import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { generateWave, hasRush, isFlyerSpawn, rushStart, waveComposition, waveSize } from './waves';

/** Entries of a kind, not counting the soldiers of the mass assault */
const count = (wave: number, kind: string, crowd = 1) =>
	generateWave(wave, createRandom(5), crowd).filter((entry) => entry.kind === kind && !entry.rush)
		.length;

/** The soldiers of a wave: the platoons, without the aircraft and the mass assault */
const ground = (wave: number, seed: number) =>
	generateWave(wave, createRandom(seed)).filter((entry) => !isFlyerSpawn(entry) && !entry.rush);

/** The size of a wave without its mass assault */
const platoonSize = (wave: number) => waveSize(wave) - waveComposition(wave).rush;

describe('wave generator', () => {
	it('makes the same wave for the same seed and a different one for another seed', () => {
		expect(generateWave(4, createRandom(7))).toEqual(generateWave(4, createRandom(7)));
		expect(generateWave(4, createRandom(7))).not.toEqual(generateWave(4, createRandom(8)));
	});

	it('matches the composition for every wave', () => {
		for (let wave = 1; wave <= 12; wave++) {
			const composition = waveComposition(wave);
			expect(count(wave, 'grunt')).toBe(composition.grunts);
			expect(count(wave, 'scout')).toBe(composition.scouts);
			expect(count(wave, 'brute')).toBe(composition.brutes);
			expect(count(wave, 'runner')).toBe(composition.runners);
			expect(count(wave, 'shield')).toBe(composition.shields);
			expect(count(wave, 'btr')).toBe(composition.btrs);
			expect(count(wave, 'shahed')).toBe(composition.shaheds);
			expect(count(wave, 'heli')).toBe(composition.helis);
			expect(count(wave, 'buggy')).toBe(composition.buggies);
			expect(count(wave, 'medic')).toBe(composition.medics);
			expect(count(wave, 'officer')).toBe(composition.officers);
			expect(count(wave, 'sapper')).toBe(composition.sappers);
			expect(count(wave, 'tank')).toBe(composition.tanks);
			expect(count(wave, 'bomber')).toBe(composition.bombers);
			expect(count(wave, 'swarm')).toBe(composition.swarms);
			expect(generateWave(wave, createRandom(5))).toHaveLength(waveSize(wave));
		}
	});

	it('starts gently: wave 1 is only grunts, scouts come at wave 2, brutes at wave 3', () => {
		expect(waveComposition(1)).toMatchObject({ scouts: 0, brutes: 0 });
		expect(waveComposition(2).scouts).toBeGreaterThan(0);
		expect(waveComposition(2).brutes).toBe(0);
		expect(waveComposition(3).brutes).toBeGreaterThan(0);
	});

	it('grows from wave to wave', () => {
		for (let wave = 1; wave < 15; wave++) {
			expect(platoonSize(wave + 1)).toBeGreaterThan(platoonSize(wave));
		}
	});

	it('spawns in time order, starting at zero', () => {
		const entries = generateWave(6, createRandom(3));
		expect(entries[0].atMs).toBe(0);
		for (let i = 1; i < entries.length; i++) {
			expect(entries[i].atMs).toBeGreaterThanOrEqual(entries[i - 1].atMs);
		}
	});

	it('walks in clumps: platoons are separated by clear gaps', () => {
		const entries = ground(6, 3);
		const gaps = entries.slice(1).map((entry, i) => entry.atMs - entries[i].atMs);
		const big = gaps.filter((gap) => gap > 2500);
		expect(big.length).toBe(waveComposition(6).platoons - 1);
		for (const gap of gaps.filter((gap) => gap <= 2500)) expect(gap).toBeLessThan(600);
	});

	it('varies speeds and lanes within bounds', () => {
		const entries = generateWave(8, createRandom(11));
		const speeds = new Set(entries.map((entry) => entry.speedScale));
		expect(speeds.size).toBeGreaterThan(5);
		for (const entry of entries) {
			expect(entry.speedScale).toBeGreaterThan(0.8);
			expect(entry.speedScale).toBeLessThan(1.25);
			expect(Math.abs(entry.lane)).toBeLessThanOrEqual(1);
		}
	});

	it('puts the heavy ones (brutes, armored cars) at the back of their platoon', () => {
		const heavy = (kind: string) => kind === 'brute' || kind === 'btr' || kind === 'tank';
		for (const seed of [2, 5, 9]) {
			const entries = ground(12, seed);
			const platoonStarts = [0];
			entries.forEach((entry, i) => {
				if (i > 0 && entry.atMs - entries[i - 1].atMs > 2500) platoonStarts.push(i);
			});
			platoonStarts.push(entries.length);
			for (let p = 0; p < platoonStarts.length - 1; p++) {
				const kinds = entries.slice(platoonStarts[p], platoonStarts[p + 1]).map((e) => e.kind);
				const firstHeavy = kinds.findIndex(heavy);
				if (firstHeavy >= 0) expect(kinds.slice(firstHeavy).every(heavy)).toBe(true);
			}
		}
	});

	it('brings new enemies over time: runners from wave 4, shields from 5, armored cars from 8', () => {
		expect(waveComposition(3)).toMatchObject({ runners: 0, shields: 0, btrs: 0 });
		expect(waveComposition(4).runners).toBeGreaterThan(0);
		expect(waveComposition(4).shields).toBe(0);
		expect(waveComposition(5).shields).toBeGreaterThan(0);
		expect(waveComposition(7).btrs).toBe(0);
		expect(waveComposition(8).btrs).toBeGreaterThan(0);
	});

	it('brings aircraft from wave 3 and helicopters from wave 7', () => {
		expect(waveComposition(2).shaheds).toBe(0);
		expect(waveComposition(3).shaheds).toBeGreaterThan(0);
		expect(waveComposition(6).helis).toBe(0);
		expect(waveComposition(7).helis).toBeGreaterThan(0);
	});

	it('leaves the ground part of a wave alone when aircraft join', () => {
		const ground3 = ground(3, 9).map((entry) => entry.atMs);
		const all = generateWave(3, createRandom(9));
		expect(all.filter((entry) => !isFlyerSpawn(entry)).map((entry) => entry.atMs)).toEqual(ground3);
	});

	it('spreads aircraft over the wave, on flight lines inside the field', () => {
		const entries = generateWave(10, createRandom(4));
		const air = entries.filter(isFlyerSpawn);
		const c = waveComposition(10);
		expect(air.length).toBe(c.shaheds + c.helis + c.bombers + c.swarms);
		const lastGround = ground(10, 4).at(-1)!.atMs;
		for (const flyer of air) {
			expect(flyer.atMs).toBeGreaterThan(0);
			expect(flyer.atMs).toBeLessThan(lastGround);
			expect(Math.abs(flyer.exitLane)).toBeLessThanOrEqual(1);
		}
	});
});

describe('new enemies and the mass assault', () => {
	it('brings support and heavy troops over time', () => {
		expect(waveComposition(5).buggies).toBeGreaterThan(0);
		expect(waveComposition(5).medics).toBe(0);
		expect(waveComposition(6).medics).toBeGreaterThan(0);
		expect(waveComposition(6).officers).toBe(0);
		expect(waveComposition(7).officers).toBeGreaterThan(0);
		expect(waveComposition(8).sappers).toBe(0);
		expect(waveComposition(9).sappers).toBeGreaterThan(0);
		expect(waveComposition(11).tanks).toBe(0);
		expect(waveComposition(12).tanks).toBeGreaterThan(0);
		expect(waveComposition(9).bombers).toBe(0);
		expect(waveComposition(10).bombers).toBeGreaterThan(0);
	});

	it('sends a swarm of drones every third wave from wave 6 on', () => {
		expect(waveComposition(6).swarms).toBeGreaterThan(0);
		expect(waveComposition(7).swarms).toBe(0);
		expect(waveComposition(9).swarms).toBeGreaterThan(0);
		const swarm = generateWave(6, createRandom(2)).filter((entry) => entry.kind === 'swarm');
		const times = swarm.map((entry) => entry.atMs);
		// They arrive as a cloud, not spread over the wave
		expect(Math.max(...times) - Math.min(...times)).toBeLessThan(2500);
	});

	it('has a sudden mass assault every fourth wave from wave 6', () => {
		expect([5, 6, 7, 9, 10, 14].map(hasRush)).toEqual([false, true, false, false, true, true]);
		expect(waveComposition(6).rush).toBeGreaterThan(10);
		expect(waveComposition(7).rush).toBe(0);
		expect(rushStart(generateWave(7, createRandom(1)))).toBeNull();
	});

	it('packs the mass assault into a few seconds, in the middle of the wave', () => {
		const entries = generateWave(6, createRandom(3));
		const rush = entries.filter((entry) => entry.rush);
		expect(rush).toHaveLength(waveComposition(6).rush);
		expect(rushStart(entries)).toBe(rush[0].atMs);
		const span = Math.max(...rush.map((entry) => entry.atMs)) - rush[0].atMs;
		expect(span).toBeLessThan(waveComposition(6).rush * 180);
		const last = ground(6, 3).at(-1)!.atMs;
		expect(rush[0].atMs).toBeGreaterThan(last * 0.3);
		expect(rush[0].atMs).toBeLessThan(last);
	});

	it('sends bigger crowds on maps with a longer road', () => {
		expect(waveSize(5, 1.5)).toBeGreaterThan(waveSize(5) * 1.3);
		expect(generateWave(5, createRandom(1), 1.5)).toHaveLength(waveSize(5, 1.5));
		expect(count(5, 'grunt', 1.5)).toBe(waveComposition(5, 1.5).grunts);
	});
});
