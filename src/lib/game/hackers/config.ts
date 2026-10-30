/*
 * Hermit Hackers numbers: every contract is a little harder than the last. Everything here is
 * fictional and abstract: made-up banks, made-up addresses, no real techniques.
 */

export const STARTING_LIVES = 3;
export const TRACE_MAX = 100;
/** Trace after a trace-out: the next target starts already suspicious */
export const TRACE_AFTER_TRACED = 40;
/** Trace shaved off by finishing a contract */
export const TRACE_RELIEF = 25;

export const TRACE_WRONG_GUESS = 4;
export const TRACE_ROTATED = 20;
export const TRACE_HONEYPOT = 8;
export const TRACE_MISSED_KEY = 6;

export const LANES = 4;

/** Glyphs the access code is made of, shown on the keypad (digits 1 to 8 on a keyboard) */
export const GLYPHS = ['@', '#', '$', '%', '&', '*', '?', '!'] as const;

/** Fictional marks: an address and a bank that does not exist */
export const TARGETS: readonly { ip: string; system: string }[] = [
	{ ip: '10.0.17.44', system: 'Moonbank Exchange' },
	{ ip: '192.168.77.13', system: 'HODL & Sons' },
	{ ip: '172.31.200.5', system: 'Piggy Bytes Savings' },
	{ ip: '10.10.4.88', system: 'Lunar Ledger' },
	{ ip: '192.168.215.33', system: 'DogeLite Clearing' },
	{ ip: '172.16.99.7', system: 'Rocket Coin Co-op' }
];

/** Letters of a passphrase: no look-alikes (i, l, o) so nobody types the wrong key */
export const PASSPHRASE_LETTERS = 'abcdefghjkmnpqrstuvwxyz';

export interface ContractSpec {
	/** How many different glyphs the access code can use */
	symbols: number;
	codeLength: number;
	maxAttempts: number;
	passphraseLength: number;
	/** Time a keystroke chip needs to cross the stream */
	chipMs: number;
	/** Time between chips */
	spawnMs: number;
	/** Side of the square relay panel */
	panel: number;
	/** Switches flipped to scramble the panel, so also the best possible solution */
	presses: number;
	/** Trace per second while a stage runs */
	creep: { breach: number; keylog: number; breaker: number };
}

export function contractSpec(n: number): ContractSpec {
	const level = Math.max(1, Math.floor(n));
	const panel = level >= 7 ? 5 : level >= 3 ? 4 : 3;
	return {
		symbols: Math.min(8, 5 + Math.floor((level - 1) / 3)),
		codeLength: level >= 5 ? 5 : 4,
		maxAttempts: level >= 8 ? 6 : level >= 4 ? 7 : 8,
		passphraseLength: Math.min(8, 4 + Math.floor((level - 1) / 2)),
		chipMs: Math.max(2600, 5000 - (level - 1) * 220),
		spawnMs: Math.max(520, 900 - level * 40),
		panel,
		presses:
			panel === 3
				? 3 + Math.min(2, Math.floor(level / 2))
				: panel === 4
					? 4 + Math.min(3, level - 3)
					: 7,
		creep: {
			breach: 0.8 + level * 0.06,
			keylog: 0.3,
			breaker: 1 + level * 0.06
		}
	};
}
