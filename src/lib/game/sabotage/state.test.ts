import { describe, expect, it } from 'vitest';
import {
	BUSH_REVEAL,
	NOISE_RADIUS,
	PHONE,
	REACH,
	SABOTAGE_SECONDS,
	SHADOW_VISIBILITY,
	SPEED,
	STEP
} from './config.js';
import type { GuardDef, Level, SensorDef } from './levels.js';
import { parseMap } from './map.js';
import {
	NO_INPUT,
	createSabotage,
	exposure,
	jobResult,
	step,
	targetInReach,
	targetsLeft,
	throwPhone,
	type Input,
	type SabotageEvent,
	type SabotageState
} from './state.js';

const OPEN = [
	'############',
	'#S.........#',
	'#..........#',
	'#.....T....#',
	'#..........#',
	'#.........E#',
	'############'
];

function makeLevel(
	rows: string[] = OPEN,
	extras: { guards?: GuardDef[]; sensors?: SensorDef[]; par?: number } = {}
): Level {
	return {
		id: 'test',
		theme: 'power',
		targetKind: 'pylon',
		title: 'Test',
		par: extras.par ?? 60,
		map: rows,
		guards: extras.guards ?? [],
		sensors: extras.sensors ?? [],
		card: { channel: 'c', poster: 'p', message: 'm' },
		...parseMap(rows)
	};
}

const guardAt = (x: number, y: number): GuardDef => ({ kind: 'guard', route: [[x, y]], wait: 99 });
const dogAt = (x: number, y: number): GuardDef => ({ kind: 'dog', route: [[x, y]], wait: 99 });

function run(
	state: SabotageState,
	seconds: number,
	input: Partial<Input> = {},
	events: SabotageEvent[] = []
): SabotageEvent[] {
	const full: Input = { ...NO_INPUT, ...input };
	const steps = Math.round(seconds / STEP);
	for (let i = 0; i < steps; i++) events.push(...step(state, STEP, full));
	return events;
}

/** A state with one standing guard at tile (gx, gy) looking west, the player at (px, py) */
function watched(px: number, py: number, gx = 8, gy = 1) {
	const state = createSabotage(makeLevel(OPEN, { guards: [guardAt(gx, gy)] }));
	state.player.x = px;
	state.player.y = py;
	state.guards[0].facing = Math.PI;
	return state;
}

describe('seeing the player', () => {
	it('sees someone in range inside the cone', () => {
		const state = watched(5.5, 1.5);
		expect(exposure(state, state.guards[0])).toBeGreaterThan(0);
	});

	it('does not see someone out of range, behind it, or outside the cone', () => {
		const far = watched(1.5, 1.5);
		expect(exposure(far, far.guards[0])).toBe(0);
		const behind = watched(5.5, 1.5);
		behind.guards[0].facing = 0;
		expect(exposure(behind, behind.guards[0])).toBe(0);
		const aside = watched(8.5, 4.5);
		expect(exposure(aside, aside.guards[0])).toBe(0);
	});

	it('does not see through walls or crates', () => {
		const level = makeLevel(['############', '#S..#......#', '#...x.....E#', '############'], {
			guards: [guardAt(8, 1)]
		});
		const state = createSabotage(level);
		state.guards[0].facing = Math.PI;
		state.player.x = 3.5;
		state.player.y = 1.5;
		expect(exposure(state, state.guards[0])).toBe(0);
	});

	it('sees closer targets faster', () => {
		const near = watched(6.5, 1.5);
		const far = watched(4.9, 1.5);
		expect(exposure(near, near.guards[0])).toBeGreaterThan(exposure(far, far.guards[0]));
	});

	it('is fooled by a bush unless it is right next to the player', () => {
		const state = watched(6.5, 1.5);
		state.player.hidden = true;
		expect(exposure(state, state.guards[0])).toBe(0);
		state.player.x = 8.5 - BUSH_REVEAL + 0.1;
		expect(exposure(state, state.guards[0])).toBeGreaterThan(0);
	});

	it('halves the rate in shadow, but not under a floodlight', () => {
		const state = watched(6.5, 1.5);
		const lit = exposure(state, state.guards[0]);
		state.player.inShadow = true;
		expect(exposure(state, state.guards[0])).toBeCloseTo(lit * SHADOW_VISIBILITY, 6);
		const light = { ...state.guards[0], lit: true };
		expect(exposure(state, light)).toBeCloseTo(lit, 6);
	});

	it('notices sprinting more than walking, and standing still least', () => {
		const rates = (['idle', 'sneak', 'walk', 'sprint'] as const).map((stance) => {
			const state = watched(6.5, 1.5);
			state.player.stance = stance;
			return exposure(state, state.guards[0]);
		});
		expect(rates[0]).toBeGreaterThan(0);
		expect(rates[0]).toBeGreaterThan(rates[1] - 1e-9);
		expect(rates[1]).toBeLessThan(rates[2]);
		expect(rates[2]).toBeLessThan(rates[3]);
	});
});

