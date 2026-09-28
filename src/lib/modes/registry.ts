import type { Component } from 'svelte';
import type { SvelteHTMLElements } from 'svelte/elements';
import { m } from '$lib/paraglide/messages';
import IconBlocks from '~icons/lucide/blocks';
import IconBomb from '~icons/lucide/bomb';
import IconShip from '~icons/lucide/ship';
import IconMerge from '~icons/lucide/merge';
import IconCrosshair from '~icons/lucide/crosshair';
import IconFuel from '~icons/lucide/fuel';
import IconFeather from '~icons/lucide/feather';
import IconBird from '~icons/lucide/bird';

export type ModeId =
	| 'blocks'
	| 'minefield'
	| 'convoy'
	| 'merge'
	| 'shootdown'
	| 'pipeline'
	| 'flamingo'
	| 'fury';

export type ModeStatus = 'coming-soon' | 'playable';

export interface GameMode {
	id: ModeId;
	route: `/play/${ModeId}`;
	status: ModeStatus;
	icon: Component<SvelteHTMLElements['svg']>;
	/** Tailwind background class for the icon tile, from the design tokens */
	tileClass: string;
	name: () => string;
	description: () => string;
}

/** Single list of game modes; the start screen renders from it (requirements Section 19) */
export const MODES: readonly GameMode[] = [
	{
		id: 'blocks',
		route: '/play/blocks',
		status: 'coming-soon',
		icon: IconBlocks,
		tileClass: 'bg-khaki',
		name: m.mode_blocks_name,
		description: m.mode_blocks_description
	},
	{
		id: 'minefield',
		route: '/play/minefield',
		status: 'coming-soon',
		icon: IconBomb,
		tileClass: 'bg-tie-red',
		name: m.mode_minefield_name,
		description: m.mode_minefield_description
	},
	{
		id: 'convoy',
		route: '/play/convoy',
		status: 'coming-soon',
		icon: IconShip,
		tileClass: 'bg-flag-blue',
		name: m.mode_convoy_name,
		description: m.mode_convoy_description
	},
	{
		id: 'merge',
		route: '/play/merge',
		status: 'coming-soon',
		icon: IconMerge,
		tileClass: 'bg-skin',
		name: m.mode_merge_name,
		description: m.mode_merge_description
	},
	{
		id: 'shootdown',
		route: '/play/shootdown',
		status: 'coming-soon',
		icon: IconCrosshair,
		tileClass: 'bg-sky',
		name: m.mode_shootdown_name,
		description: m.mode_shootdown_description
	},
	{
		id: 'pipeline',
		route: '/play/pipeline',
		status: 'coming-soon',
		icon: IconFuel,
		tileClass: 'bg-mustard',
		name: m.mode_pipeline_name,
		description: m.mode_pipeline_description
	},
	{
		id: 'flamingo',
		route: '/play/flamingo',
		status: 'coming-soon',
		icon: IconFeather,
		tileClass: 'bg-skin',
		name: m.mode_flamingo_name,
		description: m.mode_flamingo_description
	},
	{
		id: 'fury',
		route: '/play/fury',
		status: 'coming-soon',
		icon: IconBird,
		tileClass: 'bg-explosion-yellow',
		name: m.mode_fury_name,
		description: m.mode_fury_description
	}
];
