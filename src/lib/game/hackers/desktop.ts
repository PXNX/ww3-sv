/*
 * The bonus round after a contract: a peek at the cartoon bank's desktop before its admin comes
 * back from lunch. A handful of folders with silly names hold a few things each: sticky notes with a
 * doodle that gives away one symbol of the vault combination, apps that count as a free level of a
 * run tool, small piles of DogeLite, and somewhere the DogeLite vault itself, a combination lock
 * played like the breach (marks slot by slot, a few tries). A clock runs the whole time; when it
 * runs out the round simply ends. Pure and seeded, like the rest of the rules.
 */
import { GLYPHS } from './config';
import { makeCode, scoreGuess, type Mark } from './mastermind';
import type { Random } from '#lib/game/random.js';

/** The tools an app on the desktop can upgrade for free */
export type DesktopApp = 'breach' | 'keylog' | 'relays';

export type DesktopItem =
	| { kind: 'note'; slot: number; symbol: number }
	| { kind: 'app'; app: DesktopApp }
	| { kind: 'coins'; amount: number }
	| { kind: 'vault' };

export interface Folder {
	/** Index into FOLDER_NAMES, translated by the page */
	name: number;
	items: DesktopItem[];
	opened: boolean;
	/** Items already taken, by index */
	taken: number[];
}

export interface VaultGuess {
	symbols: number[];
	marks: Mark[];
}

export interface Desktop {
	folders: Folder[];
	/** The vault combination and how the lock is doing */
	code: number[];
	symbols: number;
	guesses: VaultGuess[];
	maxAttempts: number;
	/** null while the vault is still shut, true once cracked, false once out of tries */
	cracked: boolean | null;
	/** The vault was found in a folder, so its lock can be tried */
	vaultFound: boolean;
	/** Symbols the notes gave away, by slot */
	known: (number | null)[];
	reward: number;
	/** Time left before the admin is back */
	timeLeftMs: number;
}

/** How many folder names the page has texts for */
export const FOLDER_NAME_COUNT = 10;
export const DESKTOP_TIME_MS = 35_000;
const APPS: readonly DesktopApp[] = ['breach', 'keylog', 'relays'];

function shuffle<T>(random: Random, items: T[]): T[] {
	for (let index = items.length - 1; index > 0; index--) {
		const other = Math.floor(random() * (index + 1));
		[items[index], items[other]] = [items[other], items[index]];
	}
	return items;
}

/** A desktop for contract `n`: bigger and richer the further the run has come */
export function createDesktop(random: Random, n: number): Desktop {
	const level = Math.max(1, Math.floor(n));
	const symbols = Math.min(GLYPHS.length, 5 + Math.floor(level / 3));
	const codeLength = level >= 4 ? 4 : 3;
	const code = makeCode(random, codeLength, symbols);

	const items: DesktopItem[] = [{ kind: 'vault' }];
	// Notes for all but one slot, so the lock always needs a little thought
	const slots = shuffle(
		random,
		Array.from({ length: codeLength }, (_, slot) => slot)
	).slice(0, codeLength - 1);
	for (const slot of slots) items.push({ kind: 'note', slot, symbol: code[slot] });
	items.push({ kind: 'app', app: APPS[Math.floor(random() * APPS.length)] });
	const piles = 2 + Math.min(2, Math.floor(level / 3));
	for (let pile = 0; pile < piles; pile++) {
		items.push({ kind: 'coins', amount: 10 + Math.floor(random() * (8 + level * 4)) });
	}
	shuffle(random, items);

	const folderCount = Math.min(6, 3 + Math.floor(level / 2));
	const names = shuffle(
		random,
		Array.from({ length: FOLDER_NAME_COUNT }, (_, index) => index)
	).slice(0, folderCount);
	const folders: Folder[] = names.map((name) => ({ name, items: [], opened: false, taken: [] }));
	items.forEach((item, index) => folders[index % folderCount].items.push(item));
	// Some folders are just empty, like real desktops
	shuffle(random, folders);

	return {
		folders,
		code,
		symbols,
		guesses: [],
		maxAttempts: 4,
		cracked: null,
		vaultFound: false,
		known: Array.from({ length: codeLength }, () => null),
		reward: 120 + level * 40,
		timeLeftMs: DESKTOP_TIME_MS
	};
}

export function openFolder(desktop: Desktop, index: number): boolean {
	const folder = desktop.folders[index];
	if (!folder || folder.opened || desktop.timeLeftMs <= 0) return false;
	folder.opened = true;
	if (folder.items.some((item) => item.kind === 'vault')) desktop.vaultFound = true;
	return true;
}

/** Takes an item out of an opened folder; returns it once, null after that or when not allowed */
export function takeItem(
	desktop: Desktop,
	folderIndex: number,
	itemIndex: number
): DesktopItem | null {
	const folder = desktop.folders[folderIndex];
	const item = folder?.items[itemIndex];
	if (!folder || !item || !folder.opened || desktop.timeLeftMs <= 0) return null;
	if (item.kind === 'vault' || folder.taken.includes(itemIndex)) return null;
	folder.taken = [...folder.taken, itemIndex];
	if (item.kind === 'note') desktop.known[item.slot] = item.symbol;
	return item;
}

/** One try at the vault lock; the reward when it opens, 0 otherwise */
export function tryVault(desktop: Desktop, symbols: readonly number[]): number {
	if (!desktop.vaultFound || desktop.cracked !== null || desktop.timeLeftMs <= 0) return 0;
	if (symbols.length !== desktop.code.length) return 0;
	if (symbols.some((symbol) => symbol < 0 || symbol >= desktop.symbols)) return 0;
	const marks = scoreGuess(symbols, desktop.code);
	desktop.guesses = [...desktop.guesses, { symbols: [...symbols], marks }];
	if (marks.every((mark) => mark === 'hit')) {
		desktop.cracked = true;
		return desktop.reward;
	}
	if (desktop.guesses.length >= desktop.maxAttempts) desktop.cracked = false;
	return 0;
}

/** Runs the admin's clock; true while the round is still on */
export function tickDesktop(desktop: Desktop, dtMs: number): boolean {
	desktop.timeLeftMs = Math.max(0, desktop.timeLeftMs - dtMs);
	return desktop.timeLeftMs > 0;
}
