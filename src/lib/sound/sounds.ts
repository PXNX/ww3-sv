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
	| 'fake-news'
	| 'sling-draw'
	| 'sling-release'
	| 'impact-wood'
	| 'impact-stone'
	| 'impact-ice'
	| 'impact-dome'
	| 'break-wood'
	| 'break-stone'
	| 'break-ice'
	| 'dome-pop';

/** Intensity runs from 0 to 1 and lets one sound scale (louder, higher) with how hard something happened */
type SoundEffect = (ctx: AudioContext, dest: AudioNode, intensity: number) => void;

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
	'shahed-impact': (ctx, dest) => playRandomClip(ctx, dest, ['shahed-impact-1', 'shahed-impact-2']),

	// A recorded voice line, for a refinery struck in Flamingo Flight
	'slava-ukraini': (ctx, dest) => playClip(ctx, dest, 'slava-ukraini'),

	// A recorded fart, for the flamingo finally coming to rest after a crash
	fart: (ctx, dest) => playClip(ctx, dest, 'fart'),

	// A recorded "you are fake news" jab, for a lost game of Block Puzzle
	'fake-news': (ctx, dest) => playClip(ctx, dest, 'fake-news'),

	// A creaking stretch of leather and rubber as the slingshot is pulled back; a stronger pull
	// creaks higher and louder
	'sling-draw': (ctx, dest, intensity) => {
		const pitch = 90 + intensity * 150;
		tone(ctx, dest, {
			frequency: pitch,
			glideTo: pitch * 1.6,
			duration: 0.14,
			type: 'sawtooth',
			gain: 0.05 + intensity * 0.05
		});
		noise(ctx, dest, {
			duration: 0.12,
			filterType: 'bandpass',
			filterFrequency: 350 + intensity * 400,
			filterTo: 800 + intensity * 500,
			q: 3,
			gain: 0.08 + intensity * 0.05
		});
	},

	// The band letting go: a snap, a twang that dies away, and the whoosh of the bird leaving
	'sling-release': (ctx, dest, intensity) => {
		const strength = 0.55 + intensity * 0.45;
		noise(ctx, dest, {
			duration: 0.03,
			filterType: 'highpass',
			filterFrequency: 3000,
			gain: 0.22 * strength
		});
		tone(ctx, dest, {
			frequency: 340,
			glideTo: 120,
			duration: 0.32,
			type: 'triangle',
			gain: 0.24 * strength
		});
		tone(ctx, dest, {
			frequency: 680,
			glideTo: 210,
			duration: 0.18,
			type: 'square',
			gain: 0.07 * strength,
			delay: 0.01
		});
		noise(ctx, dest, {
			duration: 0.3,
			filterType: 'bandpass',
			filterFrequency: 400,
			filterTo: 2600,
			q: 0.8,
			gain: 0.2 * strength,
			delay: 0.03
		});
	},

	// A dull knock of a bird against a wooden block
	'impact-wood': (ctx, dest, intensity) => {
		const strength = 0.5 + intensity * 0.5;
		noise(ctx, dest, {
			duration: 0.09,
			filterType: 'bandpass',
			filterFrequency: 750,
			filterTo: 260,
			gain: 0.3 * strength
		});
		tone(ctx, dest, {
			frequency: 190,
			glideTo: 90,
			duration: 0.1,
			type: 'triangle',
			gain: 0.22 * strength
		});
	},

	// A heavy, low thump with a little grit, for stone
	'impact-stone': (ctx, dest, intensity) => {
		const strength = 0.5 + intensity * 0.5;
		tone(ctx, dest, {
			frequency: 100,
			glideTo: 48,
			duration: 0.18,
			type: 'sine',
			gain: 0.32 * strength
		});
		noise(ctx, dest, {
			duration: 0.1,
			filterType: 'lowpass',
			filterFrequency: 900,
			filterTo: 200,
			gain: 0.24 * strength
		});
		noise(ctx, dest, {
			duration: 0.02,
			filterType: 'highpass',
			filterFrequency: 4000,
			gain: 0.12 * strength
		});
	},

	// A short glassy tick for ice
	'impact-ice': (ctx, dest, intensity) => {
		const strength = 0.5 + intensity * 0.5;
		tone(ctx, dest, { frequency: 2200, glideTo: 1800, duration: 0.12, gain: 0.12 * strength });
		tone(ctx, dest, { frequency: 3100, duration: 0.1, gain: 0.09 * strength, delay: 0.02 });
		noise(ctx, dest, {
			duration: 0.05,
			filterType: 'highpass',
			filterFrequency: 5000,
			gain: 0.14 * strength
		});
	},

	// A hollow gold bonk when a bird knocks an onion dome
	'impact-dome': (ctx, dest, intensity) => {
		const strength = 0.5 + intensity * 0.5;
		tone(ctx, dest, {
			frequency: 420,
			glideTo: 300,
			duration: 0.26,
			type: 'sine',
			gain: 0.22 * strength
		});
		tone(ctx, dest, {
			frequency: 630,
			glideTo: 450,
			duration: 0.2,
			type: 'triangle',
			gain: 0.1 * strength
		});
	},

	// Splintering wood: a crack followed by a few fast splinters
	'break-wood': (ctx, dest) => {
		noise(ctx, dest, {
			duration: 0.22,
			filterType: 'bandpass',
			filterFrequency: 1200,
			filterTo: 300,
			gain: 0.3
		});
		tone(ctx, dest, { frequency: 150, glideTo: 70, duration: 0.12, type: 'square', gain: 0.12 });
		for (const delay of [0.04, 0.09, 0.15]) {
			noise(ctx, dest, {
				duration: 0.02,
				filterType: 'highpass',
				filterFrequency: 2500,
				gain: 0.18,
				delay
			});
		}
	},

	// A stone block cracking apart and the rubble settling
	'break-stone': (ctx, dest) => {
		noise(ctx, dest, {
			duration: 0.4,
			filterType: 'lowpass',
			filterFrequency: 1800,
			filterTo: 120,
			gain: 0.34
		});
		tone(ctx, dest, { frequency: 90, glideTo: 35, duration: 0.35, type: 'sine', gain: 0.3 });
		for (const delay of [0.1, 0.19, 0.27]) {
			noise(ctx, dest, {
				duration: 0.04,
				filterType: 'bandpass',
				filterFrequency: 900,
				gain: 0.14,
				delay
			});
		}
	},

	// Shattering ice, ending in a few falling tinkles
	'break-ice': (ctx, dest) => {
		noise(ctx, dest, {
			duration: 0.25,
			filterType: 'highpass',
			filterFrequency: 6000,
			filterTo: 2500,
			gain: 0.25
		});
		[2600, 3400, 4200].forEach((frequency, index) =>
			tone(ctx, dest, { frequency, duration: 0.08, gain: 0.1, delay: 0.03 + index * 0.04 })
		);
	},

	// A dome bursting into gold: a pop and a bright chime
	'dome-pop': (ctx, dest) => {
		tone(ctx, dest, { frequency: 300, glideTo: 900, duration: 0.1, type: 'sine', gain: 0.24 });
		noise(ctx, dest, {
			duration: 0.14,
			filterType: 'lowpass',
			filterFrequency: 2000,
			filterTo: 300,
			gain: 0.22
		});
		sequence(ctx, dest, [
			{ frequency: 880, duration: 0.12, type: 'triangle', gain: 0.18, delay: 0.06 },
			{ frequency: 1318.5, duration: 0.22, type: 'triangle', gain: 0.18, delay: 0.13 }
		]);
	}
};
