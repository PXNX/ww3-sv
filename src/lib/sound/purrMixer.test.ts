import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { purrVoice } from '#lib/game/purrpentagram/purr.js';
import { PurrMixer } from './purrMixer';

/** A graph node that accepts any call or property, so the mixer can build its whole graph on it */
function node(): unknown {
	const target = function () {};
	const proxy: unknown = new Proxy(target, {
		get: (_t, prop) => (prop === 'value' ? 0 : prop === 'then' ? undefined : proxy),
		set: () => true,
		apply: () => proxy
	});
	return proxy;
}

/** Counts the oscillators the music creates, and what the audio device was asked to do */
class FakeContext {
	static last: FakeContext;
	currentTime = 0;
	state: 'running' | 'suspended' | 'closed' = 'running';
	sampleRate = 8000;
	destination = node();
	oscillators = 0;
	closed = false;
	constructor() {
		FakeContext.last = this;
	}
	createOscillator() {
		this.oscillators += 1;
		return node();
	}
	createBuffer() {
		return { getChannelData: () => new Float32Array(8) };
	}
	createGain = () => node();
	createBiquadFilter = () => node();
	createConvolver = () => node();
	createStereoPanner = () => node();
	resume() {
		this.state = 'running';
		return Promise.resolve();
	}
	suspend() {
		this.state = 'suspended';
		return Promise.resolve();
	}
	close() {
		this.closed = true;
		this.state = 'closed';
		return Promise.resolve();
	}
}

describe('PurrMixer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('window', { AudioContext: FakeContext });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	/** Lets the clock of the audio context run alongside the timers */
	function advance(ctx: FakeContext, seconds: number) {
		for (let t = 0; t < seconds; t += 0.5) {
			ctx.currentTime += 0.5;
			vi.advanceTimersByTime(500);
		}
	}

	function started() {
		const mixer = new PurrMixer();
		expect(mixer.unlock()).toBe(true);
		const ctx = FakeContext.last;
		mixer.setPurr(0, purrVoice(0, 1, 1));
		const base = ctx.oscillators;
		mixer.startFinale();
		advance(ctx, 6);
		expect(ctx.oscillators).toBeGreaterThan(base);
		return { mixer, ctx };
	}

	it('plays the finale music until the next ritual starts, then schedules no more notes', () => {
		const { mixer, ctx } = started();
		mixer.stopFinale();
		const after = ctx.oscillators;
		advance(ctx, 10);
		expect(ctx.oscillators).toBe(after);
	});

	it('can start the finale again after it was stopped', () => {
		const { mixer, ctx } = started();
		mixer.stopFinale();
		const after = ctx.oscillators;
		mixer.startFinale();
		advance(ctx, 6);
		expect(ctx.oscillators).toBeGreaterThan(after);
	});

	it('stops the music and closes the audio device when the player leaves the screen', () => {
		const { mixer, ctx } = started();
		mixer.dispose();
		const after = ctx.oscillators;
		advance(ctx, 10);
		expect(ctx.oscillators).toBe(after);
		expect(ctx.closed).toBe(true);
	});

	it('holds all sound while the player is away and carries on when they are back', () => {
		const { mixer, ctx } = started();
		mixer.suspend();
		expect(ctx.state).toBe('suspended');
		const held = ctx.oscillators;
		advance(ctx, 5);
		expect(ctx.oscillators).toBe(held);
		mixer.resume();
		expect(ctx.state).toBe('running');
	});
});
