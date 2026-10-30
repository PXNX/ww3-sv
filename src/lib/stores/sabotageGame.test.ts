import { describe, expect, it } from 'vitest';
import { PAYOUT, STEP, STRIKES } from '#lib/game/sabotage/config.js';
import { LEVELS } from '#lib/game/sabotage/levels.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { SABOTAGE_BEST_KEY, SabotageGame } from './sabotageGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const STEP_MS = STEP * 1000;

function newGame(storage = memoryStorage()) {
	const store = createStore(storage);
	const scores = createHighscores(store);
	return { game: new SabotageGame({ scores, store: () => store }), scores, storage };
}

function run(game: SabotageGame, steps: number) {
	for (let i = 0; i < steps; i++) game.update(STEP_MS);
}

function startJob(game: SabotageGame, index = 0) {
	expect(game.startRun(index)).toBe(true);
	game.startJob();
	expect(game.screen).toBe('playing');
}

/** Stands the player in front of the first guard with the meter nearly full, so the next steps bust */
function getSpotted(game: SabotageGame) {
	const sim = game.sim!;
	const guard = sim.guards[0];
	sim.player.x = guard.x + Math.cos(guard.facing) * 2;
	sim.player.y = guard.y + Math.sin(guard.facing) * 2;
	sim.suspicion = 0.995;
	for (let i = 0; i < 120 && game.screen === 'playing'; i++) game.update(STEP_MS);
}

/** Skips the sabotage and walks onto the exit */
function clearJob(game: SabotageGame) {
	const sim = game.sim!;
	for (const target of sim.targets) target.done = true;
	sim.exitOpen = true;
	sim.player.x = sim.level.exit.x;
	sim.player.y = sim.level.exit.y;
	run(game, 2);
}

describe('choosing a job', () => {
	it('opens on the job list with only the first job open', () => {
		const { game } = newGame();
		expect(game.screen).toBe('select');
		expect(game.unlocked(0)).toBe(true);
		expect(game.unlocked(1)).toBe(false);
		expect(game.startRun(1)).toBe(false);
		expect(game.screen).toBe('select');
		expect(game.score).toBe(0);
	});

	it('shows the job card first, and plays after the player takes the job', () => {
		const { game } = newGame();
		game.startRun(0);
		expect(game.screen).toBe('card');
		expect(game.run).toEqual({ strikes: STRIKES, total: 0, jobs: 0, stars: 0 });
		game.startJob();
		expect(game.screen).toBe('playing');
		expect(game.sim).not.toBeNull();
		expect(game.targetCount).toBe(LEVELS[0].targets.length);
	});
});

describe('playing', () => {
	it('moves with the keyboard and the stick, and stops when let go', () => {
		const { game } = newGame();
		startJob(game);
		const startX = game.sim!.player.x;
		game.setKey('ArrowRight', true);
		run(game, 30);
		expect(game.sim!.player.x).toBeGreaterThan(startX + 0.5);
		game.setKey('ArrowRight', false);
		const stopped = game.sim!.player.x;
		run(game, 10);
		expect(game.sim!.player.x).toBe(stopped);
		const startY = game.sim!.player.y;
		game.setStick(0, -1);
		run(game, 20);
		expect(game.sim!.player.y).toBeLessThan(startY - 0.3);
		expect(game.seconds).toBeGreaterThan(0.8);
	});

	it('sprints with the button or Shift, sneaks with the key', () => {
		const { game } = newGame();
		startJob(game);
		game.setStick(1, 0);
		run(game, 2);
		expect(game.sim!.player.stance).toBe('walk');
		game.setSprint(true);
		run(game, 2);
		expect(game.sim!.player.stance).toBe('sprint');
		game.setSprint(false);
		game.setKey('ControlLeft', true);
		run(game, 2);
		expect(game.sim!.player.stance).toBe('sneak');
	});

	it('works on a target while the button is held and shows the progress', () => {
		const { game } = newGame();
		startJob(game);
		const target = game.sim!.targets[0];
		game.sim!.player.x = target.x - 1;
		game.sim!.player.y = target.y;
		game.setHold(true);
		run(game, 40);
		expect(game.canWork).toBe(true);
		expect(game.working).toBeGreaterThan(0.3);
		run(game, 80);
		expect(game.targetsDone).toBe(1);
		expect(game.sim!.exitOpen).toBe(true);
		expect(game.effects.some((effect) => effect.kind === 'boom')).toBe(true);
	});

	it('does not run while paused, and picks up again on resume', () => {
		const { game } = newGame();
		startJob(game);
		run(game, 10);
		game.pause();
		expect(game.screen).toBe('paused');
		const time = game.sim!.time;
		game.setKey('ArrowRight', true);
		run(game, 30);
		expect(game.sim!.time).toBe(time);
		game.resume();
		expect(game.screen).toBe('playing');
		run(game, 10);
		expect(game.sim!.time).toBeGreaterThan(time);
		game.togglePause();
		expect(game.screen).toBe('paused');
	});

	it('restarts the job from the pause menu without costing a strike', () => {
		const { game } = newGame();
		startJob(game);
		game.sim!.player.x = 3;
		game.pause();
		game.restartJob();
		expect(game.screen).toBe('playing');
		expect(game.sim!.player.x).toBe(LEVELS[0].start.x);
		expect(game.run!.strikes).toBe(STRIKES);
	});

	it('throws the phone only after arming it, and only once', () => {
		const { game } = newGame();
		startJob(game);
		expect(game.throwAt(5, 5)).toBe(false);
		game.armPhone();
		expect(game.phoneArmed).toBe(true);
		game.armPhone();
		expect(game.phoneArmed).toBe(false);
		game.armPhone();
		const start = game.sim!.player;
		expect(game.throwAt(start.x + 2, start.y - 2)).toBe(true);
		expect(game.phoneArmed).toBe(false);
		expect(game.sim!.phone).not.toBeNull();
		expect(game.phoneLeft).toBe(0);
		game.armPhone();
		expect(game.phoneArmed).toBe(false);
	});

	it('lets its effects fade away', () => {
		const { game } = newGame();
		startJob(game);
		game.armPhone();
		game.throwAt(game.sim!.player.x, game.sim!.player.y - 2);
		expect(game.effects.length).toBeGreaterThan(0);
		game.pause();
		for (let i = 0; i < 120; i++) game.update(STEP_MS);
		expect(game.effects).toHaveLength(0);
	});
});

