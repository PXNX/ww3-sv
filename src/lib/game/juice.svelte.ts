/*
 * Reactive front of the juice kit. Any game can call juice.burst()/float()/shake() without mounting
 * anything: JuiceLayer is mounted once in the root layout and listens to this shared state. Canvas
 * games can call the same helpers with pointer coordinates from their own event handlers.
 */

import {
	makeBurst,
	makeFloat,
	stepFloats,
	stepParticles,
	stepShake,
	type BurstKind,
	type FloatText,
	type Particle
} from './juice.js';

const MAX_PARTICLES = 220;
const MAX_FLOATS = 24;

class Juice {
	particles = $state<Particle[]>([]);
	floats = $state<FloatText[]>([]);
	comboText = $state('');
	shakeX = $state(0);
	shakeY = $state(0);
	/** Set by JuiceLayer from the media query; every effect becomes a plain short fade when true */
	reduced = $state(false);
	private nextId = 0;
	private amplitude = 0;

	private id() {
		return ++this.nextId;
	}

	burst(x: number, y: number, kind: BurstKind = 'spark', count = 12) {
		if (this.reduced) return;
		const burst = makeBurst(() => this.id(), x, y, kind, count);
		this.particles = [...this.particles, ...burst].slice(-MAX_PARTICLES);
	}

	float(text: string, x: number, y: number, color?: string) {
		if (this.reduced) return;
		this.floats = [...this.floats, makeFloat(() => this.id(), x, y, text, color)].slice(
			-MAX_FLOATS
		);
	}

	/** A short decaying jolt, used for big hits and mistakes */
	shake(strength = 6) {
		if (this.reduced) return;
		this.amplitude = Math.min(12, Math.max(this.amplitude, strength));
	}

	combo(text: string) {
		if (this.reduced) return;
		this.comboText = text;
		window.clearTimeout(this.comboTimer);
		this.comboTimer = window.setTimeout(() => (this.comboText = ''), 1100);
	}

	/** The result-sheet pop: a wide confetti burst plus a few drifting score numbers */
	celebrate(x: number, y: number, text?: string) {
		this.burst(x, y, 'confetti', 36);
		if (text) this.float(text, x, y - 30, '#f5c83a');
	}

	/** Called by the layer every frame; advances the little physics world */
	step(dt: number, time: number, bounds: { width: number; height: number; floor: number }) {
		if (this.particles.length) {
			this.particles = stepParticles(this.particles, Math.min(dt, 0.05), bounds);
		}
		if (this.floats.length) {
			this.floats = stepFloats(this.floats, Math.min(dt, 0.05));
		}
		if (this.amplitude > 0) {
			const shake = stepShake(
				{ amplitude: this.amplitude, x: this.shakeX, y: this.shakeY },
				dt,
				time
			);
			this.amplitude = shake.amplitude;
			this.shakeX = shake.x;
			this.shakeY = shake.y;
		}
	}

	private comboTimer: ReturnType<typeof setTimeout> | undefined;

	clear() {
		this.particles = [];
		this.floats = [];
		this.comboText = '';
		this.amplitude = 0;
		this.shakeX = 0;
		this.shakeY = 0;
	}
}

export const juice = new Juice();
