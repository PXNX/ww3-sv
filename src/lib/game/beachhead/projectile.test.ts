import { describe, expect, it } from 'vitest';
import { type Island } from './config';
import { createBattle, deploy, stepBattle, type BattleState, type Projectile } from './battle';

const STEP = 1000 / 60;
const OPEN: Island = { id: 'open', buildings: [{ kind: 'hq', x: 9, y: 3 }] };
const MORTAR: Island = {
	id: 'mortar',
	buildings: [
		{ kind: 'mortar', x: 4, y: 3 },
		{ kind: 'hq', x: 9, y: 3 }
	]
};
const DRONE: Island = {
	id: 'drone',
	buildings: [
		{ kind: 'fpv-nest', x: 6, y: 3 },
		{ kind: 'hq', x: 9, y: 3 }
	]
};
const ROCKET: Island = {
	id: 'rocket',
	buildings: [
		{ kind: 'air-defence', x: 6, y: 3 },
		{ kind: 'hq', x: 9, y: 3 }
	]
};

function untilProjectile(state: BattleState, limit = 500): Projectile | null {
	for (let step = 0; step < limit; step++) {
		stepBattle(state, STEP);
		if (state.projectiles.length > 0) return state.projectiles[0];
	}
	return null;
}

function untilNoProjectiles(state: BattleState, limit = 300): void {
	for (let step = 0; step < limit && state.projectiles.length > 0; step++) {
		stepBattle(state, STEP);
	}
}

function ready(state: BattleState, projectile: Partial<Projectile> & Pick<Projectile, 'targetId'>) {
	state.projectiles.push({
		id: 99,
		kind: 'shell',
		sourceId: 0,
		fromX: 0,
		fromY: 0,
		toX: 5,
		toY: 5,
		x: 5,
		y: 5,
		ageMs: 1000,
		flightMs: 1000,
		damage: 40,
		splash: 0,
		homing: false,
		...projectile
	});
}

describe('projectile flight', () => {
	it('spawns a shell that has not hurt anyone yet', () => {
		const state = createBattle(MORTAR);
		deploy(state, 3);
		const shell = untilProjectile(state);
		expect(shell).not.toBeNull();
		expect(shell?.kind).toBe('shell');
		expect(shell?.flightMs).toBeGreaterThanOrEqual(220);
		expect(state.troops.every((troop) => troop.hp === troop.maxHp)).toBe(true);
	});

	it('lands the shell after its flight time and only then deals damage', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		for (const troop of state.troops) troop.stunMs = 10_000;
		const target = state.troops[0];
		ready(state, {
			targetId: target.id,
			x: target.x + 0.2,
			y: target.y,
			toX: target.x + 0.2,
			toY: target.y,
			ageMs: 0,
			flightMs: 400,
			splash: 1,
			damage: 40
		});
		for (let elapsed = 0; elapsed < 300; elapsed += STEP) {
			stepBattle(state, STEP);
		}
		expect(state.troops.some((troop) => troop.hp < troop.maxHp)).toBe(false);
		for (let elapsed = 0; elapsed < 200; elapsed += STEP) {
			stepBattle(state, STEP);
		}
		expect(state.projectiles).toHaveLength(0);
		expect(state.troops.some((troop) => troop.hp < troop.maxHp)).toBe(true);
	});

	it('reports the impact and where it landed', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		for (const troop of state.troops) troop.stunMs = 10_000;
		const target = state.troops[0];
		ready(state, {
			targetId: target.id,
			x: target.x,
			y: target.y,
			toX: target.x,
			toY: target.y,
			splash: 1,
			damage: 40
		});
		stepBattle(state, STEP);
		const impact = state.events.find((event) => event.kind === 'projectile-impact');
		expect(impact).toBeDefined();
		if (impact?.kind === 'projectile-impact') {
			expect(impact.projectileKind).toBe('shell');
			expect(impact.x).toBeCloseTo(target.x, 3);
			expect(impact.y).toBeCloseTo(target.y, 3);
			expect(impact.radius).toBeGreaterThan(0);
			expect(impact.hits).toBeGreaterThan(0);
		}
	});

	it('clears the shot from the air after it lands', () => {
		const state = createBattle(MORTAR);
		deploy(state, 3);
		untilProjectile(state);
		untilNoProjectiles(state);
		expect(state.projectiles).toHaveLength(0);
	});

	it('keeps the flight time between a quick rocket and a long lob', () => {
		const state = createBattle(ROCKET);
		deploy(state, 3);
		const rocket = untilProjectile(state)!;
		expect(rocket.flightMs).toBeGreaterThanOrEqual(220);
		expect(rocket.flightMs).toBeLessThanOrEqual(900);
	});

	it('flies a rocket in a straight line with no splash-free miss', () => {
		const state = createBattle(ROCKET);
		deploy(state, 3);
		const rocket = untilProjectile(state)!;
		expect(rocket.kind).toBe('rocket');
		expect(rocket.homing).toBe(true);
		untilNoProjectiles(state);
		expect(state.troops.some((troop) => troop.hp < troop.maxHp)).toBe(true);
	});
});

