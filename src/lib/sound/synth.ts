/*
 * Tiny synthesized sound effects: short oscillator tones and filtered-noise bursts built directly
 * on the Web Audio API, so every sound effect is a few lines of code instead of a downloaded audio
 * file (and a license to track). Each helper takes an explicit destination node so the sound
 * manager can route everything through one master gain for instant, click-free muting.
 */

export interface ToneOptions {
	/** Hz */
	frequency: number;
	/** Seconds */
	duration: number;
	type?: OscillatorType;
	/** Frequency the tone glides to by the end of the duration, for laser/whoosh/flap sounds */
	glideTo?: number;
	gain?: number;
	/** Seconds to reach peak gain */
	attack?: number;
	/** Seconds from peak gain back to silence (defaults to the rest of the duration) */
	release?: number;
	/** Seconds before this note starts, relative to now */
	delay?: number;
}

export function tone(ctx: AudioContext, dest: AudioNode, options: ToneOptions): void {
	const {
		frequency,
		duration,
		type = 'sine',
		glideTo,
		gain = 0.25,
		attack = 0.005,
		release = Math.max(0.01, duration - attack),
		delay = 0
	} = options;
	const start = ctx.currentTime + delay;
	const end = start + attack + release;

	const oscillator = ctx.createOscillator();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
	if (glideTo !== undefined) {
		oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), end);
	}

	const envelope = ctx.createGain();
	envelope.gain.setValueAtTime(0, start);
	envelope.gain.linearRampToValueAtTime(gain, start + attack);
	envelope.gain.linearRampToValueAtTime(0, end);

	oscillator.connect(envelope).connect(dest);
	oscillator.start(start);
	oscillator.stop(end + 0.02);
}

export interface NoiseOptions {
	/** Seconds */
	duration: number;
	filterType?: BiquadFilterType;
	/** Hz; the filter sweeps from this to filterTo when given */
	filterFrequency: number;
	filterTo?: number;
	q?: number;
	gain?: number;
	attack?: number;
	release?: number;
	/** Seconds before this burst starts, relative to now */
	delay?: number;
}

let sharedNoiseBuffer: AudioBuffer | undefined;

/** A shared two-second buffer of white noise, generated once per AudioContext */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
	if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== ctx.sampleRate) {
		const length = ctx.sampleRate * 2;
		sharedNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
		const data = sharedNoiseBuffer.getChannelData(0);
		for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
	}
	return sharedNoiseBuffer;
}

export function noise(ctx: AudioContext, dest: AudioNode, options: NoiseOptions): void {
	const {
		duration,
		filterType = 'lowpass',
		filterFrequency,
		filterTo,
		q,
		gain = 0.3,
		attack = 0.002,
		release = Math.max(0.01, duration - attack),
		delay = 0
	} = options;
	const start = ctx.currentTime + delay;
	const end = start + attack + release;

	const source = ctx.createBufferSource();
	source.buffer = noiseBuffer(ctx);
	source.loop = true;

	const filter = ctx.createBiquadFilter();
	filter.type = filterType;
	filter.frequency.setValueAtTime(filterFrequency, start);
	if (filterTo !== undefined) {
		filter.frequency.exponentialRampToValueAtTime(Math.max(1, filterTo), end);
	}
	if (q !== undefined) filter.Q.value = q;

	const envelope = ctx.createGain();
	envelope.gain.setValueAtTime(0, start);
	envelope.gain.linearRampToValueAtTime(gain, start + attack);
	envelope.gain.linearRampToValueAtTime(0, end);

	source.connect(filter).connect(envelope).connect(dest);
	source.start(start);
	source.stop(end + 0.02);
}

export interface VoiceOptions {
	/** Pitch in Hz at the start of the burst; it sags to `pitchTo` by the end */
	pitch: number;
	pitchTo?: number;
	/** Seconds */
	duration: number;
	/** Formant frequencies in Hz, as [F1, F2, F3]: they shape the buzz into a vowel */
	formants: readonly [number, number, number];
	gain?: number;
	/** Strength of the breathy "h" at the onset, 0 to 1 */
	breath?: number;
	/** Seconds before this burst starts, relative to now */
	delay?: number;
}

/** Relative level of each formant; the lowest carries most of the vowel's energy */
const FORMANT_GAINS = [1, 0.7, 0.35] as const;

/**
 * One voiced burst, such as a single "ha": a sawtooth glottal buzz pushed through three parallel
 * formant filters, with a puff of breath noise at the start, shaped by a fast-attack envelope.
 */
export function voice(ctx: AudioContext, dest: AudioNode, options: VoiceOptions): void {
	const {
		pitch,
		pitchTo = pitch,
		duration,
		formants,
		gain = 0.5,
		breath = 0.5,
		delay = 0
	} = options;
	const start = ctx.currentTime + delay;
	const end = start + duration;

	const buzz = ctx.createOscillator();
	buzz.type = 'sawtooth';
	buzz.frequency.setValueAtTime(pitch, start);
	buzz.frequency.exponentialRampToValueAtTime(Math.max(1, pitchTo), end);

	const envelope = ctx.createGain();
	envelope.gain.setValueAtTime(0, start);
	envelope.gain.linearRampToValueAtTime(gain, start + 0.02);
	envelope.gain.exponentialRampToValueAtTime(gain * 0.4, start + duration * 0.6);
	envelope.gain.linearRampToValueAtTime(0, end);
	envelope.connect(dest);

	formants.forEach((frequency, index) => {
		const filter = ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = frequency;
		filter.Q.value = 6;
		const level = ctx.createGain();
		level.gain.value = FORMANT_GAINS[index] * 3;
		buzz.connect(filter).connect(level).connect(envelope);
	});

	buzz.start(start);
	buzz.stop(end + 0.02);

	// The aspirated "h" before the vowel
	noise(ctx, dest, {
		duration: 0.07,
		filterType: 'bandpass',
		filterFrequency: formants[1],
		q: 0.9,
		gain: gain * breath * 0.5,
		delay
	});
}

/** A short melodic phrase; each note's `delay` is relative to when the sequence is triggered */
export function sequence(ctx: AudioContext, dest: AudioNode, notes: readonly ToneOptions[]): void {
	for (const note of notes) tone(ctx, dest, note);
}