describe('suspicion', () => {
	it('fills while watched, raises an alert once, and busts at full', () => {
		const state = watched(5.5, 1.5);
		const events = run(state, 0.5);
		expect(state.suspicion).toBeGreaterThan(0.2);
		expect(state.guards[0].mode).toBe('look');
		expect(events.filter((event) => event.type === 'alert')).toHaveLength(1);
		run(state, 10, {}, events);
		expect(state.phase).toBe('busted');
		expect(events.some((event) => event.type === 'busted')).toBe(true);
		expect(state.peakSuspicion).toBe(1);
	});

	it('only decays after a short delay with nobody watching', () => {
		const state = createSabotage(makeLevel());
		state.suspicion = 0.6;
		state.unseenFor = 0;
		run(state, 0.4);
		expect(state.suspicion).toBeCloseTo(0.6, 5);
		run(state, 2);
		expect(state.suspicion).toBeLessThan(0.45);
		run(state, 10);
		expect(state.suspicion).toBe(0);
	});

	it('remembers the highest point for the unseen star', () => {
		const state = createSabotage(makeLevel());
		state.suspicion = 0.7;
		state.peakSuspicion = 0.7;
		state.unseenFor = 0;
		run(state, 0.1);
		run(state, 10);
		expect(state.suspicion).toBe(0);
		expect(state.peakSuspicion).toBeGreaterThanOrEqual(0.7);
	});

	it('stops simulating once busted or cleared', () => {
		const state = createSabotage(makeLevel());
		state.phase = 'busted';
		const time = state.time;
		expect(step(state, STEP)).toEqual([]);
		expect(state.time).toBe(time);
	});

	it('lets a guard that lost the player walk over, search, then go back to its post', () => {
		const state = watched(5.5, 1.5);
		run(state, 0.3);
		expect(state.guards[0].mode).toBe('look');
		state.player.x = 1.5;
		state.player.y = 4.5;
		state.suspicion = 0;
		run(state, 0.2);
		expect(state.guards[0].mode).toBe('investigate');
		run(state, 15);
		expect(['search', 'return', 'wait', 'patrol']).toContain(state.guards[0].mode);
		run(state, 15);
		expect(state.guards[0].mode).toBe('wait');
		expect(Math.hypot(state.guards[0].x - 8.5, state.guards[0].y - 1.5)).toBeLessThan(0.1);
	});
});

