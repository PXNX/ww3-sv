/*
 * One fixed step of the ritual, the petting commands and the star stroke. Pure: the state is
 * mutated, the random comes from the caller, and everything that happened is returned as events
 * for the store to turn into sounds and effects.
 */
import type { Random } from '#lib/game/random.js';
import {
	CALM_PER_S,
	HAPPINESS_PER_S,
	HIDE_RECOVER_MOOD,
	KEY_PET_MS,
	MOOD_DRIFT_PER_S,
	NAME_HAPPINESS,
	PET_FORGET_RATE,
	PITCH_HAPPINESS,
	PURR_FALL_PER_S,
	PURR_RISE_PER_S,
	UNSETTLED_MOOD
} from './config';
import { RESTING_MOOD } from './cats';
import { purrVolume } from './petting';
import {
	blocksSeat,
	drawEvent,
	EVENT_DURATION_MS,
	nextEventGapMs,
	reaction,
	type RoomEvent
} from './reactions';
import { isSolved } from './riddle';
import type { CatState, RitualEvent, RitualState } from './state';

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
	const cat = state.cats[to];
	cat.motion = { kind: 'hiss', remainingMs: 900 };
	cat.mood = clamp01(cat.mood - 0.1);
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
	if (state.closed && isSolved(state.chain, target)) {
		state.phase = 'won';
		state.finaleMs = 0;
		for (const cat of state.cats) endPet(state, cat.profile.id);
		events.push({ type: 'win' });
	}
	return events;
}

function startRoomEvent(state: RitualState, kind: RoomEvent, random: Random): RitualEvent[] {
	const durationMs = EVENT_DURATION_MS[kind];
	state.event = { kind, remainingMs: durationMs, durationMs };
	state.nextEventMs = durationMs + nextEventGapMs(random);
	const events: RitualEvent[] = [{ type: 'room-event', event: kind }];
	for (const cat of state.cats) {
		const result = reaction(cat.profile, kind);
		cat.mood = clamp01(cat.mood + result.moodDelta);
		const seen = { event: kind, animation: result.animation };
		const known = cat.observed.findIndex((entry) => entry.event === kind);
		if (known >= 0) cat.observed[known] = seen;
		else cat.observed.push(seen);
		if (result.animation === 'ignore') continue;
		cat.motion = { kind: result.animation, remainingMs: result.durationMs };
		// A startled cat has to be settled again from the start
		if (result.animation !== 'doze') cat.petMs = 0;
		events.push({ type: 'reaction', cat: cat.profile.id, animation: result.animation });
	}
	return events;
}

function stepCat(cat: CatState, dtMs: number, events: RitualEvent[]): void {
	const dt = dtMs / 1000;
	cat.keyPetMs = Math.max(0, cat.keyPetMs - dtMs);

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
		cat.happiness = clamp01(cat.happiness + cat.purr * HAPPINESS_PER_S * dt);
		cat.mood = clamp01(cat.mood + cat.purr * CALM_PER_S * dt);
	} else {
		const rest = RESTING_MOOD[cat.profile.personality];
		const drift = Math.min(Math.abs(rest - cat.mood), MOOD_DRIFT_PER_S * dt);
		cat.mood += Math.sign(rest - cat.mood) * drift;
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

/** Advances the ritual by dtMs: the room's events, every cat's mood and purr, and the finale clock */
export function stepRitual(state: RitualState, random: Random, dtMs: number): RitualEvent[] {
	if (state.phase === 'won') state.finaleMs += dtMs;
	if (state.phase !== 'playing') return [];
	const events: RitualEvent[] = [];
	state.elapsedMs += dtMs;

	if (state.event) {
		state.event.remainingMs -= dtMs;
		if (state.event.remainingMs <= 0) state.event = null;
	}
	state.nextEventMs -= dtMs;
	if (!state.event && state.nextEventMs <= 0) {
		events.push(...startRoomEvent(state, drawEvent(state.eventBag, random), random));
	}

	for (const cat of state.cats) stepCat(cat, dtMs, events);
	return events;
}
