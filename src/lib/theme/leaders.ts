/*
 * Everyone who can be featured in a game: the fourteen game-over cameos plus the mascot (the USA),
 * Kim Jong Un, Maduro and Zuckerberg, who only appear on the start screen and the result sheets.
 * Each leader stands for one country, so the flag on a game card and the leader filter share this
 * one list.
 */
import type { Random } from '#lib/game/random.js';
import { m } from '#lib/paraglide/messages.js';
import {
	CAMEOS,
	MASCOT_FLAG,
	cameoFlag,
	cameoPortrait,
	flagAsset,
	guestFlag,
	guestPortrait,
	putinPortrait,
	type CameoId,
	type GuestId
} from './cameos.js';
import { mascotImage, type MascotPose } from './character.js';

export type LeaderId = CameoId | GuestLeaderId | 'trump';

type GuestLeaderId = Extract<
	GuestId,
	'kim' | 'maduro' | 'zuckerberg' | 'huang' | 'altman' | 'musk'
>;

export interface Leader {
	id: LeaderId;
	name: () => string;
	/** Flag of the leader's country, shown on game cards and behind the portrait */
	flag: string;
	/** The neutral portrait used in the start-screen lineup */
	portrait: string;
}

const cameoLeader = (id: CameoId): Leader => ({
	id,
	name: CAMEOS.find((cameo) => cameo.id === id)!.name,
	flag: cameoFlag(id),
	portrait: cameoPortrait(id)
});

/** In lineup order: the mascot first, then the roster, then the guests */
export const LEADERS: readonly Leader[] = [
	{ id: 'trump', name: m.leader_trump_name, flag: MASCOT_FLAG, portrait: mascotImage('idle') },
	...CAMEOS.map((cameo) => cameoLeader(cameo.id)),
	{
		id: 'kim',
		name: m.leader_kim_name,
		flag: flagAsset('kp'),
		portrait: guestPortrait('kim')
	},
	{
		id: 'maduro',
		name: m.leader_maduro_name,
		flag: flagAsset('ve'),
		portrait: guestPortrait('maduro')
	},
	{
		// Not a head of state: the platform owner, kept next to the other guests
		id: 'zuckerberg',
		name: m.leader_zuckerberg_name,
		flag: guestFlag('zuckerberg'),
		portrait: guestPortrait('zuckerberg')
	},
	{
		// The leather jacket from Chip Fab Rush, now with a flag
		id: 'huang',
		name: m.leader_huang_name,
		flag: guestFlag('huang'),
		portrait: guestPortrait('huang')
	},
	{
		id: 'altman',
		name: m.leader_altman_name,
		flag: guestFlag('altman'),
		portrait: guestPortrait('altman')
	},
	{
		id: 'musk',
		name: m.leader_musk_name,
		flag: guestFlag('musk'),
		portrait: guestPortrait('musk')
	}
];

export function leaderById(id: LeaderId): Leader {
	const leader = LEADERS.find((candidate) => candidate.id === id);
	if (!leader) throw new Error(`Unknown leader: ${id}`);
	return leader;
}

/** How the mascot looks when the player loses; the sunken pose is saved for the game itself */
const MASCOT_LOSS_POSES: readonly MascotPose[] = ['crying', 'rage', 'shocked', 'facepalm'];

/**
 * A leader's portrait as they react to the player's result. The mascot is smug on a win and
 * picks one of its upset poses on a loss; Putin is furious when beaten and calm otherwise; everyone
 * else keeps one face.
 */
export function leaderReaction(
	id: LeaderId,
	outcome: 'won' | 'lost',
	random: Random = Math.random
): string {
	if (id === 'trump') {
		return mascotImage(
			outcome === 'won'
				? 'smug'
				: MASCOT_LOSS_POSES[Math.floor(random() * MASCOT_LOSS_POSES.length)]
		);
	}
	if (id === 'putin') return putinPortrait(outcome === 'won' ? 'angry' : 'calm');
	return leaderById(id).portrait;
}
