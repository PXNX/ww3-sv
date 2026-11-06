/*
 * The bonus round after a contract: a peek at the cartoon bank's desktop before its admin comes
 * back from lunch. A handful of folders with silly names hold a few things each: sticky notes with a
 * doodle that gives away one symbol of the vault combination, apps that count as a free level of a
 * run tool, small piles of DogeLite, and somewhere the DogeLite vault itself, a combination lock
 * played like the breach (marks slot by slot, a few tries). A clock runs the whole time; when it
 * runs out the round simply ends. The desktop belongs to the bank's owner from the cast (see
 * lore.ts): their folders turn up more often, a few silly programs are installed that can each be
 * run once, and the inbox holds mail between the characters, one of them with a vault clue in its
 * PS. Pure and seeded, like the rest of the rules.
 */
import { GLYPHS } from './config';
import {
	CAMERA_MODES,
	EMAILS,
	FOLDER_OWNERS,
	NETWORK,
	PROGRAM_KINDS,
	type CameraMode,
	type CastId,
	type NetworkId,
	type ProgramKind
} from './lore';
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

export interface Program {
	kind: ProgramKind;
	/** For the tool program: which tool it upgrades */
	app: DesktopApp;
	used: boolean;
}

export interface Mail {
	/** Index into EMAILS */
	id: number;
	/** The PS that gives away a vault symbol, on one mail of the inbox */
	clue?: { slot: number; symbol: number };
	read: boolean;
}

export interface VaultGuess {
	symbols: number[];
	marks: Mark[];
}

export interface Desktop {
	/** Whose bank this is */
	owner: CastId;
	folders: Folder[];
	programs: Program[];
	mail: Mail[];
	/** A system of the wider network this desktop links to, not found before; null when none */
	link: NetworkId | null;
	/** The link was followed, so the system is now on the hermit's list */
	linkTaken: boolean;
	/** Security camera feeds from around the cast's world */
	cameras: CameraMode[];
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
export const FOLDER_NAME_COUNT = FOLDER_OWNERS.length;
/** The coffee can stretch the round to this at most */
export const DESKTOP_MAX_MS = 60_000;
export const DESKTOP_TIME_MS = 35_000;
const APPS: readonly DesktopApp[] = ['breach', 'keylog', 'relays'];

function shuffle<T>(random: Random, items: T[]): T[] {
	for (let index = items.length - 1; index > 0; index--) {
		const other = Math.floor(random() * (index + 1));
		[items[index], items[other]] = [items[other], items[index]];
	}
	return items;
}

/** A desktop for contract `n` on the owner's bank: bigger and richer the further the run has come */
export function createDesktop(
	random: Random,
	n: number,
	owner: CastId = 'leader',
	readMail: readonly number[] = [],
	knownNetwork: readonly string[] = []
): Desktop {
	const level = Math.max(1, Math.floor(n));
	const symbols = Math.min(GLYPHS.length, 5 + Math.floor(level / 3));
	const codeLength = level >= 4 ? 4 : 3;
	const code = makeCode(random, codeLength, symbols);

	// One slot is told by a mail, all but one of the rest by sticky notes: the lock always needs a
	// little thought
	const slots = shuffle(
		random,
		Array.from({ length: codeLength }, (_, slot) => slot)
	);
	const mailSlot = slots[0];
	const items: DesktopItem[] = [{ kind: 'vault' }];
	for (const slot of slots.slice(1, codeLength - 1)) {
		items.push({ kind: 'note', slot, symbol: code[slot] });
	}
	items.push({ kind: 'app', app: APPS[Math.floor(random() * APPS.length)] });
	const piles = 2 + Math.min(2, Math.floor(level / 3));
	for (let pile = 0; pile < piles; pile++) {
		items.push({ kind: 'coins', amount: 10 + Math.floor(random() * (8 + level * 4)) });
	}
	shuffle(random, items);

	// The owner's own folders first, then anyone's
	const folderCount = Math.min(6, 3 + Math.floor(level / 2));
	const indices = Array.from({ length: FOLDER_NAME_COUNT }, (_, index) => index);
	const own = shuffle(
		random,
		indices.filter((index) => FOLDER_OWNERS[index] === owner)
	).slice(0, 2);
	const rest = shuffle(
		random,
		indices.filter((index) => !own.includes(index))
	);
	const names = [...own, ...rest].slice(0, folderCount);
	const folders: Folder[] = names.map((name) => ({ name, items: [], opened: false, taken: [] }));
	items.forEach((item, index) => folders[index % folderCount].items.push(item));
	// Some folders are just empty, like real desktops
	shuffle(random, folders);

	// Three programs: always something useful, often something silly
	const programs: Program[] = shuffle(random, [...PROGRAM_KINDS])
		.slice(0, 3)
		.map((kind) => ({ kind, app: APPS[Math.floor(random() * APPS.length)], used: false }));

	// Mail the hermit has not read yet comes first; the owner's own mail is the likeliest
	const unread = EMAILS.map((_, id) => id).filter((id) => !readMail.includes(id));
	const pool = unread.length >= 3 ? unread : EMAILS.map((_, id) => id);
	const byOwner = shuffle(
		random,
		pool.filter((id) => EMAILS[id].from === owner || EMAILS[id].to === owner)
	);
	const others = shuffle(
		random,
		pool.filter((id) => !byOwner.includes(id))
	);
	const inbox = [...byOwner.slice(0, 1), ...others].slice(0, 3);
	const clueAt = Math.floor(random() * inbox.length);
	const mail: Mail[] = inbox.map((id, index) => ({
		id,
		read: false,
		...(index === clueAt ? { clue: { slot: mailSlot, symbol: code[mailSlot] } } : {})
	}));

	// The next system of the network not found yet, on about every other desktop
	const unknown = NETWORK.filter((system) => !knownNetwork.includes(system.id));
	const link =
		unknown.length > 0 && (level >= 2 || random() < 0.5) && random() < 0.6 ? unknown[0].id : null;
	const cameras = shuffle(random, [...CAMERA_MODES]).slice(
		0,
		2 + Math.min(2, Math.floor(level / 3))
	);

	return {
		owner,
		folders,
		programs,
		mail,
		link,
		linkTaken: false,
		cameras,
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

/** Opens a mail; its clue, if it has one, fills in the vault lock. Returns the mail the first time */
export function readMail(desktop: Desktop, index: number): Mail | null {
	const mail = desktop.mail[index];
	if (!mail || mail.read || desktop.timeLeftMs <= 0) return null;
	mail.read = true;
	if (mail.clue) desktop.known[mail.clue.slot] = mail.clue.symbol;
	return mail;
}

/** Runs an installed program once; the store applies what it does. Returns it the first time */
export function runProgram(desktop: Desktop, index: number): Program | null {
	const program = desktop.programs[index];
	if (!program || program.used || desktop.timeLeftMs <= 0) return null;
	program.used = true;
	return program;
}

/** Follows the network link; returns the system the first time */
export function takeLink(desktop: Desktop): NetworkId | null {
	if (!desktop.link || desktop.linkTaken || desktop.timeLeftMs <= 0) return null;
	desktop.linkTaken = true;
	return desktop.link;
}

/** Moves the admin's return: more time for coffee, less for noise */
export function shiftClock(desktop: Desktop, deltaMs: number): void {
	desktop.timeLeftMs = Math.min(DESKTOP_MAX_MS, Math.max(0, desktop.timeLeftMs + deltaMs));
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
