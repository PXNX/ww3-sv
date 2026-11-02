import { describe, expect, it } from 'vitest';
import { TROOP, type Island } from './config';
import {
	applyBlast,
	createBattle,
	deploy,
	rectDistance,
	stepBattle,
	troopsAlive,
	type BattleState,
	type Troop
} from './battle';

const OPEN_ISLAND: Island = { id: 'open', buildings: [{ kind: 'hq', x: 8, y: 3 }] };
const GUN_ISLAND: Island = {
	id: 'gun',
	buildings: [
		{ kind: 'hq', x: 10, y: 0 },
		{ kind: 'field-cannon', x: 4, y: 3 }
	]
};
const STEP = 1000 / 60;

function openBattle(): { state: BattleState; troop: Troop } {
	const state = createBattle(OPEN_ISLAND);
	deploy(state, 3);
	return { state, troop: state.troops[0] };
}

function play(state: BattleState, ms: number) {
	for (let elapsed = 0; elapsed < ms && state.status === 'playing'; elapsed += STEP) {
		stepBattle(state, STEP);
	}
}

function stepUntilShot(state: BattleState, limit = 500): boolean {
	for (let step = 0; step < limit; step++) {
		stepBattle(state, STEP);
		if (state.events.some((event) => event.kind === 'troop-shot')) return true;
	}
	return false;
}

describe('blast physics', () => {
	it('pushes a soldier away from the blast and shakes them', () => {
		const { troop } = openBattle();
		applyBlast(troop, troop.x - 1, troop.y);
		expect(troop.vx).toBeGreaterThan(0);
		expect(troop.vy).toBeCloseTo(0, 6);
		expect(troop.stunMs).toBe(TROOP.stunMs);
	});

	it('pushes sideways when the blast is above or below', () => {
		const { troop } = openBattle();
		applyBlast(troop, troop.x, troop.y - 1);
		expect(troop.vx).toBeCloseTo(0, 6);
		expect(troop.vy).toBeGreaterThan(0);
	});

	it('scales the push with the force it is given', () => {
		const { troop } = openBattle();
		applyBlast(troop, troop.x - 1, troop.y, TROOP.knockback * 2);
		expect(troop.vx).toBeCloseTo(TROOP.knockback * 2, 6);
	});

	it('slows a pushed soldier down again, frame by frame', () => {
		const { state, troop } = openBattle();
		applyBlast(troop, troop.x - 1, troop.y);
		const start = Math.hypot(troop.vx, troop.vy);
		play(state, 100);
		const later = Math.hypot(troop.vx, troop.vy);
		expect(later).toBeLessThan(start);
		expect(later).toBeGreaterThanOrEqual(0);
	});

	it('leaves a soldier standing still once the push has faded', () => {
		const { state, troop } = openBattle();
		applyBlast(troop, troop.x - 1, troop.y, 0.4);
		play(state, 1000);
		expect(troop.vx).toBe(0);
		expect(troop.vy).toBe(0);
	});
});

describe('stun and movement', () => {
	it('holds a stunned soldier still instead of letting them march on', () => {
		const { state, troop } = openBattle();
		troop.stunMs = 500;
		const x = troop.x;
		stepBattle(state, STEP);
		expect(troop.x).toBe(x);
		expect(troop.moving).toBe(false);
	});

	it('frees the soldier again when the stun runs out', () => {
		const { state, troop } = openBattle();
		troop.stunMs = 100;
		const x = troop.x;
		play(state, 300);
		expect(troop.x).toBeGreaterThan(x);
	});

	it('marches towards the target and points the rifle at it', () => {
		const { state, troop } = openBattle();
		const before = troop.x;
		stepBattle(state, STEP);
		expect(troop.x).toBeGreaterThan(before);
		expect(troop.moving).toBe(true);
		expect(troop.aimX).toBeGreaterThan(0);
		expect(troop.walkPhase).toBeGreaterThan(0);
	});

	it('stops just inside weapon range instead of walking into the wall', () => {
		const { state, troop } = openBattle();
		play(state, 4000);
		const hq = state.buildings[0];
		expect(rectDistance(troop.x, troop.y, hq)).toBeLessThanOrEqual(TROOP.range + 0.02);
		expect(rectDistance(troop.x, troop.y, hq)).toBeGreaterThan(TROOP.body);
	});

	it('keeps a huge push inside the island', () => {
		const { state, troop } = openBattle();
		troop.x = 1;
		troop.y = 4;
		applyBlast(troop, 5, 4, 1000);
		play(state, 2000);
		expect(troop.x).toBeGreaterThanOrEqual(0.35);
		expect(troop.x).toBeLessThanOrEqual(12 - 0.2);
		expect(troop.y).toBeGreaterThanOrEqual(0.2);
		expect(troop.y).toBeLessThanOrEqual(8 - 0.2);
	});

	it('pushes a soldier out of a solid building', () => {
		const { state, troop } = openBattle();
		const hq = state.buildings[0];
		troop.x = hq.x + hq.width / 2;
		troop.y = hq.y + hq.height / 2;
		troop.vx = 0.2;
		stepBattle(state, STEP);
		expect(rectDistance(troop.x, troop.y, hq)).toBeGreaterThanOrEqual(TROOP.body - 0.01);
	});
});

describe('recoil and muzzle flash', () => {
	it('kicks a gun back when it fires and settles again', () => {
		const state = createBattle(GUN_ISLAND);
		deploy(state, 3);
		for (let step = 0; step < 300; step++) {
			stepBattle(state, STEP);
			if (state.events.some((event) => event.kind === 'defense-shot')) break;
		}
		const cannon = state.buildings.find((building) => building.kind === 'field-cannon')!;
		expect(cannon.recoilMs).toBeGreaterThan(0);
		play(state, 250);
		expect(cannon.recoilMs).toBe(0);
	});

	it('lights the muzzle of a soldier on the frame they fire', () => {
		const state = createBattle(OPEN_ISLAND);
		deploy(state, 3);
		expect(stepUntilShot(state)).toBe(true);
		const soldier = state.troops[0];
		expect(soldier.muzzleMs).toBeGreaterThan(0);
		stepBattle(state, STEP);
		expect(soldier.muzzleMs).toBeLessThan(TROOP.muzzleMs);
	});
});

describe('casualties and ending', () => {
	it('removes fallen soldiers from the party and announces them once', () => {
		const state = createBattle(GUN_ISLAND);
		deploy(state, 3);
		for (let step = 0; step < 1200; step++) {
			stepBattle(state, STEP);
			if (state.events.some((event) => event.kind === 'troop-down')) break;
		}
		const down = state.events.filter((event) => event.kind === 'troop-down');
		expect(down.length).toBeGreaterThan(0);
		expect(troopsAlive(state)).toBe(state.troops.length);
		expect(state.troops.every((troop) => troop.hp > 0)).toBe(true);
	});
});
