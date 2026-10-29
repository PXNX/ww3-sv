/*
 * How a game is played, for grouping the list on the start screen: quick reflexes, running and
 * flying, aiming, tactics, puzzles, riddles, running a business. Every game has exactly one style; the
 * record below is typed over all game ids, so adding a game without a style does not compile.
 */
import type { ModeId } from './registry.js';

/** In the order the groups appear on the start screen */
export const PLAY_STYLES = [
	'reaction',
	'platformer',
	'shooter',
	'tactics',
	'puzzle',
	'riddle',
	'management'
] as const;

export type PlayStyle = (typeof PLAY_STYLES)[number];

export const STYLE_OF_MODE: Record<ModeId, PlayStyle> = {
	// Fast fingers: tap, swipe, hold or wait for the right moment
	slice: 'reaction',
	whack: 'reaction',
	veto: 'reaction',
	centrifuge: 'reaction',
	dome: 'reaction',
	leakpatrol: 'reaction',

	// Run, jump, steer and fly past what is in the way
	runcomrade: 'platformer',
	venezuela: 'platformer',
	flamingo: 'platformer',
	balloon: 'platformer',
	convoy: 'platformer',
	gpsliar: 'platformer',

	// Aim, shoot and hold a line
	shootdown: 'shooter',
	dronewall: 'shooter',
	fury: 'shooter',
	raid: 'shooter',

	// Fit, merge, link and slide: find the move that works
	blocks: 'puzzle',
	merge: 'puzzle',
	parking: 'puzzle',
	beltroad: 'puzzle',
	suez: 'puzzle',
	pipeline: 'puzzle',
	maple: 'puzzle',
	minefield: 'puzzle',

	// Words, clues, memory and deduction: work it out
	wordle: 'riddle',
	purrpentagram: 'riddle',
	vault: 'riddle',
	fleethunt: 'riddle',
	maze: 'riddle',

	// Command units and plan the operation against an opponent
	chess: 'tactics',
	warroom: 'tactics',
	droneworks: 'tactics',
	falklands: 'tactics',
	sondage: 'tactics',
	bordershift: 'tactics',
	redsquare: 'tactics',

	// Run a business and keep it supplied
	tycoon: 'management',
	energiewende: 'management',
	petrobras: 'management',
	rareearth: 'management',
	chipfab: 'management'
};
