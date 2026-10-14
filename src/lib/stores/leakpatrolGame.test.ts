import { describe, expect, it } from 'vitest';
import { roomName, toolName } from '#lib/components/leakpatrolText.js';
import { FIX_MS, ROOM_COUNT, STARTING_LIVES } from '#lib/game/leakpatrol/config.js';
import { TOOLS } from '#lib/game/leakpatrol/tools.js';
import type { Leak } from '#lib/game/leakpatrol/state.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { hasPersianScript, loadMessages, missingMessages } from '#lib/testing/messages.js';
import { LeakPatrolGame, SCORE_KEY } from './leakpatrolGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function newGame() {
	const scores = createHighscores(createStore(memoryStorage()));
	return { game: new LeakPatrolGame({ scores: () => scores, seed: () => 7 }), scores };
}

const STEP_MS = 50;

function run(game: LeakPatrolGame, ms: number) {
	for (let t = 0; t < ms; t += STEP_MS) game.update(STEP_MS);
}

/** Puts an open leak in a room, then syncs the store through a harmless call */
function addLeak(game: LeakPatrolGame, room: number, big = false): Leak {
	const leak: Leak = {
		id: game.state.nextId++,
		room,
		phase: 'open',
		ageMs: 1500,
		big,
		fixMs: 0,
		tapeMs: 0
	};
	game.state.leaks.push(leak);
	game.release(-1);
	return leak;
}

/** Stops the random spawns so a test controls the leaks */
function quiet(game: LeakPatrolGame) {
	game.state.nextLeakMs = Infinity;
	game.state.nextPickupMs = Infinity;
	game.state.nextDialogMs = Infinity;
}

describe('LeakPatrolGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.update(60_000);
		game.hold(1);
		expect(game.seconds).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.state.elapsedMs).toBe(0);
	});

	it('runs the clock and shows the room meters once started', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		addLeak(game, 2);
		run(game, 2000);
		expect(game.seconds).toBe(2);
		expect(game.rooms).toHaveLength(ROOM_COUNT);
		expect(game.rooms[2]).toBeGreaterThan(0);
	});

	it('plugs a held leak and counts it', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		const leak = addLeak(game, 0);
		game.hold(leak.id);
		expect(game.plugging).toEqual([leak.id]);
		run(game, 1000);
		expect(game.rooms[0]).toBe(0);
		run(game, FIX_MS);
		expect(game.plugged).toBe(1);
		expect(game.leaks).toEqual([]);
		expect(game.toast).not.toBeNull();
	});

	it('lets go of a leak when the finger lifts', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		const leak = addLeak(game, 0);
		game.hold(leak.id);
		game.release(leak.id);
		expect(game.plugging).toEqual([]);
		run(game, 1000);
		expect(game.rooms[0]).toBeGreaterThan(0);
	});

	it('drops every finger when paused and keeps the state frozen', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		const leak = addLeak(game, 0);
		game.hold(leak.id);
		game.pause();
		expect(game.status).toBe('paused');
		expect(game.plugging).toEqual([]);
		run(game, 5000);
		expect(game.seconds).toBe(0);
		game.resume();
		expect(game.status).toBe('playing');
	});

	it('applies the armed tool and shows the tray counts', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		game.state.tools.sharpie = 1;
		const leak = addLeak(game, 3);
		game.arm('sharpie');
		expect(game.armed).toBe('sharpie');
		game.hold(leak.id);
		expect(game.leaks).toEqual([]);
		expect(game.plugged).toBe(1);
		expect(game.tools.sharpie).toBe(0);
		expect(game.armed).toBeNull();
	});

	it('answers the group chat dialog', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		game.state.dialog = { leftMs: 1000, windowMs: 2000 };
		game.release(-1);
		expect(game.dialog).toBe(0.5);
		game.answer(false);
		expect(game.dialog).toBeNull();
		expect(game.dismissed).toBe(1);
		expect(game.leaks).toEqual([]);
	});

	it('floods a room, shakes the field and ends the game on the last heart', () => {
		const { game, scores } = newGame();
		game.start();
		quiet(game);
		game.state.plugged = 2;
		addLeak(game, 1, true);
		run(game, 6000);
		expect(game.hurtCount).toBe(1);
		expect(game.lives).toBe(STARTING_LIVES - 1);
		game.state.lives = 1;
		addLeak(game, 1, true);
		run(game, 8000);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.score).toBe(game.seconds * 2);
		expect(scores.get(SCORE_KEY)).toBe(game.score);
		expect(game.isNewBest).toBe(true);
	});

	it('does not touch the best when the new score is lower', () => {
		const { game, scores } = newGame();
		scores.submit(SCORE_KEY, 999_999);
		game.start();
		quiet(game);
		game.state.lives = 1;
		addLeak(game, 0, true);
		run(game, 8000);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(false);
		expect(scores.get(SCORE_KEY)).toBe(999_999);
	});

	it('starts a fresh run after a game over', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		game.state.lives = 1;
		addLeak(game, 0, true);
		run(game, 8000);
		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.leaks).toEqual([]);
		expect(game.seconds).toBe(0);
	});
});

describe('messages', () => {
	it('has every leakpatrol string in every language', () => {
		expect(missingMessages(['leakpatrol_', 'mode_leakpatrol_'])).toEqual([]);
	});

	it('has a name for every room and tool', () => {
		for (let i = 0; i < ROOM_COUNT; i++) expect(roomName(i)).toBeTruthy();
		for (const tool of TOOLS) expect(toolName(tool)).toBeTruthy();
	});

	it('writes the Persian texts in Persian script', () => {
		const persian = loadMessages('fa');
		for (const key of [
			'mode_leakpatrol_name',
			'leakpatrol_dialog_title',
			'leakpatrol_gameover_title'
		]) {
			expect(hasPersianScript(persian[key]), key).toBe(true);
		}
	});
});