describe('moving', () => {
	it('walks, sneaks and sprints at their own speeds', () => {
		const distance = (input: Partial<Input>) => {
			const state = createSabotage(makeLevel());
			const startX = state.player.x;
			run(state, 0.5, { x: 1, y: 0, ...input });
			return state.player.x - startX;
		};
		expect(distance({})).toBeCloseTo(SPEED.walk * 0.5, 1);
		expect(distance({ sneak: true })).toBeCloseTo(SPEED.sneak * 0.5, 1);
		expect(distance({ sprint: true })).toBeCloseTo(SPEED.sprint * 0.5, 1);
		expect(distance({ x: 0.3 })).toBeCloseTo(SPEED.sneak * 0.5, 1);
	});

	it('faces where it goes, and stands still without input', () => {
		const state = createSabotage(makeLevel());
		run(state, 0.2, { x: 0, y: 1 });
		expect(state.player.facing).toBeCloseTo(Math.PI / 2, 5);
		run(state, 0.1);
		expect(state.player.stance).toBe('idle');
	});

	it('cannot walk through walls', () => {
		const state = createSabotage(makeLevel());
		run(state, 3, { x: -1, y: 0 });
		expect(state.player.x).toBeGreaterThanOrEqual(1.3 - 1e-6);
		run(state, 3, { x: 0, y: -1 });
		expect(state.player.y).toBeGreaterThanOrEqual(1.3 - 1e-6);
	});

	it('hides in bushes and in shadow', () => {
		const level = makeLevel(['#######', '#SbE,.#', '#######']);
		const state = createSabotage(level);
		run(state, 0.6, { x: 1, y: 0, sneak: true });
		expect(state.player.hidden).toBe(true);
		run(state, 1.5, { x: 1, y: 0, sneak: true });
		expect(state.player.inShadow).toBe(true);
		expect(state.player.hidden).toBe(false);
	});
});

describe('noise', () => {
	const CORRIDOR = [
		'##############',
		'#S...........#',
		'######.#######',
		'#.........E###',
		'##############'
	];
	function behindWall(def: GuardDef) {
		const state = createSabotage(makeLevel(CORRIDOR, { guards: [def] }));
		return state;
	}

	it('sprinting draws a guard in earshot to the spot, and counts as a noise alarm', () => {
		const state = behindWall(guardAt(2, 3));
		state.player.x = 3.5;
		state.player.y = 1.5;
		const events = run(state, 1, { x: 1, sprint: true });
		expect(events.some((event) => event.type === 'noise')).toBe(true);
		expect(state.guards[0].mode).not.toBe('wait');
		expect(state.noiseAlarms).toBeGreaterThanOrEqual(1);
		expect(jobResult(state).stars.quiet).toBe(false);
	});

	it('does not alarm anyone when walking or sneaking', () => {
		const state = behindWall(guardAt(2, 3));
		state.player.x = 3.5;
		state.player.y = 1.5;
		run(state, 2, { x: 1 });
		expect(state.noiseAlarms).toBe(0);
		expect(state.guards[0].mode).toBe('wait');
	});

	it('is not heard beyond the radius', () => {
		const state = behindWall(guardAt(1, 3));
		state.player.x = 1.5 + NOISE_RADIUS.guard + 3;
		state.player.y = 1.5;
		run(state, 0.3, { x: 1, sprint: true });
		expect(state.guards[0].mode).toBe('wait');
		expect(state.noiseAlarms).toBe(0);
	});

	it('is heard by a dog from further away than by a guard', () => {
		const spot = 1.5 + NOISE_RADIUS.guard + 1;
		const guard = behindWall(guardAt(1, 3));
		guard.player.x = spot;
		guard.player.y = 1.5;
		run(guard, 0.05, { x: 1, sprint: true });
		const dog = behindWall(dogAt(1, 3));
		dog.player.x = spot;
		dog.player.y = 1.5;
		run(dog, 0.05, { x: 1, sprint: true });
		expect(guard.guards[0].mode).toBe('wait');
		expect(dog.guards[0].mode).toBe('investigate');
	});
});

