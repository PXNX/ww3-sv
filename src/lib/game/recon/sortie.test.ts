import { describe, expect, it } from 'vitest';
import { AA_RADIUS, MAP_H, MAP_W, MAX_SORTIES, START } from './config.js';
import { inferRole, readSensor, type Dossier } from './contacts.js';
import { generateSortie, sortieParams } from './sortie.js';
import { createRandom } from '../random.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

function everySortie(check: (sortie: number, seed: number) => void) {
	for (let sortie = 1; sortie <= MAX_SORTIES; sortie++) {
		for (const seed of SEEDS) check(sortie, seed);
	}
}

describe('sortieParams', () => {
	it('grows the contact count from 5 to 9 and shortens the clock, but never below 55 s', () => {
		expect(sortieParams(1).contacts).toBe(5);
		expect(sortieParams(MAX_SORTIES).contacts).toBe(9);
		expect(sortieParams(1).timeS).toBeGreaterThan(sortieParams(MAX_SORTIES).timeS);
		expect(sortieParams(MAX_SORTIES).timeS).toBeGreaterThanOrEqual(55);
	});

	it('teaches in order: EO only, then decoys and nets, then air defence', () => {
		const first = sortieParams(1);
		expect(first.decoyChance + first.coverChance + first.coldChance + first.aaCount).toBe(0);
		expect(sortieParams(2).decoyChance).toBeGreaterThan(0);
		expect(sortieParams(2).aaCount).toBe(0);
		expect(sortieParams(3).aaCount).toBe(1);
		expect(sortieParams(MAX_SORTIES).aaCount).toBe(2);
	});
});

describe('generateSortie', () => {
	it('is deterministic for a seed', () => {
		const a = generateSortie(createRandom(5), 4);
		const b = generateSortie(createRandom(5), 4);
		expect(a.contacts).toEqual(b.contacts);
	});

	it('has the planned number of contacts, at least one hostile and enough missiles', () => {
		everySortie((sortie, seed) => {
			const s = generateSortie(createRandom(seed), sortie);
			const hostiles = s.contacts.filter((c) => c.role === 'hostile');
			expect(s.contacts).toHaveLength(s.params.contacts);
			expect(hostiles.length).toBeGreaterThanOrEqual(2);
			expect(hostiles.some((c) => c.kind !== 'aa' && c.metal)).toBe(true);
			expect(s.ordnance).toBe(hostiles.length + 1);
			expect(s.contacts.length / s.params.timeS).toBeLessThan(1 / 6);
		});
	});

	it('is solvable: the three sensors always tell the true role', () => {
		everySortie((sortie, seed) => {
			const s = generateSortie(createRandom(seed), sortie);
			for (const c of s.contacts) {
				const dossier: Dossier = {
					eo: readSensor(c, 'eo'),
					ir: readSensor(c, 'ir'),
					sar: readSensor(c, 'sar')
				};
				expect(inferRole(dossier), `${c.kind} ${c.role}`).toBe(c.role);
			}
		});
	});

	it('only builds contacts that are physically consistent', () => {
		everySortie((sortie, seed) => {
			for (const c of generateSortie(createRandom(seed), sortie).contacts) {
				expect(c.olive).toBe(c.role !== 'civilian');
				if (c.role === 'decoy') expect(c.hot || c.metal).toBe(false);
				if (c.role === 'hostile' && c.covered) expect(c.metal).toBe(true);
				if (c.role === 'civilian' && c.covered) expect(c.hot && !c.metal).toBe(true);
				if (c.role === 'civilian' && !c.covered) expect(c.olive).toBe(false);
				if (c.kind === 'aa') expect(c.covered).toBe(false);
			}
		});
	});

	it('keeps sortie 1 readable with the optical sensor alone', () => {
		for (const seed of SEEDS) {
			const s = generateSortie(createRandom(seed), 1);
			for (const c of s.contacts) {
				expect(c.covered).toBe(false);
				expect(c.role).not.toBe('decoy');
				expect(inferRole({ eo: readSensor(c, 'eo'), ir: null, sar: null }) ?? 'hostile').toBe(
					c.role
				);
			}
		}
	});

	it('keeps contacts on the map, apart from each other, and air defence off the start point', () => {
		everySortie((sortie, seed) => {
			const s = generateSortie(createRandom(seed), sortie);
			for (const c of s.contacts) {
				expect(c.x).toBeGreaterThan(0);
				expect(c.x).toBeLessThan(MAP_W);
				expect(c.y).toBeGreaterThan(0);
				expect(c.y).toBeLessThan(MAP_H);
				if (c.kind === 'aa') {
					expect(Math.hypot(c.x - START.x, c.y - START.y)).toBeGreaterThan(AA_RADIUS);
				}
			}
			for (let i = 0; i < s.contacts.length; i++) {
				for (let j = i + 1; j < s.contacts.length; j++) {
					const d = Math.hypot(
						s.contacts[i].x - s.contacts[j].x,
						s.contacts[i].y - s.contacts[j].y
					);
					expect(d).toBeGreaterThan(30);
				}
			}
		});
	});
});
