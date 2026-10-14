import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import {
	BIG_FIX_MS,
	DIALOG_WINDOW_MS,
	DRIP_MS,
	FIRST_DIALOG_MS,
	FIRST_PICKUP_MS,
	FIRST_SPAWN_MS,
	FIX_MS,
	FLOOD_RESET,
	MAX_FINGERS,
	MAX_LEAKS_PER_ROOM,
	PICKUP_LIFE_MS,
	ROOM_COUNT,
	STARTING_LIVES,
	TAPE_MS,
	WAVE_MS
} from './config.js';
import {
	answerDialog,
	armTool,
	collectPickup,
	createGame,
	fixProgress,
	holdLeak,
	isFlowing,
	isPlugging,
	leaksInRoom,
	pickupInRoom,
	pressableLeak,
	releaseLeak,
	step,
	type Leak,
	type LeakPatrolEvent,
	type LeakPatrolState
} from './state.js';

const STEP_MS = 50;

/** A game without the random spawns, so a test places exactly the leaks it needs */
function quietGame(): LeakPatrolState {
	const state = createGame();
	state.nextLeakMs = Infinity;
	state.nextPickupMs = Infinity;
	state.nextDialogMs = Infinity;
	return state;
}

function openLeak(state: LeakPatrolState, room: number, big = false): Leak {
	const leak: Leak = {
		id: state.nextId++,
		room,
		phase: 'open',
		ageMs: DRIP_MS,
		big,
		fixMs: 0,
		tapeMs: 0
	};
	state.leaks.push(leak);
	return leak;
}

function run(state: LeakPatrolState, ms: number, seed = 1): LeakPatrolEvent[] {
	const random = createRandom(seed);
	const events: LeakPatrolEvent[] = [];
	for (let t = 0; t < ms; t += STEP_MS) events.push(...step(state, STEP_MS, random));
	return events;
}

const types = (events: LeakPatrolEvent[]) => events.map((event) => event.type);

describe('createGame', () => {
	it('starts calm, with all hearts and empty pockets', () => {
		const state = createGame();
		expect(state.phase).toBe('playing');
		expect(state.rooms).toEqual(Array.from({ length: ROOM_COUNT }, () => 0));
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.leaks).toEqual([]);
		expect(state.tools).toEqual({ sharpie: 0, tape: 0, folder: 0 });
		expect(state.wave).toBe(1);
	});
});

describe('leaks', () => {
	it('spring up with a drip before the water flows', () => {
		const state = createGame();
		const events = run(state, FIRST_SPAWN_MS + STEP_MS);
		expect(types(events)).toContain('drip');
		const leak = state.leaks[0];
		expect(leak.phase).toBe('drip');
		expect(isFlowing(leak)).toBe(false);
		const later = run(state, DRIP_MS);
		expect(types(later)).toContain('open');
		expect(leak.phase).toBe('open');
	});

	it('never put more than the limit of ordinary leaks in one room', () => {
		const state = createGame();
		run(state, 8000);
		for (let room = 0; room < ROOM_COUNT; room++) {
			expect(leaksInRoom(state, room).length).toBeLessThanOrEqual(MAX_LEAKS_PER_ROOM);
		}
	});

	it('fill the meter only while they flow', () => {
		const state = quietGame();
		const leak = openLeak(state, 2);
		run(state, 4000);
		expect(state.rooms[2]).toBeGreaterThan(0.2);
		expect(state.rooms[0]).toBe(0);
		leak.phase = 'drip';
		leak.ageMs = 0;
		const before = state.rooms[2];
		run(state, 1000);
		expect(state.rooms[2]).toBeLessThan(before);
	});

	it('drain the room again when nothing leaks', () => {
		const state = quietGame();
		state.rooms[1] = 0.5;
		run(state, 2000);
		expect(state.rooms[1]).toBeLessThan(0.5);
		run(state, 60_000);
		expect(state.rooms[1]).toBe(0);
	});

	it('come in faster in later waves', () => {
		const early = quietGame();
		openLeak(early, 0);
		run(early, 1000);
		const late = quietGame();
		late.elapsedMs = WAVE_MS * 4;
		late.wave = 5;
		openLeak(late, 0);
		run(late, 1000);
		expect(late.rooms[0]).toBeGreaterThan(early.rooms[0]);
	});

	it('announce the next news cycle', () => {
		const state = quietGame();
		const events = run(state, WAVE_MS + STEP_MS);
		expect(events.filter((event) => event.type === 'wave')).toEqual([{ type: 'wave', wave: 2 }]);
		expect(state.wave).toBe(2);
	});
});

