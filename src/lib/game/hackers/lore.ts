/*
 * Hermit Hackers lore: who runs the cartoon banks and what they write to each other. Every bank in
 * the target list belongs to someone from the game's cast; that owner's away message greets the
 * hermit on the desktop and their folders turn up more often there. The emails are little jokes
 * between the characters; read ones are kept in the hermit's archive across runs. The programs are
 * the silly apps installed on a bank's desktop and what running one does in the bonus round.
 * Only ids and numbers here: the texts live in the message files.
 */
import type { LeaderId } from '#lib/theme/leaders.js';

/** Someone from the cast, or the Supreme Leader who sends the hermits out */
export type CastId =
	| Extract<
			LeaderId,
			'putin' | 'trump' | 'kim' | 'maduro' | 'zuckerberg' | 'musk' | 'altman' | 'huang'
	  >
	| 'leader';

/** Who owns which bank, by its address in the target list */
export const BANK_OWNERS: Readonly<Record<string, CastId>> = {
	'10.0.17.44': 'musk',
	'192.168.77.13': 'trump',
	'172.31.200.5': 'zuckerberg',
	'10.10.4.88': 'kim',
	'192.168.215.33': 'huang',
	'172.16.99.7': 'putin'
};

export function ownerOf(ip: string): CastId {
	return BANK_OWNERS[ip] ?? 'leader';
}

/** Whose folder each folder name is, by its index in the desktop's name list */
export const FOLDER_OWNERS: readonly CastId[] = [
	'putin',
	'putin',
	'trump',
	'kim',
	'maduro',
	'zuckerberg',
	'musk',
	'altman',
	'huang',
	'leader',
	'trump',
	'kim',
	'musk',
	'zuckerberg',
	'huang',
	'putin'
];

export interface Email {
	from: CastId;
	to: CastId | 'all';
}

/** The mail between the characters; the index is the email's id and its message key */
export const EMAILS: readonly Email[] = [
	{ from: 'putin', to: 'trump' },
	{ from: 'trump', to: 'all' },
	{ from: 'kim', to: 'putin' },
	{ from: 'maduro', to: 'kim' },
	{ from: 'zuckerberg', to: 'musk' },
	{ from: 'musk', to: 'zuckerberg' },
	{ from: 'altman', to: 'huang' },
	{ from: 'huang', to: 'altman' },
	{ from: 'trump', to: 'kim' },
	{ from: 'putin', to: 'maduro' },
	{ from: 'musk', to: 'all' },
	{ from: 'leader', to: 'all' },
	{ from: 'kim', to: 'all' },
	{ from: 'zuckerberg', to: 'all' },
	{ from: 'huang', to: 'all' },
	{ from: 'altman', to: 'all' }
];

/**
 * What an installed program does when run in the bonus round:
 * coffee buys the hermit time, broom sweeps away trace, tool and miner are free upgrades,
 * and the joke apps make noise that brings the admin back sooner.
 */
export type ProgramKind = 'coffee' | 'broom' | 'tool' | 'miner' | 'karaoke' | 'selfie';

export const PROGRAM_KINDS: readonly ProgramKind[] = [
	'coffee',
	'broom',
	'tool',
	'miner',
	'karaoke',
	'selfie'
];

/** Seconds the coffee buys, trace the broom sweeps, seconds a noisy joke app costs */
export const COFFEE_MS = 10_000;
export const BROOM_TRACE = 25;
export const NOISE_MS = 6_000;
/** The bonus a joke app pays for the trouble, in DogeLite */
export const NOISE_COINS = 40;

/**
 * The cast's wider network: systems from the other game modes, reachable once a bank's desktop
 * shows the link. Each is owned by someone from the cast and pays more than a bank on the list.
 */
export interface NetworkSystem {
	id: NetworkId;
	ip: string;
	owner: CastId;
	reward: number;
}

export type NetworkId = 'dome' | 'tycoon' | 'chipfab' | 'maple' | 'petrobras' | 'whack';

export const NETWORK: readonly NetworkSystem[] = [
	{ id: 'dome', ip: '10.66.1.10', owner: 'kim', reward: 1.4 },
	{ id: 'maple', ip: '10.66.2.51', owner: 'trump', reward: 1.5 },
	{ id: 'petrobras', ip: '10.66.3.77', owner: 'maduro', reward: 1.6 },
	{ id: 'whack', ip: '10.66.4.20', owner: 'musk', reward: 1.7 },
	{ id: 'chipfab', ip: '10.66.5.3', owner: 'huang', reward: 1.8 },
	{ id: 'tycoon', ip: '10.66.6.66', owner: 'putin', reward: 2 }
];

export function networkSystem(id: string): NetworkSystem | undefined {
	return NETWORK.find((system) => system.id === id);
}

/** The camera feeds a desktop can show: a mode's picture and which caption goes with it */
export const CAMERA_MODES = [
	'dome',
	'tycoon',
	'chipfab',
	'maple',
	'petrobras',
	'whack',
	'convoy',
	'chess',
	'flamingo',
	'centrifuge',
	'raid',
	'fury'
] as const;

export type CameraMode = (typeof CAMERA_MODES)[number];
