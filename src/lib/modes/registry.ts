import type { Component } from 'svelte';
import type { SvelteHTMLElements } from 'svelte/elements';
import type { RouteId } from '$app/types';
import { m } from '#lib/paraglide/messages.js';
import IconBlocks from '~icons/lucide/blocks';
import IconBomb from '~icons/lucide/bomb';
import IconShip from '~icons/lucide/ship';
import IconMerge from '~icons/lucide/merge';
import IconCrosshair from '~icons/lucide/crosshair';
import IconFuel from '~icons/lucide/fuel';
import IconFeather from '~icons/lucide/feather';
import IconBird from '~icons/lucide/bird';
import IconCastle from '~icons/lucide/castle';
import IconShield from '~icons/lucide/shield';
import IconParking from '~icons/lucide/square-parking';
import IconRadar from '~icons/lucide/radar';
import IconMegaphone from '~icons/lucide/megaphone';

export type ModeId =
	| 'blocks'
	| 'minefield'
	| 'convoy'
	| 'merge'
	| 'shootdown'
	| 'pipeline'
	| 'flamingo'
	| 'fury'
	| 'chess'
	| 'dronewall'
	| 'parking'
	| 'slice'
	| 'whack';

interface ModeBase {
	id: ModeId;
	icon: Component<SvelteHTMLElements['svg']>;
	/** Tailwind background class for the icon tile, from the design tokens */
	tileClass: string;
	name: () => string;
	description: () => string;
}

/**
 * A mode becomes tappable by switching it to { status: 'playable', href: '/play/<id>' };
 * the href is type-checked against the routes that actually exist.
 */
export type GameMode = ModeBase &
	({ status: 'coming-soon' } | { status: 'playable'; href: RouteId });

/** Single list of game modes; the start screen renders from it (requirements Section 19) */
export const MODES: readonly GameMode[] = [
	{
		id: 'blocks',
		status: 'playable',
		href: '/play/blocks',
		icon: IconBlocks,
		tileClass: 'bg-khaki',
		name: m.mode_blocks_name,
		description: m.mode_blocks_description
	},
	{
		id: 'minefield',
		status: 'playable',
		href: '/play/minefield',
		icon: IconBomb,
		tileClass: 'bg-tie-red',
		name: m.mode_minefield_name,
		description: m.mode_minefield_description
	},
	{
		id: 'convoy',
		status: 'playable',
		href: '/play/convoy',
		icon: IconShip,
		tileClass: 'bg-flag-blue',
		name: m.mode_convoy_name,
		description: m.mode_convoy_description
	},
	{
		id: 'merge',
		status: 'playable',
		href: '/play/merge',
		icon: IconMerge,
		tileClass: 'bg-skin',
		name: m.mode_merge_name,
		description: m.mode_merge_description
	},
	{
		id: 'shootdown',
		status: 'playable',
		href: '/play/shootdown',
		icon: IconCrosshair,
		tileClass: 'bg-sky',
		name: m.mode_shootdown_name,
		description: m.mode_shootdown_description
	},
	{
		id: 'pipeline',
		status: 'playable',
		href: '/play/pipeline',
		icon: IconFuel,
		tileClass: 'bg-mustard',
		name: m.mode_pipeline_name,
		description: m.mode_pipeline_description
	},
	{
		id: 'flamingo',
		status: 'playable',
		href: '/play/flamingo',
		icon: IconFeather,
		tileClass: 'bg-skin',
		name: m.mode_flamingo_name,
		description: m.mode_flamingo_description
	},
	{
		id: 'fury',
		status: 'playable',
		href: '/play/fury',
		icon: IconBird,
		tileClass: 'bg-explosion-yellow',
		name: m.mode_fury_name,
		description: m.mode_fury_description
	},
	{
		id: 'chess',
		status: 'playable',
		href: '/play/chess',
		icon: IconCastle,
		tileClass: 'bg-banner-slate',
		name: m.mode_chess_name,
		description: m.mode_chess_description
	},
	{
		id: 'dronewall',
		status: 'playable',
		href: '/play/dronewall',
		icon: IconShield,
		tileClass: 'bg-khaki',
		name: m.mode_dronewall_name,
		description: m.mode_dronewall_description
	},
	{
		id: 'parking',
		status: 'playable',
		href: '/play/parking',
		icon: IconParking,
		tileClass: 'bg-sky',
		name: m.mode_parking_name,
		description: m.mode_parking_description
	},
	{
		id: 'slice',
		status: 'playable',
		href: '/play/slice',
		icon: IconRadar,
		tileClass: 'bg-tie-red',
		name: m.mode_slice_name,
		description: m.mode_slice_description
	},
	{
		id: 'whack',
		status: 'playable',
		href: '/play/whack',
		icon: IconMegaphone,
		tileClass: 'bg-explosion-yellow',
		name: m.mode_whack_name,
		description: m.mode_whack_description
	}
];
