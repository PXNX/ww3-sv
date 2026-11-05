import { describe, expect, it } from 'vitest';
import {
	baseToWire,
	parseBase,
	parseFirewallEntry,
	parseHacker,
	parseRaid,
	parseRival,
	remember,
	unseen
} from './rivals';

const HQ = { kind: 'hq', x: 9, y: 3 };

describe('rival replies', () => {
	it('takes a well-formed base and refuses one without a headquarters or off the grid', () => {
		expect(parseBase({ buildings: [HQ, { kind: 'mg', x: 5, y: 2, damage_scale: 1.2 }] })).toEqual({
			buildings: [
				{ kind: 'hq', x: 9, y: 3 },
				{ kind: 'mg', x: 5, y: 2, damageScale: 1.2 }
			],
			defenseScale: 1
		});
		expect(parseBase({ buildings: [{ kind: 'mg', x: 5, y: 2 }] })).toBeNull();
		expect(parseBase({ buildings: [HQ, { kind: 'mg', x: 99, y: 2 }] })).toBeNull();
		expect(parseBase({ buildings: [HQ, { kind: 'nuke', x: 1, y: 2 }] })).toBeNull();
		expect(parseBase({ buildings: [HQ], defense_scale: 900 })).toBeNull();
	});

	it('sends the base back in the same shape it reads', () => {
		const base = parseBase({ buildings: [HQ, { kind: 'mg', x: 5, y: 2, hp_scale: 2 }] })!;
		const wire = baseToWire(base, { wood: 1, stone: 2, iron: 3, gold: 4 }, 3);
		expect(parseBase(wire.base)).toEqual(base);
		expect(wire.exposed.gold).toBe(4);
	});

	it('reads a rival with loot and revenge', () => {
		const rival = parseRival({
			id: '7',
			name: ' Nadja ',
			base: { buildings: [HQ] },
			loot: { wood: 10.7, gold: 3 },
			revenge: true
		});
		expect(rival).toMatchObject({ id: '7', name: 'Nadja', revenge: true, level: 1 });
		expect(rival?.loot).toEqual({ wood: 10, stone: 0, iron: 0, gold: 3 });
		expect(
			parseRival({ id: '7', name: 'N', base: { buildings: [HQ] }, loot: { wood: -1 } })
		).toBeNull();
	});

	it('reads raid lines and refuses unknown kinds', () => {
		const line = { id: 'a', kind: 'raided', player: { id: '1', name: 'V' }, loot: {}, at: 5 };
		expect(parseRaid(line)?.kind).toBe('raided');
		expect(parseRaid({ ...line, kind: 'nuked' })).toBeNull();
		expect(parseRaid({ ...line, at: 0 })).toBeNull();
	});

	it('reads a hacker dossier, ignoring a broken look but refusing a broken address', () => {
		const card = parseHacker({ id: '2', name: 'Zero', ip: '10.4.4.1', bank: 120, look: 'x' });
		expect(card).toMatchObject({ ip: '10.4.4.1', bank: 120, firewall: 1, hacks: 0 });
		expect(card?.look).toBeUndefined();
		expect(parseHacker({ id: '2', name: 'Zero', ip: '10.4.4.300', bank: 1 })).toBeNull();
		expect(parseHacker({ id: '2', name: 'Zero', ip: '10.4.4.3', bank: -5 })).toBeNull();
	});

	it('marks a firewall line as blocked when nothing was stolen', () => {
		const entry = parseFirewallEntry({
			id: 'f',
			ip: '172.16.0.9',
			player: { id: '3', name: 'Mo' },
			stolen: 0,
			at: 9
		});
		expect(entry?.blocked).toBe(true);
	});

	it('applies every line only once and keeps the seen list short', () => {
		expect(unseen([{ id: 'a' }, { id: 'b' }], ['a']).map((e) => e.id)).toEqual(['b']);
		const seen = remember(
			Array.from({ length: 199 }, (_, i) => `${i}`),
			['x', 'y']
		);
		expect(seen).toHaveLength(200);
		expect(seen.at(-1)).toBe('y');
	});
});
