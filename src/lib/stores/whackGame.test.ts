import { describe, expect, it } from 'vitest';
import { RISE_MS, STARTING_LIVES, TARGETS, type MoleKind } from '#lib/game/whack/config.js';
import { holeBase } from '#lib/game/whack/layout.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { WhackGame } from './whackGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const STEP = 1000 / 60;

function newGame() {
	const scores = createHighscores(createStore(memoryStorage()));
	return { game: new WhackGame({ scores: () => scores, seed: () => 7 }), scores };
}

/** Starts a run in which only the figures placed by the test appear */
function startQuiet(game: WhackGame) {
	game.start();
	game.state.spawner.nextMs = Infinity;
}

function stand(game: WhackGame, hole: number, kind: MoleKind, lifeMs = 2000) {
	game.state.moles.push({
		id: game.state.nextId++,
		hole,
		kind,
		phase: 'up',
		ageMs: RISE_MS,
		phaseMs: RISE_MS,
		lifeMs,
		progress: 0,
		riseFrom: 0,
		finished: false
	});
}

function tap(game: WhackGame, hole: number) {
	const base = holeBase(hole);
	game.pointerDown(base.x, base.y - 10);
}

describe('WhackGame', () => {
	it('only simulates while playing', () => {
		const { game } = newGame();
		game.update(STEP);
		expect(game.state.timeMs).toBe(0);
		game.start();
		game.update(STEP);
		expect(game.state.timeMs).toBeGreaterThan(0);
		game.pause();
		const time = game.state.timeMs;
		game.update(STEP);
		expect(game.state.timeMs).toBe(time);
		game.togglePause();
		expect(game.status).toBe('playing');
	});

	it('ignores taps unless playing', () => {
		const { game } = newGame();
		stand(game, 4, 'spokesperson');
		tap(game, 4);
		expect(game.score).toBe(0);
		startQuiet(game);
		stand(game, 4, 'spokesperson');
		game.pause();
		tap(game, 4);
		game.pressHole(4);
		expect(game.score).toBe(0);
	});

	it('whacks with taps and with the keyboard, and shows effects that then fade', () => {
		const { game } = newGame();
		startQuiet(game);
		stand(game, 4, 'official');
		stand(game, 0, 'spokesperson');
		tap(game, 4);
		expect(game.score).toBe(TARGETS.official.points);
		expect(game.hits).toBe(1);
		expect(game.effects.map((effect) => effect.kind).sort()).toEqual(['bonk', 'popup']);
		game.pressHole(0);
		expect(game.score).toBe(TARGETS.official.points + TARGETS.spokesperson.points);
		for (let i = 0; i < 120; i++) game.update(STEP);
		expect(game.effects).toHaveLength(0);
	});

	it('costs a heart for a decoy', () => {
		const { game } = newGame();
		startQuiet(game);
		stand(game, 2, 'journalist');
		tap(game, 2);
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.decoysHit).toBe(1);
		expect(game.hurtCount).toBe(1);
	});

	it('costs a heart when a statement finishes', () => {
		const { game } = newGame();
		startQuiet(game);
		stand(game, 6, 'talkinghead', 400);
		for (let i = 0; i < 30; i++) game.update(STEP);
		expect(game.escaped).toBe(1);
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.hurtCount).toBe(1);
		expect(game.effects.some((effect) => effect.kind === 'ring')).toBe(true);
	});

	it('ends the game on the last heart and keeps the best score and streak per board', () => {
		const { game, scores } = newGame();
		game.selectBoard('kremlin');
		startQuiet(game);
		game.state.lives = 1;
		stand(game, 0, 'spokesperson');
		stand(game, 1, 'spokesperson');
		stand(game, 2, 'aidworker');
		tap(game, 0);
		tap(game, 1);
		tap(game, 2);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(['whack', 'kremlin', 'score'])).toBe(20);
		expect(scores.get(['whack', 'kremlin', 'streak'])).toBe(2);
		expect(scores.get(['whack', 'regime', 'score'])).toBeNull();

		game.backToStart();
		expect(game.status).toBe('ready');
		expect(game.best).toBe(20);
		game.selectBoard('regime');
		expect(game.best).toBeNull();
		game.selectBoard('kremlin');
		expect(game.best).toBe(20);

		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.score).toBe(0);
		expect(game.isNewBest).toBe(false);
		expect(game.state.board).toBe('kremlin');
	});

	it('only lets the board change between runs', () => {
		const { game } = newGame();
		game.start();
		game.selectBoard('militant');
		expect(game.board).toBe('regime');
		game.backToStart();
		game.selectBoard('militant');
		expect(game.board).toBe('militant');
		expect(game.state.board).toBe('militant');
	});

	it('is reproducible from its seed', () => {
		const run = () => {
			const { game } = newGame();
			game.start();
			for (let i = 0; i < 600; i++) game.update(STEP);
			return game.state.moles.map((mole) => [mole.hole, mole.kind]);
		};
		expect(run()).toEqual(run());
	});
});

describe('Spokesperson Whack messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['whack_', 'mode_whack_'])).toEqual([]);
	});
});