describe('homing projectiles', () => {
	it('turns a drone towards a target that has moved', () => {
		const state = createBattle(DRONE);
		deploy(state, 3);
		const drone = untilProjectile(state)!;
		const target = state.troops.find((troop) => troop.id === drone.targetId)!;
		const before = drone.toX;
		target.stunMs = 10_000;
		target.x = 3;
		stepBattle(state, STEP);
		expect(drone.toX).toBeCloseTo(target.x, 6);
		expect(drone.toX).not.toBe(before);
	});

	it('keeps following the target until the drone lands', () => {
		const state = createBattle(DRONE);
		deploy(state, 3);
		const drone = untilProjectile(state)!;
		const target = state.troops.find((troop) => troop.id === drone.targetId)!;
		for (const troop of state.troops) troop.stunMs = 10_000;
		target.y = 6;
		stepBattle(state, STEP);
		expect(drone.toY).toBeCloseTo(target.y, 6);
	});

	it('still hits a homing target that walks straight into the drone', () => {
		const state = createBattle(DRONE);
		deploy(state, 3);
		const drone = untilProjectile(state)!;
		untilNoProjectiles(state);
		expect(state.troops.some((troop) => troop.hp < troop.maxHp)).toBe(true);
		expect(drone.ageMs).toBeGreaterThanOrEqual(drone.flightMs);
	});
});

describe('splash and misses', () => {
	it('hurts every soldier in the blast radius', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		const [first, second] = state.troops;
		first.x = 4;
		first.y = 4;
		second.x = 4.5;
		second.y = 4.5;
		ready(state, { targetId: first.id, x: 4.2, y: 4.2, toX: 4.2, toY: 4.2, splash: 1, damage: 40 });
		stepBattle(state, STEP);
		expect(first.hp).toBeLessThan(first.maxHp);
		expect(second.hp).toBeLessThan(second.maxHp);
		const impact = state.events.find((event) => event.kind === 'projectile-impact');
		expect(impact?.kind === 'projectile-impact' && impact.hits).toBeGreaterThanOrEqual(2);
	});

	it('gives the aimed soldier the full hit and neighbours less', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		const [first, second] = state.troops;
		first.x = 4;
		first.y = 4;
		second.x = 4.5;
		second.y = 4.5;
		ready(state, { targetId: first.id, x: 4.2, y: 4.2, toX: 4.2, toY: 4.2, splash: 1, damage: 50 });
		stepBattle(state, STEP);
		expect(first.maxHp - first.hp).toBe(50);
		expect(second.maxHp - second.hp).toBe(30);
	});

	it('lets a shell miss a target that is no longer there', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		const target = state.troops[0];
		target.x = 2;
		target.y = 2;
		ready(state, {
			targetId: target.id,
			x: 9,
			y: 7,
			toX: 9,
			toY: 7,
			splash: 0,
			damage: 100
		});
		stepBattle(state, STEP);
		expect(target.hp).toBe(target.maxHp);
		const impact = state.events.find((event) => event.kind === 'projectile-impact');
		expect(impact?.kind === 'projectile-impact' && impact.hits).toBe(0);
	});

	it('still reports a harmless impact so the explosion can play', () => {
		const state = createBattle(OPEN);
		deploy(state, 3);
		const target = state.troops[0];
		target.x = 1;
		target.y = 1;
		ready(state, { targetId: target.id, x: 9, y: 7, toX: 9, toY: 7, splash: 0 });
		stepBattle(state, STEP);
		const impact = state.events.find((event) => event.kind === 'projectile-impact');
		expect(impact).toBeDefined();
	});
});

describe('firing rules', () => {
	it('does not let a mortar fire into its own dead zone', () => {
		const state = createBattle(MORTAR);
		deploy(state, 3);
		const mortar = state.buildings.find((building) => building.kind === 'mortar')!;
		for (const troop of state.troops) {
			troop.x = mortar.x + 0.5;
			troop.y = mortar.y + 0.5;
			troop.stunMs = 1000;
		}
		stepBattle(state, STEP);
		expect(state.events.some((event) => event.kind === 'defense-shot')).toBe(false);
		expect(state.projectiles).toHaveLength(0);
	});

	it('waits for the reload before the next shell', () => {
		const state = createBattle(MORTAR);
		deploy(state, 3);
		untilProjectile(state);
		const fired = state.events.filter((event) => event.kind === 'defense-shot').length;
		untilNoProjectiles(state);
		expect(state.events.filter((event) => event.kind === 'defense-shot').length).toBe(fired);
	});

	it('gives an instant bullet no flight time', () => {
		const state = createBattle({
			id: 'bullet',
			buildings: [
				{ kind: 'field-cannon', x: 4, y: 3 },
				{ kind: 'hq', x: 9, y: 3 }
			]
		});
		deploy(state, 3);
		stepBattle(state, STEP);
		const shot = state.events.find((event) => event.kind === 'defense-shot');
		expect(shot?.kind === 'defense-shot' && shot.flightMs).toBeUndefined();
		expect(state.projectiles).toHaveLength(0);
	});
});
