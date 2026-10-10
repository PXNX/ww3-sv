/*
 * The sustained sound of Purr Pentagram: one continuous purr voice per cat, and the finale music
 * that the purrs fade into. The one-shot effects live in the shared catalog; these sounds need to
 * keep running and follow the game, so they get their own small mixer.
 *
 * Browsers only start audio after a gesture, so the context is created by unlock(), which the
 * game calls from the player's first touch. Nothing here throws when audio is unavailable: the
 * game plays on in silence.
 *
 * Purr: a low sawtooth, filtered, whose loudness is chopped at about 25 Hz (the rumble of a real
 * purr), with a slow pitch wobble that goes away as the cat gets happy. Finale: the score from
 * game/purrpentagram/music.ts played by organ, choir and drone voices through a generated reverb,
 * while the purrs keep sounding underneath, quieter and in the reverb, so they are part of the mix.
 */
import { CAT_COUNT } from '#lib/game/purrpentagram/config.js';
import { finaleScore, LOOP_SECONDS, type MusicNote } from '#lib/game/purrpentagram/music.js';
import type { PurrVoice } from '#lib/game/purrpentagram/purr.js';

/** How far ahead (seconds) the music is scheduled, and how often the scheduler looks */
const LOOKAHEAD_S = 2.5;
const TICK_MS = 500;
const AUDIBLE = 0.8;

interface Voice {
	osc: OscillatorNode;
	volume: GainNode;
	/** Depth of the pitch wobble, in cents */
	wobbleDepth: GainNode;
	panner: StereoPannerNode | null;
}

export class PurrMixer {
	#ctx: AudioContext | null = null;
	#master: GainNode | null = null;
	#purrBus: GainNode | null = null;
	#purrSend: GainNode | null = null;
	#musicBus: GainNode | null = null;
	#reverb: ConvolverNode | null = null;
	#voices: Voice[] = [];
	#muted = false;
	#timer: ReturnType<typeof setInterval> | undefined;
	#score: MusicNote[] = [];
	#cursor = 0;
	#loopStart = 0;
	#stopped = false;

	/** True once audio is running: false in a browser without Web Audio, or before the first gesture */
	get ready(): boolean {
		return this.#ctx !== null;
	}

	/** Creates the audio graph; call it from a pointer or key event, and again whenever it is convenient */
	unlock(): boolean {
		if (this.#stopped || typeof window === 'undefined') return false;
		if (!this.#ctx) {
			const ContextClass =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!ContextClass) return false;
			try {
				this.#build(new ContextClass());
			} catch {
				this.#ctx = null;
				return false;
			}
		}
		if (this.#ctx && this.#ctx.state === 'suspended') void this.#ctx.resume();
		return true;
	}

	#build(ctx: AudioContext) {
		this.#ctx = ctx;
		this.#master = ctx.createGain();
		this.#master.gain.value = this.#muted ? 0 : AUDIBLE;
		this.#master.connect(ctx.destination);

		this.#purrBus = ctx.createGain();
		this.#purrBus.connect(this.#master);
		this.#musicBus = ctx.createGain();
		this.#musicBus.gain.value = 0;
		this.#musicBus.connect(this.#master);

		// One send into a generated reverb: the music sits in it, and so do the purrs once the finale starts
		this.#reverb = ctx.createConvolver();
		this.#reverb.buffer = impulseResponse(ctx, 3.2);
		const wet = ctx.createGain();
		wet.gain.value = 0.55;
		this.#reverb.connect(wet).connect(this.#master);
		this.#musicBus.connect(this.#reverb);
		// The purrs only enter the reverb once the finale begins
		this.#purrSend = ctx.createGain();
		this.#purrSend.gain.value = 0;
		this.#purrSend.connect(this.#reverb);

		for (let cat = 0; cat < CAT_COUNT; cat++) this.#voices.push(this.#purrVoice(ctx, cat));
	}

	#purrVoice(ctx: AudioContext, cat: number): Voice {
		const osc = ctx.createOscillator();
		osc.type = 'sawtooth';
		osc.frequency.value = 80;

		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = 420;
		filter.Q.value = 0.8;

