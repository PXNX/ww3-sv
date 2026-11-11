import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pressRelay } from '#lib/game/hackers/breaker.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import type { HackerCard } from '#lib/services/rivals.js';

const server = vi.hoisted(() => ({
	publish: vi.fn(),
	list: vi.fn(),
	lookup: vi.fn(),
	hack: vi.fn(),
	result: vi.fn(),
	firewall: vi.fn()
}));

vi.mock('#lib/services/rivals.js', async (original) => ({
	...(await original<typeof import('#lib/services/rivals.js')>()),
	hackerRivals: server
}));

const { HackersGame } = await import('./hackersGame.svelte');

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const RIVAL: HackerCard = {
	id: '42',
	name: 'Neo',
	ip: '88.12.4.7',
	bank: 900,
	firewall: 4,
	hacks: 3,
	revenge: true
};

function newGame() {
	const store = createStore(memoryStorage());
	const game = new HackersGame({
		scores: () => createHighscores(store),
		store: () => store,
		seed: () => 7
	});
	game.loadProfile();
	return game;
}

/** Leaves one press on the relay panel before the contract is through */
function oneRelayLeft(game: InstanceType<typeof HackersGame>) {
	const contract = game.state.contract;
	contract.stage = 'breaker';
	const size = contract.spec.panel;
	contract.panel = pressRelay(Array(size * size).fill(false), size, 0);
}

describe('hacking other players', () => {
	beforeEach(() => {
		for (const call of Object.values(server)) call.mockReset();
		server.publish.mockResolvedValue({});
		server.list.mockResolvedValue([RIVAL]);
		server.firewall.mockResolvedValue([]);
		server.hack.mockResolvedValue({ id: 'hack-1', target: RIVAL });
		server.result.mockResolvedValue(120);
	});

	it('gives the rig its own address once and publishes it with the firewall', async () => {
		const game = newGame();
		expect(game.ownIp).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
		await game.syncRivals();
		expect(server.publish).toHaveBeenCalledWith(
			expect.objectContaining({ ip: game.ownIp, firewall: 1, hacks: 0 })
		);
		expect(game.rivalsOnline).toBe(true);
		expect(game.rivalTargets).toEqual([RIVAL]);
	});

	it('takes what other hermits stole from the bank once and reports it', async () => {
		const game = newGame();
		game.bank = 500;
		const entry = {
			id: 'fw-1',
			ip: RIVAL.ip,
			player: { id: '42', name: 'Neo' },
			stolen: 80,
			blocked: false,
			atMs: 1
		};
		server.firewall.mockResolvedValue([entry]);
		await game.syncRivals();
		expect(game.bank).toBe(420);
		expect(game.robbed).toEqual({ hits: 1, stolen: 80 });
		await game.syncRivals();
		expect(game.bank).toBe(420);
	});

	it('runs one contract at the firewall level and banks the loot when it is cracked', async () => {
		const game = newGame();
		expect(await game.hackRival(RIVAL.id)).toBe(true);
		expect(game.status).toBe('playing');
		expect(game.contractNumber).toBe(RIVAL.firewall);
		expect(game.ip).toBe(RIVAL.ip);
		oneRelayLeft(game);
		game.flipRelay(0);
		expect(game.status).toBe('ready');
		expect(game.desktop).toBeNull();
		await vi.waitFor(() => expect(game.rivalOutcome).not.toBeNull());
		expect(server.result).toHaveBeenCalledWith('hack-1', true);
		expect(game.rivalOutcome).toEqual({ name: 'Neo', won: true, stolen: 120 });
		expect(game.bank).toBe(120);
		expect(game.hacks).toBe(1);
	});

	it('counts a disconnect as a failed hack', async () => {
		const game = newGame();
		await game.hackRival(RIVAL.id);
		game.abandonRival();
		expect(game.status).toBe('ready');
		await vi.waitFor(() => expect(game.rivalOutcome).not.toBeNull());
		expect(server.result).toHaveBeenCalledWith('hack-1', false);
		expect(game.bank).toBe(0);
	});

	it('keeps the shell and says why when the server refuses', async () => {
		const { TelegramCallError } = await import('#lib/services/telegram.js');
		server.hack.mockRejectedValue(
			Object.assign(new TelegramCallError('REFUSED' as never, 'cooldown'), {
				code: 'COOLDOWN'
			})
		);
		const game = newGame();
		expect(await game.hackRival(RIVAL.id)).toBe(false);
		expect(game.status).toBe('ready');
		expect(game.rivalProblem).not.toBeNull();
	});
});
