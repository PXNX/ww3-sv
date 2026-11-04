import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { FxWorld, SINK_SECONDS, impactAt } from './fx';

function run(world: FxWorld, seconds: number, dt = 1 / 60) {
	for (let time = 0; time < seconds; time += dt) world.step(dt);
}

describe('FxWorld', () => {
	it('lands a shell after its flight, once, and flies it in an arc', () => {
		const world = new FxWorld(createRandom(1));
		let landed = 0;
		world.launch('shell', 44, 0, 0.4, () => landed++);
		const [shell] = world.shells;
		const middle = FxWorld.shellPosition(shell, 0.5);
		const straight = (shell.from.y + shell.to.y) / 2;
		expect(middle.y).toBeLessThan(straight);
		run(world, 0.2);
		expect(landed).toBe(0);
		run(world, 0.4);
		expect(landed).toBe(1);
		expect(world.shells).toHaveLength(0);
	});

	it('lets splash droplets rise and fall back by gravity, then removes them', () => {
		const world = new FxWorld(createRandom(2));
		world.splash(55);
		const drop = world.particles.find((particle) => particle.kind === 'drop')!;
		const startY = drop.y;
		run(world, 0.1);
		expect(drop.y).toBeLessThan(startY);
		run(world, 0.5);
		expect(drop.vy).toBeGreaterThan(0);
		run(world, 2);
		expect(world.particles.filter((particle) => particle.kind === 'drop')).toHaveLength(0);
		expect(world.rings).toHaveLength(0);
	});

	it('shakes on an explosion and settles', () => {
		const world = new FxWorld(createRandom(3));
		world.explosion(12, 1);
		expect(world.shake).toBeGreaterThan(0.2);
		expect(world.particles.some((particle) => particle.kind === 'fire')).toBe(true);
		expect(world.particles.some((particle) => particle.kind === 'smoke')).toBe(true);
		run(world, 3);
		expect(world.shake).toBe(0);
		expect(world.busy).toBe(false);
	});

	it('tips a sinking ship over, pulls it down, blows bubbles and drops it', () => {
		const world = new FxWorld(createRandom(4));
		world.sink([34, 35, 36]);
		const [sinker] = world.sinkers;
		const startY = sinker.y;
		run(world, 1);
		expect(Math.abs(sinker.angle)).toBeGreaterThan(0.3);
		expect(sinker.y).toBeGreaterThan(startY);
		expect(world.particles.some((particle) => particle.kind === 'bubble')).toBe(true);
		run(world, SINK_SECONDS);
		expect(world.sinkers).toHaveLength(0);
	});

	it('spreads a sonar ping as three rings one after another', () => {
		const world = new FxWorld(createRandom(5));
		world.ping(45, 2);
		expect(world.rings).toHaveLength(0);
		run(world, 0.5);
		expect(world.rings.filter((ring) => ring.kind === 'sonar').length).toBeGreaterThanOrEqual(2);
	});

	it('times the cells of a volley one after another', () => {
		expect(impactAt('neptune', 0)).toBeLessThan(impactAt('usv', 0));
		expect(impactAt('salvo', 2)).toBeGreaterThan(impactAt('salvo', 0));
	});
});
