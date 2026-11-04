/*
 * One fixed step of the ritual, the petting commands and the star stroke. Pure: the state is
 * mutated, the random comes from the caller, and everything that happened is returned as events
 * for the store to turn into sounds and effects.
 */
import type { Random } from '#lib/game/random.js';
import { hop, stepBody, type BodyTarget } from './body';
import {
	candleLight,
	lightMoodRate,
	settleFactor,
	relight,
	snuffSome,
	stepCandles
} from './candles';
import {
	CALM_PER_S,
	COMBO_MAX,
	COMBO_WINDOW_MS,
	ESCALATION_PER_CAT,
	HAPPINESS_PER_S,
	HIDE_RECOVER_MOOD,
	KEY_PET_MS,
	MOOD_DRIFT_PER_S,
	NAME_HAPPINESS,
	OMEN_MS,
	PET_FORGET_RATE,
	PITCH_HAPPINESS,
	PURR_FALL_PER_S,
	PURR_RISE_PER_S,
	SATED_MS,
	SATED_PURR_FACTOR,
	SCORE_PER_COMBO,
	TREAT_HAPPINESS,
	TREAT_MOOD,
	UNSETTLED_MOOD
} from './config';
import { RESTING_MOOD } from './cats';
import { LINE_MS } from './finale';
import { seatPosition, type Point } from './geometry';
import { PACT_TABLE } from './pacts';
import { purrVolume } from './petting';
import {
	blocksSeat,
	drawEvent,
	EVENT_DURATION_MS,
	laserPoint,
	nextEventGapMs,
	reaction,
	type RoomEvent
} from './reactions';
import { isSolved } from './riddle';
import type { CatState, Motion, RitualEvent, RitualState } from './state';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** A cat can be petted unless it is off chasing something */
export function canPet(cat: CatState): boolean {
	return cat.motion?.kind !== 'chase';
}

/** A cat can be joined into the star when it is on its seat and calm enough to take part */
export function canLink(cat: CatState): boolean {
	return !blocksSeat(cat.motion?.kind ?? null) && cat.mood >= UNSETTLED_MOOD;
}

/** A finger lands on the cat: it is petted for as long as the finger stays */
export function beginPet(state: RitualState, catId: number): void {
	const cat = state.cats[catId];
	if (cat && state.phase === 'playing') cat.held = true;
}

/** The finger lifted or left the circle: the purr fades out */
export function endPet(state: RitualState, catId: number): void {
	const cat = state.cats[catId];
	if (!cat) return;
	cat.held = false;
	cat.keyPetMs = 0;
}

/** A keyboard "pet": counts as petting for a moment, so holding the key keeps the purr going */
export function nudgePet(state: RitualState, catId: number): void {
	const cat = state.cats[catId];
	if (!cat || state.phase !== 'playing' || !canPet(cat)) return;
	cat.keyPetMs = KEY_PET_MS;
}

function mistake(state: RitualState, from: number, to: number): RitualEvent[] {
	state.mistakes += 1;
	state.lives -= 1;
	state.combo = 0;
	state.comboMs = 0;
	const cat = state.cats[to];
	cat.motion = { kind: 'hiss', remainingMs: 900 };
	cat.mood = clamp01(cat.mood - 0.1);
	hop(cat.body, 340);
	const events: RitualEvent[] = [{ type: 'mistake', from, to, livesLeft: state.lives }];
	if (state.lives <= 0) {
		state.phase = 'over';
		events.push({ type: 'game-over' });
	}
	return events;
}

/**
 * The player drew a star stroke from one cat to another. The first stroke may start anywhere; after
 * that every stroke continues from the cat the last one ended on. A stroke to the right cat lights
 * a line; to the wrong cat it costs a heart. A cat that is hiding, away or too upset cannot be
 * joined yet and nothing is lost.
 */
export function connect(state: RitualState, from: number, to: number): RitualEvent[] {
	if (state.phase !== 'playing' || from === to) return [];
	const start = state.cats[from];
	const end = state.cats[to];
	if (!start || !end) return [];

	const tip = state.chain.at(-1);
	if (tip !== undefined && from !== tip) return [{ type: 'out-of-turn', cat: from }];
	for (const id of [from, to]) {
		if (!canLink(state.cats[id])) return [{ type: 'not-ready', cat: id }];
	}

	const { target } = state.riddle;
	// With every cat joined, the last stroke has to close the star by going back to the first cat
	const closing = state.chain.length === target.length;
	const next = closing ? [] : state.chain.length === 0 ? [from, to] : [to];
	const expected = closing
		? [target[0]]
		: target.slice(state.chain.length, state.chain.length + next.length);
	if ((closing ? [to] : next).some((id, index) => id !== expected[index])) {
		return mistake(state, from, to);
	}

	state.chain.push(...next);
	state.closed = closing;
	const index = closing ? target.length - 1 : state.chain.length - 2;
	const events: RitualEvent[] = [{ type: 'line', from, to, index }];
	// Both cats of the stroke bounce: the one it ends on higher than the one it left
	hop(start.body, 230);
	hop(end.body, 330);
	// A stroke soon after the last one keeps the combo going; each step in the chain pays more
	state.combo = state.comboMs > 0 ? Math.min(COMBO_MAX, state.combo + 1) : 1;
	state.comboMs = COMBO_WINDOW_MS;
	state.bestCombo = Math.max(state.bestCombo, state.combo);
	const points = SCORE_PER_COMBO * (state.combo - 1);
	state.comboPoints += points;
	events.push({ type: 'combo', combo: state.combo, points });
	if (state.closed && isSolved(state.chain, target)) {
		state.phase = 'won';
		state.finaleMs = 0;
		for (const cat of state.cats) endPet(state, cat.profile.id);
		events.push({ type: 'win' });
	}
	return events;
}