describe('plugging', () => {
	it('stops the water while a finger is held', () => {
		const state = quietGame();
		const leak = openLeak(state, 0);
		holdLeak(state, leak.id);
		expect(isPlugging(state, leak)).toBe(true);
		run(state, 2000);
		expect(state.rooms[0]).toBe(0);
		releaseLeak(state, leak.id);
		run(state, 2000);
		expect(state.rooms[0]).toBeGreaterThan(0);
	});

	it('fixes a leak for good after enough time held, and counts it', () => {
		const state = quietGame();
		const leak = openLeak(state, 0);
		holdLeak(state, leak.id);
		const events = run(state, FIX_MS + STEP_MS);
		expect(state.leaks).toEqual([]);
		expect(state.plugged).toBe(1);
		expect(state.held).toEqual([]);
		expect(events).toContainEqual({
			type: 'plug',
			leakId: leak.id,
			room: 0,
			how: 'held',
			plugged: 1
		});
	});

	it('keeps the progress when the finger lifts for a moment', () => {
		const state = quietGame();
		const leak = openLeak(state, 0);
		holdLeak(state, leak.id);
		run(state, 2000);
		releaseLeak(state, leak.id);
		run(state, 1000);
		expect(fixProgress(leak)).toBeGreaterThan(0.3);
		expect(fixProgress(leak)).toBeLessThan(1);
	});

	it('takes longer to fix a burst leak', () => {
		const state = quietGame();
		const leak = openLeak(state, 3, true);
		holdLeak(state, leak.id);
		run(state, FIX_MS + 200);
		expect(state.leaks).toHaveLength(1);
		run(state, BIG_FIX_MS - FIX_MS);
		expect(state.leaks).toEqual([]);
	});

	it('ignores a press on a drip', () => {
		const state = quietGame();
		const leak = openLeak(state, 0);
		leak.phase = 'drip';
		expect(holdLeak(state, leak.id)).toEqual([]);
		expect(state.held).toEqual([]);
	});

	it('lets only three fingers count at once', () => {
		const state = quietGame();
		const leaks = [0, 1, 2, 3].map((room) => openLeak(state, room));
		for (const leak of leaks) holdLeak(state, leak.id);
		expect(state.held).toHaveLength(MAX_FINGERS + 1);
		expect(leaks.map((leak) => isPlugging(state, leak))).toEqual([true, true, true, false]);
		run(state, 1500);
		expect(state.rooms[3]).toBeGreaterThan(0);
		expect(state.rooms[0]).toBe(0);
		releaseLeak(state, leaks[0].id);
		expect(isPlugging(state, leaks[3])).toBe(true);
	});

	it('picks the key press leak: a flowing one that is nearest to fixed', () => {
		const state = quietGame();
		const a = openLeak(state, 0);
		const b = openLeak(state, 0);
		b.fixMs = 1000;
		expect(pressableLeak(state, 0)).toBe(b);
		holdLeak(state, b.id);
		expect(pressableLeak(state, 0)).toBe(a);
		holdLeak(state, a.id);
		expect(pressableLeak(state, 0)).toBeUndefined();
	});
});

describe('floods', () => {
	it('cost a heart, pump the room out and clear its leaks', () => {
		const state = quietGame();
		openLeak(state, 4, true);
		const events = run(state, 6000);
		expect(types(events)).toContain('flood');
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.floods).toBe(1);
		expect(state.rooms[4]).toBeLessThanOrEqual(FLOOD_RESET);
		expect(leaksInRoom(state, 4)).toEqual([]);
	});

	it('end the game on the last heart and freeze the state', () => {
		const state = quietGame();
		state.lives = 1;
		state.plugged = 3;
		openLeak(state, 0, true);
		const events = run(state, 8000);
		expect(types(events)).toContain('game-over');
		expect(state.phase).toBe('over');
		expect(state.lives).toBe(0);
		expect(state.score).toBe(Math.floor(state.elapsedMs / 1000) * 3);
		const elapsed = state.elapsedMs;
		expect(run(state, 1000)).toEqual([]);
		expect(state.elapsedMs).toBe(elapsed);
		expect(holdLeak(state, 1)).toEqual([]);
	});
});

describe('tools', () => {
	it('seal a leak for good with the Sharpie and count it as plugged', () => {
		const state = quietGame();
		state.tools.sharpie = 1;
		const leak = openLeak(state, 1);
		expect(armTool(state, 'sharpie')).toEqual([{ type: 'arm', tool: 'sharpie' }]);
		const events = holdLeak(state, leak.id);
		expect(events).toEqual([
			{ type: 'plug', leakId: leak.id, room: 1, how: 'sharpie', plugged: 1 }
		]);
		expect(state.leaks).toEqual([]);
		expect(state.tools.sharpie).toBe(0);
		expect(state.armed).toBeNull();
	});

	it('seal a leak with tape for a while, then let it flow again', () => {
		const state = quietGame();
		state.tools.tape = 1;
		const leak = openLeak(state, 1);
		armTool(state, 'tape');
		expect(types(holdLeak(state, leak.id))).toEqual(['tape']);
		expect(leak.tapeMs).toBe(TAPE_MS);
		run(state, TAPE_MS - 500);
		expect(state.rooms[1]).toBe(0);
		expect(isFlowing(leak)).toBe(false);
		const events = run(state, 1500);
		expect(types(events)).toContain('untape');
		expect(isFlowing(leak)).toBe(true);
		expect(state.rooms[1]).toBeGreaterThan(0);
	});

	it('can only be armed when there is one, and arming twice puts it back', () => {
		const state = quietGame();
		expect(armTool(state, 'tape')).toEqual([]);
		state.tools.tape = 1;
		armTool(state, 'tape');
		expect(state.armed).toBe('tape');
		expect(armTool(state, 'tape')).toEqual([{ type: 'arm', tool: null }]);
		expect(state.armed).toBeNull();
		state.tools.folder = 1;
		expect(armTool(state, 'folder')).toEqual([]);
	});

	it('are put away when the next press is on a leak without them', () => {
		const state = quietGame();
		state.tools.tape = 1;
		armTool(state, 'tape');
		expect(holdLeak(state, 999)).toEqual([]);
		expect(state.armed).toBe('tape');
	});

	it('soak up one burst with a CLASSIFIED folder', () => {
		const state = quietGame();
		state.tools.folder = 1;
		state.dialog = { leftMs: 100, windowMs: DIALOG_WINDOW_MS };
		const events = run(state, 300);
		expect(events).toContainEqual(expect.objectContaining({ type: 'burst', absorbed: true }));
		expect(state.tools.folder).toBe(0);
		expect(state.absorbed).toBe(1);
		expect(state.leaks).toEqual([]);
	});
});

