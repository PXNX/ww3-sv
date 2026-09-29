/*
 * The catalog of sound effects, as a small set of reusable "flavors" (a laser, a few sizes of
 * explosion, a chime, a buzz, ...) rather than one bespoke sound per event. Modes pick whichever
 * flavor fits the moment, so a shootdown "boss destroyed" and a merge "mega tanker" can share the
 * same triumphant chime without the catalog growing one entry per event per mode.
 */
import { playClip, playRandomClip } from './clips';
import { noise, sequence, tone } from './synth';

export type SoundId =
	| 'ui-tap'
	| 'ui-toggle'
	| 'ui-error'
	| 'game-over'
	| 'new-best'
	| 'fire'
	| 'zap'
	| 'hit'
	| 'explosion-tiny'
	| 'explosion-small'
	| 'explosion-big'
	| 'thud'
	| 'alarm'
	| 'whoosh'
	| 'flap'
	| 'ding'
	| 'click'
	| 'pop'
	| 'pickup'
	| 'chime'
	| 'chime-big'
	| 'splash'
	| 'sparkle'
	| 'mine-explosion'
	| 'patriot-launch'
	| 'shahed-impact'
	| 'slava-ukraini'
	| 'fart'
	| 'fake-news';

type SoundEffect = (ctx: AudioContext, dest: AudioNode) => void;