/** A tap on a candle that is out lights it again, if it has any wax left */
export function relightCandle(state: RitualState, index: number): RitualEvent[] {
	const candle = state.candles[index];
	if (!candle || state.phase !== 'playing') return [];
	if (candle.lit) return [];
	if (!relight(candle)) return [{ type: 'candle-spent', index }];
	return [{ type: 'candle-lit', index }];
}

/**
 * Feeds a cat a treat: an instant heart and a calmer cat, but the treat costs score and the cat,
 * being full, warms up more slowly for a while. Only a limited number of treats.
 */
export function feedCat(state: RitualState, catId: number): RitualEvent[] {
	const cat = state.cats[catId];
	if (!cat || state.phase !== 'playing' || !canPet(cat)) return [];
	if (state.treats <= 0) return [{ type: 'no-treats' }];
	state.treats -= 1;
	state.treatsUsed += 1;
	cat.happiness = clamp01(cat.happiness + TREAT_HAPPINESS);
	cat.mood = clamp01(cat.mood + TREAT_MOOD);
	cat.satedMs = SATED_MS;
	hop(cat.body, 260);
	return [{ type: 'treat', cat: catId }];
}

/** How restless the room is: it grows with every cat joined into the star */
export function restlessness(state: RitualState): number {
	return 1 + ESCALATION_PER_CAT * state.chain.length;
}

function startRoomEvent(state: RitualState, kind: RoomEvent, random: Random): RitualEvent[] {
	const durationMs = EVENT_DURATION_MS[kind];
	state.event = { kind, remainingMs: durationMs, durationMs };
	const gap = (nextEventGapMs(random) * PACT_TABLE[state.pact].eventGap) / restlessness(state);
	state.nextEventMs = durationMs + gap;
	const events: RitualEvent[] = [{ type: 'room-event', event: kind }];
	// Wind, thunder and the candles event put candles out
	const snuffed =
		kind === 'candles'
			? snuffSome(state.candles, 3, random)
			: kind === 'draft'
				? snuffSome(state.candles, random() < 0.5 ? 2 : 1, random)
				: kind === 'thunder'
					? snuffSome(state.candles, 1, random)
					: [];
	for (const index of snuffed) events.push({ type: 'candle-out', index });
	const scare = restlessness(state);
	for (const cat of state.cats) {
		const result = reaction(cat.profile, kind);
		// Later in the ritual the room is more frightening
		const delta = result.moodDelta < 0 ? result.moodDelta * scare : result.moodDelta;
		cat.mood = clamp01(cat.mood + delta);
		if (result.animation === 'flinch') hop(cat.body, 420);
		else if (result.animation === 'hiss') hop(cat.body, 300);
		else if (result.animation === 'hide') hop(cat.body, 220);
		if (result.animation === 'ignore') continue;
		cat.motion = { kind: result.animation, remainingMs: result.durationMs };
		// A startled cat has to be settled again from the start
		if (result.animation !== 'doze') cat.petMs = 0;
		events.push({ type: 'reaction', cat: cat.profile.id, animation: result.animation });
	}
	return events;
}

interface RoomContext {
	/** Candle light, 0 to 1 */
	light: number;
	/** Where the laser dot is, while there is one */
	laser: Point | null;
}

/** The squash a cat rests at: a dozing cat sinks into a loaf, a hiding one flattens */
function restingSquash(motion: Motion | null): number {
	return motion?.kind === 'doze' ? -0.08 : motion?.kind === 'hide' ? -0.18 : 0;
}

/** The cat's body: it chases the laser dot with pounces, springs back to its seat, and lands with a squash */
function moveBody(cat: CatState, dtMs: number, room: RoomContext, events: RitualEvent[]): void {
	const laser = cat.motion?.kind === 'chase' ? room.laser : null;
	const seat = seatPosition(cat.seat);
	const target: BodyTarget = {
		x: laser ? (laser.x - seat.x) * 0.62 : 0,
		y: laser ? (laser.y - seat.y) * 0.62 : 0,
		squash: restingSquash(cat.motion)
	};
	if (laser) {
		cat.pounceMs -= dtMs;
		if (cat.pounceMs <= 0) {
			cat.pounceMs = 720 + cat.profile.id * 90;
			hop(cat.body, 520, Math.sign(target.x - cat.body.x) * 60);
		}
	}
	const landed = stepBody(cat.body, dtMs, target, cat.purr);
	if (landed > 250) events.push({ type: 'landing', cat: cat.profile.id, strength: landed });
}

