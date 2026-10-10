/*
 * How the two cameo archetypes react. Both are original caricatures, not real people:
 *  - the Tycoon, a stout businessman in a tight suit, watches the electricity price;
 *  - the Critic, a woman with long black hair and a permanently disgusted face, watches how dirty the
 *    mix is and whether the nuclear plant is being switched on and off again.
 * Each one has three poses: calm, annoyed and outraged. Everything here is a pure function of the
 * numbers the simulation produces.
 */

export type Mood = 'calm' | 'annoyed' | 'outraged';

export const MOODS: readonly Mood[] = ['calm', 'annoyed', 'outraged'];

export type CameoKind = 'businessman' | 'woman';

/** Why the Critic is upset: the dirty mix, or the nuclear plant going on and off */
export type WomanReason = 'mix' | 'nuclear';

/** Smoothed price in euro per MWh from which the Tycoon is annoyed, and outraged */
export const PRICE_ANNOYED = 70;
export const PRICE_OUTRAGED = 100;
/** Smoothed emissions in g CO2 per kWh from which the Critic is annoyed, and outraged */
export const INTENSITY_ANNOYED = 300;
export const INTENSITY_OUTRAGED = 500;
/** Nuclear switch-overs within these hours annoy her; two of them within a day outrage her */
export const FLIP_ANNOYED_HOURS = 12;
export const FLIP_OUTRAGED_HOURS = 24;

export function severity(mood: Mood): 0 | 1 | 2 {
	return mood === 'calm' ? 0 : mood === 'annoyed' ? 1 : 2;
}

export function businessmanMood(price: number): Mood {
	if (price >= PRICE_OUTRAGED) return 'outraged';
	return price >= PRICE_ANNOYED ? 'annoyed' : 'calm';
}

export interface WomanReaction {
	mood: Mood;
	reason: WomanReason;
}

/**
 * The Critic's mood: the dirty mix sets the base, and nuclear flip-flopping can only make it worse.
 * `flipsInHalfDay` and `flipsInDay` count the nuclear switch-overs in the last 12 and 24 game hours.
 */
export function womanReaction(
	intensity: number,
	flipsInHalfDay: number,
	flipsInDay: number
): WomanReaction {
	const mix: Mood =
		intensity >= INTENSITY_OUTRAGED
			? 'outraged'
			: intensity >= INTENSITY_ANNOYED
				? 'annoyed'
				: 'calm';
	const nuclear: Mood = flipsInDay >= 2 ? 'outraged' : flipsInHalfDay >= 1 ? 'annoyed' : 'calm';
	// The flipping wins a tie, because it is the more specific complaint
	return severity(nuclear) >= severity(mix) && nuclear !== 'calm'
		? { mood: nuclear, reason: 'nuclear' }
		: { mood: mix, reason: 'mix' };
}

export interface Reactions {
	businessman: Mood;
	woman: Mood;
	womanReason: WomanReason;
	/** Who gets the speech bubble: the more upset one, or nobody when both are calm */
	speaker: CameoKind | null;
}

export function reactionsFor(
	price: number,
	intensity: number,
	flipsInHalfDay: number,
	flipsInDay: number
): Reactions {
	const businessman = businessmanMood(price);
	const woman = womanReaction(intensity, flipsInHalfDay, flipsInDay);
	const bs = severity(businessman);
	const ws = severity(woman.mood);
	const speaker: CameoKind | null = bs === 0 && ws === 0 ? null : ws > bs ? 'woman' : 'businessman';
	return { businessman, woman: woman.mood, womanReason: woman.reason, speaker };
}

/** Name of the cameo image in static/assets/cameos/ */
export function cameoFile(kind: CameoKind, mood: Mood): string {
	return `energiewende-${kind}-${mood}.svg`;
}

/** Which cameo closes the game: whoever was unhappier over the run, the Tycoon on a tie */
export function gameOverCameo(grievance: { businessman: number; woman: number }): CameoKind {
	return grievance.woman > grievance.businessman ? 'woman' : 'businessman';
}

/** The mood a run's grievance corresponds to: average severity per hour on the 0..2 scale */
export function averageMood(grievance: number, hours: number): Mood {
	const average = hours > 0 ? grievance / hours : 0;
	return average >= 1.2 ? 'outraged' : average >= 0.4 ? 'annoyed' : 'calm';
}