describe('sabotage', () => {
	function atTarget() {
		const state = createSabotage(makeLevel());
		state.player.x = 6.5;
		state.player.y = 2.5;
		return state;
	}

	it('finds the target in reach, or none', () => {
		const state = atTarget();
		expect(targetInReach(state)).toBe(0);
		state.player.x = 6.5 - REACH - 0.5;
		expect(targetInReach(state)).toBe(-1);
	});

	it('takes the whole hold, then opens the exit', () => {
		const state = atTarget();
		const events = run(state, SABOTAGE_SECONDS / 2, { hold: true });
		expect(state.targets[0].progress).toBeGreaterThan(0.4);
		expect(state.targets[0].progress).toBeLessThan(0.6);
		expect(state.exitOpen).toBe(false);
		run(state, SABOTAGE_SECONDS, { hold: true }, events);
		expect(state.targets[0].done).toBe(true);
		expect(targetsLeft(state)).toBe(0);
		expect(state.exitOpen).toBe(true);
		expect(events.filter((event) => event.type === 'target-done')).toHaveLength(1);
		expect(events.filter((event) => event.type === 'exit-open')).toHaveLength(1);
	});

	it('starts over when the button is let go', () => {
		const state = atTarget();
		run(state, 1, { hold: true });
		const events = run(state, 0.1);
		expect(state.targets[0].progress).toBe(0);
		expect(events.some((event) => event.type === 'sabotage-cancel')).toBe(true);
		run(state, 1, { hold: true });
		expect(state.targets[0].done).toBe(false);
	});

	it('starts over when the player walks out of reach', () => {
		const state = atTarget();
		run(state, 1, { hold: true });
		state.player.x = 1.5;
		const events = run(state, 0.1, { hold: true });
		expect(state.targets[0].progress).toBe(0);
		expect(events.some((event) => event.type === 'sabotage-cancel')).toBe(true);
	});

	it('does nothing when the button is held away from any target', () => {
		const state = createSabotage(makeLevel());
		const events = run(state, 3, { hold: true });
		expect(state.targets[0].progress).toBe(0);
		expect(events).toEqual([]);
	});

	it('clears the job only through an open exit', () => {
		const state = createSabotage(makeLevel());
		state.player.x = 10.5;
		state.player.y = 5.5;
		run(state, 0.2);
		expect(state.phase).toBe('playing');
		state.exitOpen = true;
		const events = run(state, 0.1);
		expect(state.phase).toBe('cleared');
		expect(events.some((event) => event.type === 'cleared')).toBe(true);
	});

	it('loses the work in progress when busted', () => {
		const state = createSabotage(makeLevel(OPEN, { guards: [guardAt(8, 3)] }));
		state.player.x = 6.5;
		state.player.y = 2.5;
		state.guards[0].facing = Math.PI;
		state.suspicion = 0.9;
		run(state, 10, { hold: true });
		expect(state.phase).toBe('busted');
		expect(state.targets[0].done).toBe(false);
		expect(state.targets[0].progress).toBe(0);
	});
});

describe('the distraction phone', () => {
	const WALLED = [
		'##############',
		'#S...........#',
		'#............#',
		'#...#........#',
		'#..........E.#',
		'##############'
	];

	it('rings where it lands and sends nearby guards to check, without counting as noise', () => {
		const state = createSabotage(makeLevel(WALLED, { guards: [guardAt(11, 4)] }));
		state.player.x = 2.5;
		state.player.y = 1.5;
		const events = throwPhone(state, 7.5, 1.5);
		expect(state.phone).not.toBeNull();
		expect(state.phone!.x).toBeCloseTo(7.5, 1);
		expect(state.phoneLeft).toBe(0);
		expect(events.some((event) => event.type === 'phone')).toBe(true);
		expect(state.guards[0].mode).toBe('investigate');
		expect(state.noiseAlarms).toBe(0);
	});

	it('can only be thrown so far, and only once', () => {
		const state = createSabotage(makeLevel(WALLED));
		state.player.x = 1.5;
		state.player.y = 1.5;
		throwPhone(state, 12.5, 1.5);
		expect(state.phone!.x).toBeLessThanOrEqual(1.5 + PHONE.range + 1e-6);
		const first = { ...state.phone! };
		expect(throwPhone(state, 3.5, 2.5)).toEqual([]);
		expect(state.phone).toEqual(first);
	});

	it('lands in front of a wall instead of inside it', () => {
		const state = createSabotage(makeLevel(WALLED));
		state.player.x = 4.5;
		state.player.y = 2.5;
		throwPhone(state, 4.5, 4.5 + 5);
		expect(state.phone!.y).toBeLessThan(4.6);
		const state2 = createSabotage(makeLevel(WALLED));
		state2.player.x = 2.5;
		state2.player.y = 3.5;
		throwPhone(state2, 6.5, 3.5);
		expect(state2.phone!.x).toBeLessThan(4);
	});

	it('stops ringing after a few seconds', () => {
		const state = createSabotage(makeLevel(WALLED));
		throwPhone(state, 4.5, 1.5);
		run(state, PHONE.ringSeconds + 0.2);
		expect(state.phone).toBeNull();
	});

	it('does nothing when the job is over', () => {
		const state = createSabotage(makeLevel(WALLED));
		state.phase = 'busted';
		expect(throwPhone(state, 4.5, 1.5)).toEqual([]);
		expect(state.phoneLeft).toBe(1);
	});
});

