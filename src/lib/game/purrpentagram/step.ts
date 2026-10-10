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
	MOOD_DRIFT_PER_S,
	NAME_HAPPINESS,
	PET_IDLE_MS,
	PITCH_HAPPINESS,
	PURR_FALL_PER_S,
	PURR_RISE_PER_S,
	SCRUB_COOLDOWN_MS,
	SCRUB_HISS_WINDOW_MS,
	SULK_MS,
	UNSETTLED_MOOD
} from './config';
import { RESTING_MOOD } from './cats';
import { petSample, purrVolume, startStroke, type PetSample } from './petting';
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

/** A cat can be petted unless it is off chasing something or sulking after a hiss */
export function canPet(cat: CatState): boolean {
	return cat.motion?.kind !== 'chase' && cat.sulkMs <= 0;
}

/** A cat can be joined into the star when it is on its seat and calm enough to take part */
export function canLink(cat: CatState): boolean {
	return !blocksSeat(cat.motion?.kind ?? null) && cat.mood >= UNSETTLED_MOOD;
}

export function beginPet(state: RitualState, catId: number): void {
	const cat = state.cats[catId];
	if (cat && state.phase === 'playing') cat.stroke = startStroke();
}

/** The finger moved inside the cat's circle */
export function petMove(state: RitualState, catId: number, sample: PetSample): RitualEvent[] {
	const cat = state.cats[catId];
	if (!cat || state.phase !== 'playing' || !canPet(cat)) return [];
	cat.stroke = petSample(cat.stroke ?? startStroke(), sample);
	cat.idleMs = 0;
	if (cat.stroke.feel !== 'scrub') {
		cat.purrTarget = purrVolume(cat.stroke.distance, cat.stroke.speed);
		return [];
	}

	// Scrubbing: no purr, and the cat shows what it thinks of it
	cat.purrTarget = 0;
	if (cat.scrubCooldownMs > 0) return [];
	cat.scrubCooldownMs = SCRUB_COOLDOWN_MS;
	const hiss = cat.sinceScrubMs < SCRUB_HISS_WINDOW_MS;
	cat.sinceScrubMs = 0;
	if (hiss) {
		cat.motion = { kind: 'hiss', remainingMs: 900 };
		cat.sulkMs = SULK_MS;
		cat.happiness = clamp01(cat.happiness - 0.06);
		cat.mood = clamp01(cat.mood - 0.1);
		cat.stroke = startStroke();
	} else {
		cat.motion = { kind: 'flick', remainingMs: 600 };
		cat.flicks += 1;
	}
	return [{ type: 'scrub', cat: catId, hiss }];
}

/** The finger lifted or left the circle: the purr fades out and the next stroke starts from nothing */
export function endPet(state: RitualState, catId: number): void {
	const cat = state.cats[catId];
	if (!cat) return;
	cat.stroke = null;
	cat.purrTarget = 0;
}

/** A keyboard "pet": adds a gentle stretch of stroke, so holding the key keeps the purr going */
export function nudgePet(state: RitualState, catId: number, units = 130): void {
	const cat = state.cats[catId];
	if (!cat || state.phase !== 'playing' || !canPet(cat)) return;
	const stroke = cat.stroke ?? startStroke();
	cat.stroke = { ...stroke, distance: stroke.distance + units, speed: 200, feel: 'gentle' };
	cat.idleMs = 0;
	cat.purrTarget = purrVolume(cat.stroke.distance, cat.stroke.speed);
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
		if (result.animation !== 'doze') cat.purrTarget = 0;
		events.push({ type: 'reaction', cat: cat.profile.id, animation: result.animation });
	}
	return events;
}

function stepCat(cat: CatState, dtMs: number, events: RitualEvent[]): void {
	const dt = dtMs / 1000;
	cat.sulkMs = Math.max(0, cat.sulkMs - dtMs);
	cat.scrubCooldownMs = Math.max(0, cat.scrubCooldownMs - dtMs);
	cat.sinceScrubMs += dtMs;
	cat.idleMs += dtMs;

	if (cat.motion) {
		cat.motion.remainingMs -= dtMs;
		if (cat.motion.remainingMs <= 0) {
			// A hiding cat stays under the rug until it has been calmed down
			if (cat.motion.kind === 'hide' && cat.mood < HIDE_RECOVER_MOOD) cat.motion.remainingMs = 0;
			else cat.motion = null;
		}
	}

	if (!canPet(cat) || cat.idleMs > PET_IDLE_MS) cat.purrTarget = 0;
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
