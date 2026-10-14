/*
 * The translated words of Purr Pentagram: which message each coat, clue and room event
 * uses. Kept in one place so the riddle, the notes and the screen-reader labels all say the same.
 */
import { m } from '#lib/paraglide/messages.js';
import type { Coat, Quirk } from '#lib/game/purrpentagram/cats.js';
import type { RoomEvent } from '#lib/game/purrpentagram/reactions.js';
import type { Clue, TraitId } from '#lib/game/purrpentagram/riddle.js';

const COAT: Record<Coat, () => string> = {
	black: m.purr_coat_black,
	ginger: m.purr_coat_ginger,
	white: m.purr_coat_white,
	grey: m.purr_coat_grey,
	tabby: m.purr_coat_tabby
};

/** The coat as the riddle puts it: a line of verse rather than a plain colour */
const COAT_CLUE: Record<Coat, () => string> = {
	black: m.purr_clue_coat_black,
	ginger: m.purr_clue_coat_ginger,
	white: m.purr_clue_coat_white,
	grey: m.purr_clue_coat_grey,
	tabby: m.purr_clue_coat_tabby
};

const QUIRK: Record<Quirk, () => string> = {
	fat: m.purr_clue_quirk_fat,
	tophat: m.purr_clue_quirk_tophat,
	crazy: m.purr_clue_quirk_crazy,
	glasses: m.purr_clue_quirk_glasses,
	crown: m.purr_clue_quirk_crown
};

const TRAIT: Record<TraitId, () => string> = {
	'hides-thunder': m.purr_clue_trait_hides_thunder,
	'dozes-dim': m.purr_clue_trait_dozes_dim,
	'chases-laser': m.purr_clue_trait_chases_laser,
	'hisses-draft': m.purr_clue_trait_hisses_draft,
	'stares-laser': m.purr_clue_trait_stares_laser
};

const PURR: readonly (() => string)[] = [
	m.purr_clue_purr_0,
	m.purr_clue_purr_1,
	m.purr_clue_purr_2,
	m.purr_clue_purr_3,
	m.purr_clue_purr_4
];

const EVENT: Record<RoomEvent, () => string> = {
	candles: m.purr_event_candles,
	dim: m.purr_event_dim,
	draft: m.purr_event_draft,
	thunder: m.purr_event_thunder,
	laser: m.purr_event_laser,
	creak: m.purr_event_creak
};

const STEP: readonly (() => string)[] = [
	m.purr_step_1,
	m.purr_step_2,
	m.purr_step_3,
	m.purr_step_4,
	m.purr_step_5
];

/** "the black cat", for the label of a cat */
export const coatText = (coat: Coat): string => COAT[coat]();

/** The words of one clue, such as "the one who answers to the name Ember" */
export function clueText(clue: Clue): string {
	switch (clue.kind) {
		case 'coat':
			return COAT_CLUE[clue.coat]();
		case 'quirk':
			return QUIRK[clue.quirk]();
		case 'possessed':
			return m.purr_clue_possessed();
		case 'name':
			return m.purr_clue_name({ name: clue.name });
		case 'purr':
			return PURR[clue.rank]();
		case 'trait':
			return TRAIT[clue.trait]();
	}
}

/** "First, to wake the circle: the cat in a coat of midnight" */
export const stepText = (step: number, clue: Clue): string =>
	m.purr_riddle_line({ step: STEP[step](), clue: clueText(clue) });

export const eventText = (event: RoomEvent): string => EVENT[event]();