		// The purr's rumble: the level is chopped by a ~25 Hz oscillator, a touch different per cat
		const chop = ctx.createGain();
		chop.gain.value = 0.55;
		const rumble = ctx.createOscillator();
		rumble.frequency.value = 23 + cat * 1.1;
		const rumbleDepth = ctx.createGain();
		rumbleDepth.gain.value = 0.45;
		rumble.connect(rumbleDepth).connect(chop.gain);

		// A slow pitch wobble, deep for an unsettled cat and gone for a happy one
		const wobble = ctx.createOscillator();
		wobble.frequency.value = 4.6 + cat * 0.37;
		const wobbleDepth = ctx.createGain();
		wobbleDepth.gain.value = 0;
		wobble.connect(wobbleDepth).connect(osc.detune);

		const volume = ctx.createGain();
		volume.gain.value = 0;
		osc.connect(filter).connect(chop).connect(volume);

		const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
		if (panner) volume.connect(panner).connect(this.#purrBus!);
		else volume.connect(this.#purrBus!);
		volume.connect(this.#purrSend!);

		for (const node of [osc, rumble, wobble]) node.start();
		return { osc, volume, wobbleDepth, panner };
	}

	/** Sets how one cat purrs: its pitch, loudness and wobble; pan runs from -1 (left) to 1 (right) */
	setPurr(cat: number, voice: PurrVoice, pan = 0) {
		const ctx = this.#ctx;
		const entry = this.#voices[cat];
		if (!ctx || !entry) return;
		const now = ctx.currentTime;
		entry.osc.frequency.setTargetAtTime(voice.frequency, now, 0.05);
		entry.volume.gain.setTargetAtTime(voice.gain, now, 0.06);
		entry.wobbleDepth.gain.setTargetAtTime(voice.wobbleCents, now, 0.2);
		entry.panner?.pan.setTargetAtTime(Math.min(1, Math.max(-1, pan)), now, 0.05);
	}

	setMuted(muted: boolean) {
		this.#muted = muted;
		if (!this.#ctx || !this.#master) return;
		this.#master.gain.setTargetAtTime(muted ? 0 : AUDIBLE, this.#ctx.currentTime, 0.04);
	}

	/** Brings in the finale music over a few seconds and lets the purrs sink under it */
	startFinale() {
		const ctx = this.#ctx;
		if (!ctx || !this.#musicBus || !this.#purrBus || this.#timer) return;
		const now = ctx.currentTime;
		this.#musicBus.gain.cancelScheduledValues(now);
		this.#musicBus.gain.setValueAtTime(0, now);
		this.#musicBus.gain.linearRampToValueAtTime(1, now + 5);
		this.#purrBus.gain.cancelScheduledValues(now);
		this.#purrBus.gain.setValueAtTime(this.#purrBus.gain.value, now);
		this.#purrBus.gain.linearRampToValueAtTime(0.42, now + 4);
		this.#purrSend?.gain.setTargetAtTime(0.6, now, 1.2);

		this.#score = finaleScore();
		this.#cursor = 0;
		this.#loopStart = now + 0.3;
		this.#timer = setInterval(() => this.#schedule(), TICK_MS);
		this.#schedule();
	}

	/** Schedules every note that starts within the look-ahead window, looping the score forever */
	#schedule() {
		const ctx = this.#ctx;
		if (!ctx || !this.#musicBus || ctx.state !== 'running') return;
		const horizon = ctx.currentTime + LOOKAHEAD_S;
		for (;;) {
			const note = this.#score[this.#cursor];
			const at = this.#loopStart + note.time;
			if (at > horizon) break;
			// A note that is already late (a stalled tab) is dropped rather than all played at once
			if (at >= ctx.currentTime - 0.05) this.#play(ctx, note, at);
			this.#cursor += 1;
			if (this.#cursor >= this.#score.length) {
				this.#cursor = 0;
				this.#loopStart += LOOP_SECONDS;
			}
		}
	}

	#play(ctx: AudioContext, note: MusicNote, at: number) {
		const bus = this.#musicBus!;
		switch (note.voice) {
			case 'drone':
				return playDrone(ctx, bus, note, at);
			case 'organ':
				return playOrgan(ctx, bus, note, at);
			case 'lead':
				return playLead(ctx, bus, note, at);
			case 'choir':
				return playChoir(ctx, bus, note, at);
		}
	}

	/** Stops everything and releases the audio device */
	dispose() {
		this.#stopped = true;
		clearInterval(this.#timer);
		this.#timer = undefined;
		const ctx = this.#ctx;
		this.#ctx = null;
		if (!ctx) return;
		try {
			this.#master?.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
			setTimeout(() => void ctx.close().catch(() => {}), 200);
		} catch {
			// Best-effort
		}
	}
}

/** Reverb tail from decaying stereo noise: no sample file to download */
function impulseResponse(ctx: AudioContext, seconds: number): AudioBuffer {
	const length = Math.floor(ctx.sampleRate * seconds);
	const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let channel = 0; channel < 2; channel++) {
		const data = buffer.getChannelData(channel);
		for (let i = 0; i < length; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
		}
	}
	return buffer;
}

/** A gain envelope that swells in, holds and fades out over the note */
function envelope(
	ctx: AudioContext,
	dest: AudioNode,
	at: number,
	duration: number,
	peak: number,
	attack: number,
	release: number
): GainNode {
	const gain = ctx.createGain();
	const end = at + duration;
	gain.gain.setValueAtTime(0, at);
	gain.gain.linearRampToValueAtTime(peak, at + Math.min(attack, duration / 2));
	gain.gain.setValueAtTime(peak, Math.max(at + attack, end - release));
	gain.gain.linearRampToValueAtTime(0, end);
	gain.connect(dest);
	return gain;
}

function oscillator(
	ctx: AudioContext,
	type: OscillatorType,
	frequency: number,
	at: number,
	end: number,
	dest: AudioNode,
	detune = 0
) {
	const osc = ctx.createOscillator();
	osc.type = type;
	osc.frequency.value = frequency;
	osc.detune.value = detune;
	osc.connect(dest);
	osc.start(at);
	osc.stop(end + 0.05);
}

/** A sub-bass rumble: a sine and a filtered saw an octave up */
function playDrone(ctx: AudioContext, bus: AudioNode, note: MusicNote, at: number) {
	const end = at + note.duration;
	const out = envelope(ctx, bus, at, note.duration, 0.16 * note.level, 0.9, 1.2);
	oscillator(ctx, 'sine', note.frequency, at, end, out);
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = 180;
	filter.connect(out);
	oscillator(ctx, 'sawtooth', note.frequency * 2, at, end, filter);
}

/** A pipe organ chord tone: the first few harmonics, like drawbars pulled out */
function playOrgan(ctx: AudioContext, bus: AudioNode, note: MusicNote, at: number) {
	const end = at + note.duration;
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = 2400;
	filter.connect(bus);
	const out = envelope(ctx, filter, at, note.duration, 0.045 * note.level, 0.35, 0.6);
	[1, 2, 3, 4, 6].forEach((harmonic, index) => {
		const partial = ctx.createGain();
		partial.gain.value = [1, 0.7, 0.45, 0.3, 0.16][index];
		partial.connect(out);
		oscillator(ctx, 'sine', note.frequency * harmonic, at, end, partial);
	});
}

/** The organ's melody: brighter and quicker than the chords, with an octave doubling */
function playLead(ctx: AudioContext, bus: AudioNode, note: MusicNote, at: number) {
	const end = at + note.duration;
	const out = envelope(ctx, bus, at, note.duration, 0.07 * note.level, 0.05, 0.25);
	oscillator(ctx, 'triangle', note.frequency, at, end, out);
	const octave = ctx.createGain();
	octave.gain.value = 0.35;
	octave.connect(out);
	oscillator(ctx, 'sine', note.frequency * 2, at, end, octave);
}

/** A slowly swelling "ah": three detuned saws through two vowel filters */
function playChoir(ctx: AudioContext, bus: AudioNode, note: MusicNote, at: number) {
	const end = at + note.duration;
	const out = envelope(ctx, bus, at, note.duration, 0.034 * note.level, 1.5, 1.7);
	for (const formant of [780, 1180]) {
		const filter = ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = formant;
		filter.Q.value = 4;
		filter.connect(out);
		for (const detune of [-9, 0, 9]) {
			oscillator(ctx, 'sawtooth', note.frequency, at, end, filter, detune);
		}
	}
}
