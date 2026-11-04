/*
 * The five candles around the rug. A lit candle grows its flame towards full size and burns a
 * little wax; a candle that has been put out (by a draft, thunder or the candles event) can be lit
 * again with a tap, unless its wax is gone. The light they give calms the cats; in the dark an
 * idle cat slowly gets upset.
 */
import {
	CANDLE_COUNT,
	CANDLE_FALL_PER_S,
	CANDLE_FUEL_PER_S,
	CANDLE_RISE_PER_S,
	LIGHT_MOOD_PER_S,
	LIGHT_NEUTRAL
} from './config';

export interface Candle {
	lit: boolean;
	/** The flame's size, 0 (out) to 1; follows `lit` smoothly */
	level: number;
	/** Wax left, 1 to 0 */
	fuel: number;
}

export function createCandles(): Candle[] {
	return Array.from({ length: CANDLE_COUNT }, () => ({ lit: true, level: 1, fuel: 1 }));
}

/** Puts a candle out; returns whether it was burning */
export function snuff(candle: Candle): boolean {
	if (!candle.lit) return false;
	candle.lit = false;
	return true;
}

/** Lights a candle that is out and still has wax; returns whether it caught */
export function relight(candle: Candle): boolean {
	if (candle.lit || candle.fuel <= 0) return false;
	candle.lit = true;
	return true;
}

/** Picks up to `count` burning candles at random and puts them out; returns their indices */
export function snuffSome(candles: Candle[], count: number, random: () => number): number[] {
	const burning = candles.flatMap((candle, index) => (candle.lit ? [index] : []));
	const out: number[] = [];
	while (out.length < count && burning.length > 0) {
		const pick = burning.splice(Math.floor(random() * burning.length), 1)[0];
		candles[pick].lit = false;
		out.push(pick);
	}
	return out;
}

/** How much light the room has, 0 (dark) to 1 (every flame at full size) */
export function candleLight(candles: readonly Candle[]): number {
	if (candles.length === 0) return 0;
	return candles.reduce((sum, candle) => sum + candle.level, 0) / candles.length;
}

/** Candles still burning */
export function litCount(candles: readonly Candle[]): number {
	return candles.filter((candle) => candle.lit).length;
}

/** What darkness does to an idle cat's mood per second: nothing while the room is bright enough, then a slow slide */
export function lightMoodRate(light: number): number {
	return Math.max(0, LIGHT_NEUTRAL - light) * -LIGHT_MOOD_PER_S || 0;
}

/** Light makes a cat settle back to its resting mood faster: 0.5 times in the dark, 1.5 times in full light */
export function settleFactor(light: number): number {
	return 0.5 + light;
}

/** Candles whose wax has run out, and so can never be lit again */
export function burntOut(candles: readonly Candle[]): number {
	return candles.filter((candle) => candle.fuel <= 0).length;
}

/** Burns wax and moves every flame towards its target size */
export function stepCandles(candles: Candle[], dtMs: number): void {
	const dt = dtMs / 1000;
	for (const candle of candles) {
		if (candle.lit) {
			candle.fuel = Math.max(0, candle.fuel - CANDLE_FUEL_PER_S * dt);
			if (candle.fuel <= 0) candle.lit = false;
		}
		const target = candle.lit ? 1 : 0;
		const rate = candle.lit ? CANDLE_RISE_PER_S : CANDLE_FALL_PER_S;
		const gap = target - candle.level;
		candle.level += Math.sign(gap) * Math.min(Math.abs(gap), rate * dt);
	}
}

/** Per-candle flicker (0 to 1), a pure function of time so the renderer and the tests agree */
export function flameFlicker(index: number, timeMs: number, restless: number): number {
	const t = timeMs / 1000;
	const wobble = Math.sin(t * (7.3 + index * 1.7)) * 0.5 + Math.sin(t * (13.1 + index * 0.9)) * 0.5;
	return 0.5 + 0.5 * wobble * (0.35 + 0.65 * restless);
}
