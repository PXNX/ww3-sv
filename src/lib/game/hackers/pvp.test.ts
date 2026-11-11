import { describe, expect, it } from 'vitest';
import { IP_PATTERN } from '#lib/services/rivals.js';
import { createRandom } from '#lib/game/random.js';
import { emptyHardware } from './hardware.js';
import {
	MAX_FIREWALL,
	agoShort,
	applyThefts,
	firewallLevel,
	randomIp,
	rivalContractLevel
} from './pvp.js';

describe('hacker pvp', () => {
	it('rolls valid public-looking addresses for the own rig', () => {
		const random = createRandom(7);
		for (let i = 0; i < 200; i++) {
			const ip = randomIp(random);
			expect(ip).toMatch(IP_PATTERN);
			expect(['127', '169', '172']).not.toContain(ip.split('.')[0]);
		}
	});

	it('grows the firewall with the hardware and caps it', () => {
		expect(firewallLevel(emptyHardware())).toBe(1);
		expect(firewallLevel({ cpu: 2, ram: 1, gpu: 1, cable: 0 })).toBe(3);
		expect(firewallLevel({ cpu: 99, ram: 99, gpu: 99, cable: 99 })).toBe(MAX_FIREWALL);
		expect(rivalContractLevel(0)).toBe(1);
		expect(rivalContractLevel(4)).toBe(4);
		expect(rivalContractLevel(40)).toBe(MAX_FIREWALL);
	});

	it('takes each theft from the bank once and never below zero', () => {
		const entries = [
			{ id: 'a', stolen: 30 },
			{ id: 'b', stolen: 0 },
			{ id: 'c', stolen: 50 }
		];
		const first = applyThefts(100, entries, []);
		expect(first).toEqual({ bank: 20, stolen: 80, hits: 2, ids: ['a', 'b', 'c'] });
		expect(applyThefts(first.bank, entries, first.ids)).toEqual({
			bank: 20,
			stolen: 0,
			hits: 0,
			ids: []
		});
		expect(applyThefts(40, entries, ['b']).bank).toBe(0);
		expect(applyThefts(40, entries, ['b']).stolen).toBe(40);
	});

	it('prints short ages', () => {
		expect(agoShort(100_000, 70_000)).toBe('30s');
		expect(agoShort(10 * 60_000, 0)).toBe('10m');
		expect(agoShort(5 * 3_600_000, 0)).toBe('5h');
		expect(agoShort(72 * 3_600_000, 0)).toBe('3d');
	});
});
