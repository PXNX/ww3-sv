import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { LOCK_S, MISSILE_FLIGHT_S } from '#lib/game/recon/config.js';
import type { Role } from '#lib/game/recon/contacts.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { RECON_SCORE_KEY, ReconGame } from './reconGame.svelte';

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
	const game = new ReconGame({ scores, random: createRandom(11) });
	return { game, scores };
}

function flying() {
	const made = newGame();
	made.game.start();
	return made;
}

/** The first open contact with the given hidden role */
function find(game: ReconGame, role: Role) {
	const t = game.run.tracks.find((tr) => tr.status === 'open' && tr.contact.role === role);
	if (!t) throw new Error(`no ${role} contact`);
	return t;
}

function select(game: ReconGame, role: Role) {
	const t = find(game, role);
	game.tapAt(t.contact.x, t.contact.y);
	return t;
}

/** Runs the loop long enough for effects and the end-of-sortie delay to play out */
function settle(game: ReconGame, seconds = 3) {
	for (let i = 0; i < seconds * 60; i++) game.update(1000 / 60);
}

describe('ReconGame', () => {
	it('opens on the briefing and does not run until the sortie starts', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		expect(game.sortie).toBe(1);
		expect(game.ordnance).toBeGreaterThan(0);
		const before = game.timeLeft;
		game.update(1000);
		expect(game.timeLeft).toBe(before);
		game.start();
		expect(game.status).toBe('playing');
		game.update(2000);
		expect(game.timeLeft).toBeLessThan(before);
	});

	it('selects a tapped contact, locks the active sensor on it and logs the reading', () => {
		const { game } = flying();
		const t = select(game, 'hostile');
		expect(game.selectedNumber).toBe(game.run.tracks.indexOf(t) + 1);
		expect(game.locking).toBe(true);
		expect(game.dossier?.eo).toBeNull();

		// Pan the contact into view first, since a lock needs it inside the scope
		game.run.cam = { x: t.contact.x, y: t.contact.y };
		game.update((LOCK_S * 1000) / 2);
		expect(game.dossier?.eo).toBeNull();
		game.update(LOCK_S * 1000);
		expect(game.dossier?.eo).not.toBeNull();
		expect(game.locking).toBe(false);
	});

	it('tapping empty ground drops the selection', () => {
		const { game } = flying();
		select(game, 'hostile');
		game.tapAt(-500, -500);
		expect(game.selectedNumber).toBeNull();
		expect(game.dossier).toBeNull();
	});

	it('starts a lock with the new sensor when the sensor changes under a selection', () => {
		const { game } = flying();
		const t = select(game, 'hostile');
		game.run.cam = { x: t.contact.x, y: t.contact.y };
		game.update(LOCK_S * 1000 + 50);
		game.chooseSensor('ir');
		expect(game.sensor).toBe('ir');
		expect(game.switchMs).toBeGreaterThan(0);
		expect(game.locking).toBe(true);
		game.update(LOCK_S * 1000 + 50);
		expect(game.dossier?.ir).not.toBeNull();
	});

	it('scores a struck hostile, spends a missile and flashes when the missile lands', () => {
		const { game } = flying();
		const ordnance = game.ordnance;
		select(game, 'hostile');
		expect(game.strike()).toBe(true);
		expect(game.ordnance).toBe(ordnance - 1);
		expect(game.score).toBeGreaterThan(0);
		expect(game.selectedNumber).toBeNull();
		expect(game.flashMs).toBe(0);
		game.update(MISSILE_FLIGHT_S * 1000 + 50);
		expect(game.flashMs).toBeGreaterThan(0);
		expect(game.flashBad).toBe(false);
	});

	it('flashes red and raises escalation when a civilian is struck', () => {
		const { game } = flying();
		select(game, 'civilian');
		game.strike();
		expect(game.escalation).toBeGreaterThan(0);
		game.update(MISSILE_FLIGHT_S * 1000 + 50);
		expect(game.flashBad).toBe(true);
	});

	it('strike and clear do nothing without a selection', () => {
		const { game } = flying();
		expect(game.strike()).toBe(false);
		expect(game.clearSelected()).toBe(false);
		expect(game.ordnance).toBe(game.run.ordnance);
	});

	it('moves to the debrief once every contact is settled, then flies the next sortie', () => {
		const { game } = flying();
		while (game.run.tracks.some((t) => t.status === 'open')) {
			const open = game.run.tracks.find((t) => t.status === 'open')!;
			game.tapAt(open.contact.x, open.contact.y);
			if (open.contact.role === 'hostile') game.strike();
			else game.clearSelected();
		}
		expect(game.status).toBe('playing');
		settle(game);
		expect(game.status).toBe('debrief');
		expect(game.result?.ended).toBe('done');
		expect(game.result?.civiliansStruck).toBe(0);
		const sortieOneScore = game.score;
		expect(sortieOneScore).toBeGreaterThan(0);

		game.launchNext();
		expect(game.status).toBe('playing');
		expect(game.sortie).toBe(2);
		expect(game.result).toBeNull();
		expect(game.score).toBe(sortieOneScore);
	});

	it('ends the run on escalation, submits the score and lets the player fly again', () => {
		const { game, scores } = flying();
		while (game.run.tracks.some((t) => t.status === 'open' && t.contact.role === 'hostile')) {
			const hostile = select(game, 'hostile');
			game.strike();
			expect(hostile.status).toBe('struck');
		}
		game.run.escalation = 90;
		select(game, 'civilian');
		game.strike();
		settle(game);
		expect(game.status).toBe('over');
		expect(game.overReason).toBe('escalation');
		expect(scores.get(RECON_SCORE_KEY)).toBe(game.score);
		expect(game.isNewBest).toBe(true);

		game.retry();
		expect(game.status).toBe('playing');
		expect(game.sortie).toBe(1);
		expect(game.score).toBe(0);
		expect(game.escalation).toBe(0);
		expect(game.overReason).toBeNull();
	});

	it('runs the clock out into a debrief with the escaped hostiles counted', () => {
		const { game } = flying();
		settle(game, 100);
		expect(game.status).toBe('debrief');
		expect(game.result?.ended).toBe('timeout');
		expect(game.result?.escaped).toBeGreaterThan(0);
	});

	it('freezes while paused and ignores input', () => {
		const { game } = flying();
		game.pause();
		expect(game.status).toBe('paused');
		const time = game.timeLeft;
		game.update(5000);
		expect(game.timeLeft).toBe(time);
		const t = find(game, 'hostile');
		game.tapAt(t.contact.x, t.contact.y);
		expect(game.selectedNumber).toBeNull();
		game.resume();
		expect(game.status).toBe('playing');
	});

	it('pans the scope by drag and by held keys, kept inside the map', () => {
		const { game } = flying();
		const { x, y } = game.run.cam;
		game.pan(-40, -60);
		expect(game.run.cam.x).toBeLessThan(x);
		expect(game.run.cam.y).toBeLessThan(y);
		game.pan(-99999, -99999);
		const edge = { ...game.run.cam };
		game.setKeyPan(-1, -1);
		game.update(500);
		expect(game.run.cam).toEqual(edge);
		game.setKeyPan(1, 1);
		game.update(500);
		expect(game.run.cam.x).toBeGreaterThan(edge.x);
		expect(game.run.cam.y).toBeGreaterThan(edge.y);
	});
});
