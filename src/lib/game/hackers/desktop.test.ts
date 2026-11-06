import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { createDesktop, openFolder, takeItem, tickDesktop, tryVault } from './desktop';

const desk = (seed = 7, n = 3) => createDesktop(createRandom(seed), n);

describe('the bank desktop', () => {
	it('hides one vault, notes for all but one slot, an app and some coins in its folders', () => {
		const desktop = desk();
		const items = desktop.folders.flatMap((folder) => folder.items);
		expect(items.filter((item) => item.kind === 'vault')).toHaveLength(1);
		expect(items.filter((item) => item.kind === 'note')).toHaveLength(desktop.code.length - 1);
		expect(items.some((item) => item.kind === 'app')).toBe(true);
		expect(items.some((item) => item.kind === 'coins')).toBe(true);
	});

	it('only lets taken notes fill in the lock, and each item is taken once', () => {
		const desktop = desk();
		const folder = desktop.folders.findIndex((f) => f.items.some((i) => i.kind === 'note'));
		const index = desktop.folders[folder].items.findIndex((i) => i.kind === 'note');
		expect(takeItem(desktop, folder, index)).toBeNull();
		openFolder(desktop, folder);
		const note = takeItem(desktop, folder, index);
		expect(note?.kind).toBe('note');
		if (note?.kind === 'note') expect(desktop.known[note.slot]).toBe(desktop.code[note.slot]);
		expect(takeItem(desktop, folder, index)).toBeNull();
	});

	it('opens the vault with the right combination once it is found, and shuts after four misses', () => {
		const right = desk();
		expect(tryVault(right, right.code)).toBe(0);
		const vaultFolder = right.folders.findIndex((f) => f.items.some((i) => i.kind === 'vault'));
		openFolder(right, vaultFolder);
		expect(tryVault(right, right.code)).toBe(right.reward);
		expect(right.cracked).toBe(true);

		const wrong = desk(11);
		openFolder(
			wrong,
			wrong.folders.findIndex((f) => f.items.some((i) => i.kind === 'vault'))
		);
		const miss = wrong.code.map((symbol) => (symbol + 1) % wrong.symbols);
		for (let attempt = 0; attempt < 4; attempt++) tryVault(wrong, miss);
		expect(wrong.cracked).toBe(false);
		expect(tryVault(wrong, wrong.code)).toBe(0);
	});

	it('ends when the admin is back', () => {
		const desktop = desk();
		expect(tickDesktop(desktop, 10_000)).toBe(true);
		expect(tickDesktop(desktop, 60_000)).toBe(false);
		expect(openFolder(desktop, 0)).toBe(false);
	});
});
