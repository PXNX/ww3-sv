import { describe, expect, it } from 'vitest';
import { makeWeapon } from '#lib/game/raid/items.js';
import { newProfile } from '#lib/game/raid/profile.js';
import { spawnEnemy } from '#lib/game/raid/state.js';
import { createRandom } from '#lib/game/random.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { RaidGame } from './raidGame.svelte';

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
	const store = createStore(memoryStorage());
	const scores = createHighscores(store);
	const make = () => new RaidGame({ store: () => store, scores: () => scores, seed: () => 7 });
	return { game: make(), make, store };
}

function quietStart(game: RaidGame) {
	game.start();
	game.state.spawnMs = Infinity;
	game.state.nextBossMs = Infinity;
}

/** Knocks the player out with an enemy that hits for far more than any health */
function knockOut(game: RaidGame) {
	const { player } = game.state;
	const enemy = spawnEnemy(game.state, createRandom(1), 'grunt', 'normal', {
		x: player.x + 30,
		y: player.y
	})!;
	enemy.damage = 1e5;
	enemy.speed = 0;
	for (let i = 0; i < 120 && game.status === 'playing'; i++) game.update(STEP);
	return enemy;
}

describe('RaidGame', () => {
	it('starts in the lobby and only simulates while playing', () => {
		const { game } = newGame();
		expect(game.status).toBe('lobby');
		game.update(STEP);
		expect(game.state.timeMs).toBe(0);
		quietStart(game);
		game.update(STEP);
		expect(game.state.timeMs).toBeGreaterThan(0);
		game.pause();
		const time = game.state.timeMs;
		game.update(STEP);
		expect(game.state.timeMs).toBe(time);
	});

	it('attacks only from the button while playing', () => {
		const { game } = newGame();
		game.attack(true);
		expect(game.state.player.firing).toBe(false);
		quietStart(game);
		game.attack(true);
		expect(game.state.player.firing).toBe(true);
		game.pause();
		expect(game.state.player.firing).toBe(false);
	});

	it('waits on the revive decision, then ends the raid on the second knock-out', () => {
		const { game } = newGame();
		quietStart(game);
		const enemy = knockOut(game);
		expect(game.status).toBe('down');
		game.revive();
		expect(game.status).toBe('playing');
		expect(game.revivesLeft).toBe(0);
		enemy.hp = enemy.maxHp = 1e9;
		enemy.x = game.state.player.x + 30;
		enemy.y = game.state.player.y;
		for (let i = 0; i < 600 && game.status === 'playing'; i++) game.update(STEP);
		expect(game.status).toBe('over');
		expect(game.result).not.toBeNull();
	});

	it('banks the raid into the saved profile', () => {
		const { game, make } = newGame();
		game.load();
		quietStart(game);
		const found = makeWeapon('launcher', 'legendary');
		game.state.haul.push(found);
		game.state.xp = 500;
		game.state.gold = 42;
		knockOut(game);
		game.giveUp();
		expect(game.status).toBe('over');
		expect(game.result?.levelsGained).toBeGreaterThan(0);

		const reloaded = make();
		reloaded.load();
		expect(reloaded.profile.level).toBeGreaterThan(1);
		expect(reloaded.profile.gold).toBe(42);
		expect(reloaded.profile.stash.map((item) => item.id)).toEqual([found.id]);
		expect(reloaded.profile.raids).toBe(1);
	});

	it('equips, upgrades and salvages in the lobby and saves each change', () => {
		const { game, make, store } = newGame();
		const shotgun = makeWeapon('shotgun', 'rare');
		store.write('raid:profile', { ...newProfile(), gold: 1000, stash: [shotgun] });
		game.load();
		game.equip(shotgun.id, 'secondary');
		game.upgrade('secondary');
		expect(game.profile.loadout.secondary.level).toBe(2);
		const marksman = game.profile.stash[0];
		game.salvageItem(marksman.id);
		const reloaded = make();
		reloaded.load();
		expect(reloaded.profile.loadout.secondary.kind).toBe('shotgun');
		expect(reloaded.profile.loadout.secondary.level).toBe(2);
		expect(reloaded.profile.stash).toEqual([]);
	});

	it('offers freshly found gear for equipping and puts it on', () => {
		const { game } = newGame();
		quietStart(game);
		const { x, y } = game.state.player;
		const smg = makeWeapon('smg', 'epic');
		game.state.loot.push({ id: 99, x, y, drop: { type: 'gear', item: smg }, ageMs: 0 });
		game.update(STEP);
		expect(game.found?.item).toBe(smg);
		expect(game.found?.better).toBe(true);
		game.equipFound();
		expect(game.heldKind).toBe('smg');
		expect(game.found).toBeNull();
	});

	it('has its messages in every language', () => {
		expect(missingMessages(['raid_', 'mode_raid_'])).toEqual([]);
	});
});