export const SOUNDS: Record<SoundId, SoundEffect> = {
	// A soft, neutral tap for buttons, taps and toggles
	'ui-tap': (ctx, dest) =>
		tone(ctx, dest, { frequency: 720, duration: 0.05, type: 'triangle', gain: 0.18 }),

	'ui-toggle': (ctx, dest) =>
		sequence(ctx, dest, [
			{ frequency: 520, duration: 0.045, type: 'triangle', gain: 0.16 },
			{ frequency: 720, duration: 0.05, type: 'triangle', gain: 0.16, delay: 0.045 }
		]),

	// A short, low buzz for a blocked or invalid action
	'ui-error': (ctx, dest) =>
		tone(ctx, dest, { frequency: 180, glideTo: 120, duration: 0.16, type: 'square', gain: 0.16 }),

	// A gentle downward phrase for a run that ends without a new best
	'game-over': (ctx, dest) =>
		sequence(ctx, dest, [
			{ frequency: 392, duration: 0.16, type: 'triangle', gain: 0.22 },
			{ frequency: 330, duration: 0.16, type: 'triangle', gain: 0.22, delay: 0.14 },
			{ frequency: 262, duration: 0.3, type: 'triangle', gain: 0.22, delay: 0.28 }
		]),

	// A bright, rising fanfare for a new personal best
	'new-best': (ctx, dest) =>
		sequence(ctx, dest, [
			{ frequency: 523.25, duration: 0.12, type: 'square', gain: 0.2 },
			{ frequency: 659.25, duration: 0.12, type: 'square', gain: 0.2, delay: 0.1 },
			{ frequency: 783.99, duration: 0.12, type: 'square', gain: 0.2, delay: 0.2 },
			{ frequency: 1046.5, duration: 0.35, type: 'square', gain: 0.22, delay: 0.3 }
		]),

	// A quick laser pew for firing a shot
	fire: (ctx, dest) =>
		tone(ctx, dest, { frequency: 900, glideTo: 220, duration: 0.11, type: 'sawtooth', gain: 0.16 }),

	// A bright electronic zap for an interceptor or submarine strike
	zap: (ctx, dest) =>
		tone(ctx, dest, { frequency: 1400, glideTo: 300, duration: 0.14, type: 'square', gain: 0.18 }),

	// A short metallic clank for a hit that does not destroy its target
	hit: (ctx, dest) => {
		tone(ctx, dest, { frequency: 220, duration: 0.08, type: 'square', gain: 0.16 });
		noise(ctx, dest, { duration: 0.08, filterType: 'bandpass', filterFrequency: 1800, gain: 0.14 });
	},

	'explosion-tiny': (ctx, dest) =>
		noise(ctx, dest, {
			duration: 0.14,
			filterType: 'lowpass',
			filterFrequency: 1600,
			filterTo: 220,
			gain: 0.22
		}),

	'explosion-small': (ctx, dest) => {
		noise(ctx, dest, {
			duration: 0.28,
			filterType: 'lowpass',
			filterFrequency: 2200,
			filterTo: 160,
			gain: 0.3
		});
		tone(ctx, dest, { frequency: 140, glideTo: 50, duration: 0.22, type: 'sine', gain: 0.2 });
	},

	'explosion-big': (ctx, dest) => {
		noise(ctx, dest, {
			duration: 0.55,
			filterType: 'lowpass',
			filterFrequency: 2400,
			filterTo: 90,
			gain: 0.36
		});
		tone(ctx, dest, { frequency: 110, glideTo: 30, duration: 0.5, type: 'sine', gain: 0.28 });
	},

	// A soft, padded impact for something that lands without breaking
	thud: (ctx, dest) =>
		noise(ctx, dest, {
			duration: 0.12,
			filterType: 'lowpass',
			filterFrequency: 400,
			filterTo: 120,
			gain: 0.22
		}),

	// A short warning buzz for danger arriving or a life lost
	alarm: (ctx, dest) =>
		sequence(ctx, dest, [
			{ frequency: 500, duration: 0.09, type: 'square', gain: 0.15 },
			{ frequency: 380, duration: 0.09, type: 'square', gain: 0.15, delay: 0.12 }
		]),

	// A fast sweep for a near miss or something rushing past
	whoosh: (ctx, dest) =>
		noise(ctx, dest, {
			duration: 0.2,
			filterType: 'bandpass',
			filterFrequency: 300,
			filterTo: 3000,
			q: 0.7,
			gain: 0.18
		}),

	// A single soft wingbeat
	flap: (ctx, dest) =>
		noise(ctx, dest, {
			duration: 0.1,
			filterType: 'bandpass',
			filterFrequency: 500,
			filterTo: 220,
			gain: 0.2
		}),

	// A single bright point-scored ding
	ding: (ctx, dest) =>
		tone(ctx, dest, { frequency: 987.77, duration: 0.1, type: 'sine', gain: 0.2 }),

	// A crisp mechanical click for rotating or picking something up
	click: (ctx, dest) =>
		noise(ctx, dest, { duration: 0.03, filterType: 'highpass', filterFrequency: 2500, gain: 0.2 }),

	// A light bubbly pop for tiles combining
	pop: (ctx, dest) =>
		tone(ctx, dest, { frequency: 500, glideTo: 900, duration: 0.09, type: 'sine', gain: 0.2 }),

	// A bright ascending blip for collecting something useful
	pickup: (ctx, dest) =>
		sequence(ctx, dest, [
			{ frequency: 660, duration: 0.06, type: 'square', gain: 0.16 },
			{ frequency: 880, duration: 0.08, type: 'square', gain: 0.16, delay: 0.055 }
		]),

	// A short two-note success chime
	chime: (ctx, dest) =>
		sequence(ctx, dest, [
			{ frequency: 659.25, duration: 0.1, type: 'triangle', gain: 0.2 },
			{ frequency: 987.77, duration: 0.16, type: 'triangle', gain: 0.2, delay: 0.08 }
		]),

	// A bigger celebratory arpeggio for a combo, wave clear or similar high point
	'chime-big': (ctx, dest) =>
		sequence(ctx, dest, [
			{ frequency: 523.25, duration: 0.09, type: 'triangle', gain: 0.2 },
			{ frequency: 659.25, duration: 0.09, type: 'triangle', gain: 0.2, delay: 0.08 },
			{ frequency: 783.99, duration: 0.09, type: 'triangle', gain: 0.2, delay: 0.16 },
			{ frequency: 1046.5, duration: 0.22, type: 'triangle', gain: 0.22, delay: 0.24 }
		]),

	// A watery skid
	splash: (ctx, dest) =>
		noise(ctx, dest, {
			duration: 0.22,
			filterType: 'bandpass',
			filterFrequency: 900,
			filterTo: 250,
			gain: 0.2
		}),

	// A light shimmer for a shield, a sweep, or something magical happening
	sparkle: (ctx, dest) =>
		sequence(ctx, dest, [
			{ frequency: 1200, duration: 0.07, type: 'sine', gain: 0.14 },
			{ frequency: 1600, duration: 0.07, type: 'sine', gain: 0.14, delay: 0.05 },
			{ frequency: 2000, duration: 0.09, type: 'sine', gain: 0.14, delay: 0.1 }
		]),

	// A recorded mine blast, for a mine going off in the minefield
	'mine-explosion': (ctx, dest) =>
		playRandomClip(ctx, dest, ['mine-explosion-1', 'mine-explosion-2']),

	// A recorded rocket motor igniting, for a Patriot missile launching
	'patriot-launch': (ctx, dest) =>
		playRandomClip(ctx, dest, ['patriot-launch-1', 'patriot-launch-2']),

	// A recorded impact, for a Shahed drone that gets through and hits its target
	'shahed-impact': (ctx, dest) =>
		playRandomClip(ctx, dest, ['shahed-impact-1', 'shahed-impact-2']),

	// A recorded voice line, for a refinery struck in Flamingo Flight
	'slava-ukraini': (ctx, dest) => playClip(ctx, dest, 'slava-ukraini'),

	// A recorded fart, for the flamingo finally coming to rest after a crash
	fart: (ctx, dest) => playClip(ctx, dest, 'fart'),

	// A recorded "you are fake news" jab, for a lost game of Block Puzzle
	'fake-news': (ctx, dest) => playClip(ctx, dest, 'fake-news')
};