describe('cameras and floodlights', () => {
	const camera: SensorDef = {
		kind: 'camera',
		at: [11, 3],
		angle: 180,
		sweep: 30,
		period: 6,
		phase: 0,
		range: 7,
		fov: 50,
		onSeconds: 1,
		offSeconds: 0
	};

	it('sweeps back and forth around its centre line', () => {
		const state = createSabotage(makeLevel(OPEN, { sensors: [camera] }));
		const angles: number[] = [];
		for (let i = 0; i < 6; i++) {
			run(state, 1);
			angles.push(state.sensors[0].angle);
		}
		expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(0.5);
		for (const angle of angles)
			expect(Math.abs(angle - Math.PI)).toBeLessThanOrEqual((30 * Math.PI) / 180 + 1e-6);
	});

	it('fills suspicion for a player in its cone', () => {
		const state = createSabotage(makeLevel(OPEN, { sensors: [{ ...camera, sweep: 0 }] }));
		state.player.x = 7.5;
		state.player.y = 3.5;
		run(state, 0.5);
		expect(state.sensors[0].seeing).toBe(true);
		expect(state.suspicion).toBeGreaterThan(0.1);
	});

	it('blinks a floodlight on and off', () => {
		const light: SensorDef = {
			...camera,
			kind: 'floodlight',
			fov: 360,
			onSeconds: 2,
			offSeconds: 3,
			at: [6, 3]
		};
		const state = createSabotage(makeLevel(OPEN, { sensors: [light] }));
		state.player.x = 6.5;
		state.player.y = 4.5;
		run(state, 1);
		expect(state.sensors[0].active).toBe(true);
		expect(state.sensors[0].seeing).toBe(true);
		// Dark between 2 s and 5 s of every cycle: standing in range sees nothing
		state.suspicion = 0;
		run(state, 2);
		expect(state.phase).toBe('playing');
		expect(state.sensors[0].active).toBe(false);
		expect(state.sensors[0].seeing).toBe(false);
		run(state, 2.1);
		expect(state.sensors[0].active).toBe(true);
		expect(state.sensors[0].seeing).toBe(true);
	});
});

describe('pay and stars', () => {
	it('gives three stars for a quick, unseen, quiet job', () => {
		const state = createSabotage(makeLevel(OPEN, { par: 30 }));
		run(state, 5);
		const result = jobResult(state);
		expect(result.count).toBe(3);
		expect(result.payout).toBe(110);
	});

	it('takes a star for each way the job went badly', () => {
		const slow = createSabotage(makeLevel(OPEN, { par: 1 }));
		run(slow, 3);
		expect(jobResult(slow).stars).toEqual({ unseen: true, quick: false, quiet: true });
		expect(jobResult(slow).payout).toBe(90);

		const seen = createSabotage(makeLevel(OPEN, { par: 30 }));
		seen.peakSuspicion = 0.8;
		expect(jobResult(seen).stars.unseen).toBe(false);

		const loud = createSabotage(makeLevel(OPEN, { par: 30 }));
		loud.noiseAlarms = 2;
		expect(jobResult(loud).stars.quiet).toBe(false);
		expect(jobResult(loud).count).toBe(2);
	});
});