describe('getting busted', () => {
	it('costs a strike, flashes the field and lets the player try again', () => {
		const { game } = newGame();
		startJob(game);
		getSpotted(game);
		expect(game.screen).toBe('busted');
		expect(game.run!.strikes).toBe(STRIKES - 1);
		expect(game.bustCount).toBe(1);
		expect(game.shake).toBeGreaterThan(0.5);
		game.retryJob();
		expect(game.screen).toBe('playing');
		expect(game.sim!.suspicion).toBe(0);
	});

	it('ends the run on the last strike and keeps the pay earned so far', () => {
		const { game, scores } = newGame();
		startJob(game);
		clearJob(game);
		const earned = game.run!.total;
		expect(earned).toBeGreaterThan(0);
		game.nextJob();
		game.startJob();
		for (let strike = 0; strike < STRIKES; strike++) {
			getSpotted(game);
			if (strike < STRIKES - 1) game.retryJob();
		}
		expect(game.screen).toBe('over');
		expect(game.runWon).toBe(false);
		expect(game.score).toBe(earned);
		expect(scores.get(SABOTAGE_BEST_KEY)).toBe(earned);
		expect(game.isNewBest).toBe(true);
	});
});

describe('finishing jobs', () => {
	it('pays out, saves the stars and opens the next job', () => {
		const { game, storage } = newGame();
		startJob(game);
		clearJob(game);
		expect(game.screen).toBe('cleared');
		expect(game.result!.count).toBe(3);
		expect(game.result!.payout).toBe(PAYOUT.base + 3 * PAYOUT.perStar);
		expect(game.run!.total).toBe(game.result!.payout);
		expect(game.run!.jobs).toBe(1);
		expect(game.starsOf(0)).toBe(3);
		expect(game.unlocked(1)).toBe(true);

		// The stars are still there in the next session
		const next = newGame(storage).game;
		expect(next.starsOf(0)).toBe(3);
		expect(next.unlocked(1)).toBe(true);
		expect(next.totalStars).toBe(3);
	});

	it('keeps the better star count when a job is played again', () => {
		const { game } = newGame();
		startJob(game);
		clearJob(game);
		game.backToSelect();
		startJob(game);
		game.sim!.peakSuspicion = 0.9;
		game.sim!.noiseAlarms = 1;
		clearJob(game);
		expect(game.result!.count).toBeLessThan(3);
		expect(game.starsOf(0)).toBe(3);
	});

	it('goes on to the next job card, and after the last one the run is won', () => {
		const { game, scores } = newGame();
		for (let index = 0; index < LEVELS.length; index++) {
			if (index === 0) startJob(game);
			else {
				expect(game.screen).toBe('card');
				expect(game.levelIndex).toBe(index);
				game.startJob();
			}
			clearJob(game);
			expect(game.screen).toBe('cleared');
			game.nextJob();
		}
		expect(game.screen).toBe('over');
		expect(game.runWon).toBe(true);
		expect(game.run!.jobs).toBe(LEVELS.length);
		expect(game.score).toBe(LEVELS.length * (PAYOUT.base + 3 * PAYOUT.perStar));
		expect(scores.get(SABOTAGE_BEST_KEY)).toBe(game.score);
		expect(game.totalStars).toBe(game.maxStars);
	});

	it('banks a quit run once, and then offers the job list again', () => {
		const { game, scores } = newGame();
		startJob(game);
		clearJob(game);
		game.backToSelect();
		expect(game.screen).toBe('select');
		expect(game.run).toBeNull();
		expect(scores.get(SABOTAGE_BEST_KEY)).toBe(PAYOUT.base + 3 * PAYOUT.perStar);
	});

	it('starts a later run at any open job', () => {
		const { game } = newGame();
		startJob(game);
		clearJob(game);
		game.backToSelect();
		expect(game.startRun(1)).toBe(true);
		expect(game.levelIndex).toBe(1);
		expect(game.run!.total).toBe(0);
	});
});
