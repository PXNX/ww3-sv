import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	DESKTOP_MAX_MS,
	createDesktop,
	openFolder,
	readMail,
	runProgram,
	shiftClock,
	takeLink,
	takeItem,
	tickDesktop,
	tryVault
} from './desktop';
import { FOLDER_OWNERS } from './lore';

const desk = (seed = 7, n = 3) => createDesktop(createRandom(seed), n);

describe('the bank desktop', () => {
	it('hides one vault, notes for all but two slots, an app and some coins in its folders', () => {
		const desktop = desk();
		const items = desktop.folders.flatMap((folder) => folder.items);
		expect(items.filter((item) => item.kind === 'vault')).toHaveLength(1);
		expect(items.filter((item) => item.kind === 'note')).toHaveLength(desktop.code.length - 2);
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

describe('the owner, the programs and the mail', () => {
	it("puts the owner's folders on the desktop and three programs that run once", () => {
		const desktop = createDesktop(createRandom(3), 2, 'kim');
		expect(desktop.owner).toBe('kim');
		expect(desktop.folders.some((folder) => FOLDER_OWNERS[folder.name] === 'kim')).toBe(true);
		expect(desktop.programs).toHaveLength(3);
		expect(runProgram(desktop, 0)?.used).toBe(true);
		expect(runProgram(desktop, 0)).toBeNull();
	});

	it('hides exactly one vault clue in the inbox and tells every slot but one somewhere', () => {
		for (let seed = 1; seed < 20; seed++) {
			const desktop = createDesktop(createRandom(seed), 5, 'musk');
			const clues = desktop.mail.filter((mail) => mail.clue);
			expect(clues).toHaveLength(1);
			const notes = desktop.folders
				.flatMap((folder) => folder.items)
				.filter((item) => item.kind === 'note');
			const told = new Set([
				clues[0].clue!.slot,
				...notes.map((n) => (n.kind === 'note' ? n.slot : -1))
			]);
			expect(told.size).toBe(desktop.code.length - 1);
		}
	});

	it('fills in the lock from the clue mail and prefers mail not read before', () => {
		const desktop = createDesktop(createRandom(5), 2, 'putin', [0, 1, 2]);
		expect(desktop.mail.every((mail) => ![0, 1, 2].includes(mail.id))).toBe(true);
		const index = desktop.mail.findIndex((mail) => mail.clue);
		const mail = readMail(desktop, index);
		expect(desktop.known[mail!.clue!.slot]).toBe(desktop.code[mail!.clue!.slot]);
		expect(readMail(desktop, index)).toBeNull();
	});

	it('lets coffee stretch the clock only so far', () => {
		const desktop = createDesktop(createRandom(5), 2);
		shiftClock(desktop, 1_000_000);
		expect(desktop.timeLeftMs).toBe(DESKTOP_MAX_MS);
		shiftClock(desktop, -1_000_000);
		expect(desktop.timeLeftMs).toBe(0);
	});
});

describe('the network and the cameras', () => {
	it('links to the next unknown network system and lets it be taken once', () => {
		let linked = 0;
		for (let seed = 1; seed < 40; seed++) {
			const desktop = createDesktop(createRandom(seed), 4, 'trump', [], ['dome']);
			expect(desktop.cameras.length).toBeGreaterThanOrEqual(2);
			if (!desktop.link) continue;
			linked += 1;
			expect(desktop.link).toBe('maple');
			expect(takeLink(desktop)).toBe('maple');
			expect(takeLink(desktop)).toBeNull();
		}
		expect(linked).toBeGreaterThan(5);
	});

	it('shows no link once the whole network is known', () => {
		const all = ['dome', 'maple', 'petrobras', 'whack', 'chipfab', 'tycoon'];
		for (let seed = 1; seed < 20; seed++) {
			expect(createDesktop(createRandom(seed), 4, 'kim', [], all).link).toBeNull();
		}
	});
});