function stepCat(cat: CatState, dtMs: number, room: RoomContext, events: RitualEvent[]): void {
	const dt = dtMs / 1000;
	cat.keyPetMs = Math.max(0, cat.keyPetMs - dtMs);
	cat.satedMs = Math.max(0, cat.satedMs - dtMs);
	moveBody(cat, dtMs, room, events);

	if (cat.motion) {
		cat.motion.remainingMs -= dtMs;
		if (cat.motion.remainingMs <= 0) {
			// A hiding cat stays under the rug until it has been calmed down
			if (cat.motion.kind === 'hide' && cat.mood < HIDE_RECOVER_MOOD) cat.motion.remainingMs = 0;
			else cat.motion = null;
		}
	}

	const petted = (cat.held || cat.keyPetMs > 0) && canPet(cat);
	cat.petMs = petted ? cat.petMs + dtMs : Math.max(0, cat.petMs - dtMs * PET_FORGET_RATE);
	cat.purrTarget = petted ? purrVolume(cat.petMs) : 0;
	const rate = cat.purr < cat.purrTarget ? PURR_RISE_PER_S : PURR_FALL_PER_S;
	const gap = cat.purrTarget - cat.purr;
	cat.purr = clamp01(cat.purr + Math.sign(gap) * Math.min(Math.abs(gap), rate * dt));

	if (cat.purr > 0.05) {
		const appetite = cat.satedMs > 0 ? SATED_PURR_FACTOR : 1;
		cat.happiness = clamp01(cat.happiness + cat.purr * HAPPINESS_PER_S * appetite * dt);
		cat.mood = clamp01(cat.mood + cat.purr * CALM_PER_S * dt);
	} else {
		const rest = RESTING_MOOD[cat.profile.personality];
		const drift = Math.min(
			Math.abs(rest - cat.mood),
			MOOD_DRIFT_PER_S * settleFactor(room.light) * dt
		);
		cat.mood += Math.sign(rest - cat.mood) * drift;
		// In the dark an idle cat slowly gets upset
		cat.mood = clamp01(cat.mood + lightMoodRate(room.light) * dt);
	}

	const id = cat.profile.id;
	if (!cat.nameShown && cat.happiness >= NAME_HAPPINESS) {
		cat.nameShown = true;
		events.push({ type: 'name-shown', cat: id });
	}
	if (!cat.pitchShown && cat.happiness >= PITCH_HAPPINESS) {
		cat.pitchShown = true;
		events.push({ type: 'pitch-shown', cat: id });
	}
}

/** The room event announces itself shortly before it begins */
function stepEvents(state: RitualState, random: Random, dtMs: number, events: RitualEvent[]) {
	if (state.event) {
		state.event.remainingMs -= dtMs;
		if (state.event.remainingMs <= 0) state.event = null;
	}
	state.nextEventMs -= dtMs;
	if (state.event) return;
	if (!state.omen && state.nextEventMs <= OMEN_MS) {
		const kind = drawEvent(state.eventBag, random);
		state.omen = { kind, remainingMs: Math.max(0, state.nextEventMs) };
		events.push({ type: 'omen', event: kind });
	}
	if (state.omen) {
		state.omen.remainingMs -= dtMs;
		if (state.omen.remainingMs <= 0) {
			const { kind } = state.omen;
			state.omen = null;
			events.push(...startRoomEvent(state, kind, random));
		}
	}
}

/** Advances the ritual by dtMs: the room's events, the candles, every cat's mood and purr, and the finale clock */
export function stepRitual(state: RitualState, random: Random, dtMs: number): RitualEvent[] {
	const events: RitualEvent[] = [];
	if (state.phase === 'won') {
		state.finaleMs += dtMs;
		const room: RoomContext = { light: 1, laser: null };
		for (const cat of state.cats) moveBody(cat, dtMs, room, events);
		// In the finale the cats bounce one after the other as the lines ignite
		const lit = Math.min(state.chain.length, Math.floor(state.finaleMs / LINE_MS) + 1);
		while (state.finaleHops < lit) {
			hop(state.cats[state.chain[state.finaleHops]].body, 380);
			state.finaleHops += 1;
		}
		return events;
	}
	if (state.phase !== 'playing') return events;
	state.elapsedMs += dtMs;

	state.comboMs = Math.max(0, state.comboMs - dtMs);
	if (state.comboMs === 0) state.combo = 0;

	const wasLit = state.candles.map((candle) => candle.lit);
	stepCandles(state.candles, dtMs);
	state.candles.forEach((candle, index) => {
		if (wasLit[index] && !candle.lit) events.push({ type: 'candle-spent', index });
	});

	stepEvents(state, random, dtMs, events);

	const event = state.event;
	const room: RoomContext = {
		light: candleLight(state.candles),
		laser:
			event?.kind === 'laser'
				? laserPoint((event.durationMs - event.remainingMs) / event.durationMs)
				: null
	};
	for (const cat of state.cats) stepCat(cat, dtMs, room, events);
	return events;
}
