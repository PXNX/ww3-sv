/*
 * The sound each bird makes when its tap ability fires. Every bird with an ability has its own
 * sound, so the ability can be told apart by ear; a bird without one (the pelican) is silent.
 */
import type { SoundId } from '#lib/sound/sounds.js';
import type { BirdKind } from './birds';

export const ABILITY_SOUNDS: Partial<Record<BirdKind, SoundId>> = {
	flamingo: 'ability-split',
	stork: 'ability-dash',
	goose: 'ability-egg',
	falcon: 'ability-dive',
	phoenix: 'ability-blast',
	parrot: 'ability-boomerang'
};