describe('pickups', () => {
	it('show up in a room, can be collected, and fade away when left', () => {
		const state = createGame();
		state.nextLeakMs = Infinity;
		state.nextDialogMs = Infinity;
		const events = run(state, FIRST_PICKUP_MS + STEP_MS);
		const spawn = events.find((event) => event.type === 'pickup-spawn');
		expect(spawn).toBeDefined();
		const pickup = state.pickups[0];
		expect(pickupInRoom(state, pickup.room)).toBe(pickup);
		expect(collectPickup(state, pickup.id)).toEqual([
			{ type: 'pickup', tool: pickup.tool, full: false }
		]);
		expect(state.tools[pickup.tool]).toBe(1);
		expect(state.pickups).toEqual([]);

		state.nextPickupMs = 1;
		run(state, 100);
		expect(state.pickups).toHaveLength(1);
		run(state, PICKUP_LIFE_MS + 200);
		expect(state.pickups.every((entry) => entry.leftMs > 0)).toBe(true);
	});

	it('stay in the room when the pocket for that tool is full', () => {
		const state = quietGame();
		state.tools.tape = 2;
		state.pickups.push({ id: 90, room: 0, tool: 'tape', leftMs: 5000 });
		expect(collectPickup(state, 90)).toEqual([{ type: 'pickup', tool: 'tape', full: true }]);
		expect(state.pickups).toHaveLength(1);
		expect(state.tools.tape).toBe(2);
		expect(collectPickup(state, 12345)).toEqual([]);
	});
});

describe('group chat dialog', () => {
	it('pops up after a while with a shrinking window', () => {
		const state = createGame();
		state.nextLeakMs = Infinity;
		state.nextPickupMs = Infinity;
		const events = run(state, FIRST_DIALOG_MS + STEP_MS);
		expect(types(events)).toContain('dialog');
		expect(state.dialog?.windowMs).toBe(DIALOG_WINDOW_MS);
	});

	it('goes away safely when the player says no', () => {
		const state = quietGame();
		state.dialog = { leftMs: 2000, windowMs: 2000 };
		expect(types(answerDialog(state, false, createRandom(1)))).toEqual(['dismiss']);
		expect(state.dialog).toBeNull();
		expect(state.dismissed).toBe(1);
		expect(state.leaks).toEqual([]);
		expect(state.nextDialogMs).toBeGreaterThan(0);
	});

	it('opens a big burst leak when ignored', () => {
		const state = quietGame();
		state.dialog = { leftMs: 200, windowMs: 2000 };
		const events = run(state, 400);
		expect(state.dialog).toBeNull();
		expect(state.bursts).toBe(1);
		expect(state.leaks).toHaveLength(1);
		expect(state.leaks[0].big).toBe(true);
		expect(isFlowing(state.leaks[0])).toBe(true);
		expect(events).toContainEqual(expect.objectContaining({ type: 'open', big: true }));
	});

	it('opens a big burst leak when the player says yes', () => {
		const state = quietGame();
		state.dialog = { leftMs: 2000, windowMs: 2000 };
		const events = answerDialog(state, true, createRandom(2));
		expect(types(events)).toEqual(['burst', 'open']);
		expect(state.leaks[0].big).toBe(true);
		expect(state.dismissed).toBe(0);
	});

	it('is ignored when no dialog is up', () => {
		const state = quietGame();
		expect(answerDialog(state, false, createRandom(1))).toEqual([]);
		expect(state.dismissed).toBe(0);
	});
});

describe('a whole run', () => {
	it('ends in a flood for a player who never touches a leak, and is deterministic', () => {
		const finish = () => {
			const state = createGame();
			run(state, 5 * 60_000, 42);
			return state;
		};
		const a = finish();
		const b = finish();
		expect(a.phase).toBe('over');
		expect(a.floods).toBe(STARTING_LIVES);
		expect(a.elapsedMs).toBe(b.elapsedMs);
		expect(a.leaks.length).toBe(b.leaks.length);
	});
});
