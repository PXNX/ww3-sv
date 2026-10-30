import type { Component } from 'svelte';
import type { SvelteHTMLElements } from 'svelte/elements';
import type { RouteId } from '$app/types';
import { m } from '#lib/paraglide/messages.js';
import type { LeaderId } from '#lib/theme/leaders.js';
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
import IconFootprints from '~icons/lucide/footprints';
import IconRoute from '~icons/lucide/route';
import IconLandmark from '~icons/lucide/landmark';
import IconCat from '~icons/lucide/cat';
import IconZap from '~icons/lucide/zap';
import IconGauge from '~icons/lucide/gauge';
import IconFlag from '~icons/lucide/flag-triangle-right';
import IconVote from '~icons/lucide/vote';
import IconAnchor from '~icons/lucide/anchor';
import IconCpu from '~icons/lucide/cpu';
import IconVault from '~icons/lucide/vault';
import IconGavel from '~icons/lucide/gavel';
import IconWind from '~icons/lucide/wind';
import IconSiren from '~icons/lucide/siren';
import IconCompass from '~icons/lucide/compass';
import IconDroplets from '~icons/lucide/droplets';
import IconDrill from '~icons/lucide/drill';
import IconSpellCheck from '~icons/lucide/spell-check';
import IconLeaf from '~icons/lucide/leaf';
import IconContainer from '~icons/lucide/container';
import IconSwords from '~icons/lucide/swords';
import IconRocket from '~icons/lucide/rocket';
import IconMusic from '~icons/lucide/music';
import IconHandshake from '~icons/lucide/handshake';
import IconBinoculars from '~icons/lucide/binoculars';
import IconSailboat from '~icons/lucide/sailboat';
import IconFactory from '~icons/lucide/factory';
import IconTerminal from '~icons/lucide/terminal';
import IconMap from '~icons/lucide/map';

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
	| 'whack'
	| 'runcomrade'
	| 'beltroad'
	| 'maze'
	| 'purrpentagram'
	| 'energiewende'
	| 'centrifuge'
	| 'venezuela'
	| 'sondage'
	| 'suez'
	| 'chipfab'
	| 'vault'
	| 'veto'
	| 'balloon'
	| 'dome'
	| 'gpsliar'
	| 'leakpatrol'
	| 'tycoon'
	| 'wordle'
	| 'maple'
	| 'rareearth'
	| 'raid'
	| 'fleethunt'
	| 'redsquare'
	| 'petrobras'
	| 'bordershift'
	| 'droneworks'
	| 'falklands'
	| 'warroom'
	| 'hackers'
	| 'recon';

interface ModeBase {
	id: ModeId;
	icon: Component<SvelteHTMLElements['svg']>;
	/** Tailwind background class for the icon tile, from the design tokens */
	tileClass: string;
	/**
	 * The leaders (one per country) this game features. Their flags go on the start-screen card,
	 * tapping one in the lineup filters to the games that list it, and the first one is the
	 * character that reacts on the result sheet. Empty for games that feature no country.
	 */
	leaders: readonly LeaderId[];
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
		leaders: ['trump'],
		name: m.mode_blocks_name,
		description: m.mode_blocks_description
	},
	{
		id: 'minefield',
		status: 'playable',
		href: '/play/minefield',
		icon: IconBomb,
		tileClass: 'bg-tie-red',
		leaders: ['trump', 'khamenei'],
		name: m.mode_minefield_name,
		description: m.mode_minefield_description
	},
	{
		id: 'convoy',
		status: 'playable',
		href: '/play/convoy',
		icon: IconShip,
		tileClass: 'bg-flag-blue',
		leaders: ['trump', 'putin'],
		name: m.mode_convoy_name,
		description: m.mode_convoy_description
	},
	{
		id: 'merge',
		status: 'playable',
		href: '/play/merge',
		icon: IconMerge,
		tileClass: 'bg-skin',
		leaders: ['trump'],
		name: m.mode_merge_name,
		description: m.mode_merge_description
	},
	{
		id: 'shootdown',
		status: 'playable',
		href: '/play/shootdown',
		icon: IconCrosshair,
		tileClass: 'bg-sky',
		leaders: ['zelensky', 'khamenei'],
		name: m.mode_shootdown_name,
		description: m.mode_shootdown_description
	},
	{
		id: 'pipeline',
		status: 'playable',
		href: '/play/pipeline',
		icon: IconFuel,
		tileClass: 'bg-mustard',
		leaders: ['mbs'],
		name: m.mode_pipeline_name,
		description: m.mode_pipeline_description
	},
	{
		id: 'flamingo',
		status: 'playable',
		href: '/play/flamingo',
		icon: IconFeather,
		tileClass: 'bg-skin',
		leaders: ['zelensky', 'putin'],
		name: m.mode_flamingo_name,
		description: m.mode_flamingo_description
	},
	{
		id: 'fury',
		status: 'playable',
		href: '/play/fury',
		icon: IconBird,
		tileClass: 'bg-explosion-yellow',
		leaders: ['zelensky', 'putin'],
		name: m.mode_fury_name,
		description: m.mode_fury_description
	},
	{
		id: 'chess',
		status: 'playable',
		href: '/play/chess',
		icon: IconCastle,
		tileClass: 'bg-banner-slate',
		leaders: ['zelensky', 'putin'],
		name: m.mode_chess_name,
		description: m.mode_chess_description
	},
	{
		id: 'dronewall',
		status: 'playable',
		href: '/play/dronewall',
		icon: IconShield,
		tileClass: 'bg-khaki',
		leaders: ['zelensky', 'putin'],
		name: m.mode_dronewall_name,
		description: m.mode_dronewall_description
	},
	{
		id: 'parking',
		status: 'playable',
		href: '/play/parking',
		icon: IconParking,
		tileClass: 'bg-sky',
		leaders: ['erdogan', 'mbs'],
		name: m.mode_parking_name,
		description: m.mode_parking_description
	},
	{
		id: 'slice',
		status: 'playable',
		href: '/play/slice',
		icon: IconRadar,
		tileClass: 'bg-tie-red',
		leaders: ['netanyahu', 'zelensky'],
		name: m.mode_slice_name,
		description: m.mode_slice_description
	},
	{
		id: 'whack',
		status: 'playable',
		href: '/play/whack',
		icon: IconMegaphone,
		tileClass: 'bg-explosion-yellow',
		leaders: ['xi'],
		name: m.mode_whack_name,
		description: m.mode_whack_description
	},
	{
		id: 'runcomrade',
		status: 'playable',
		href: '/play/runcomrade',
		icon: IconFootprints,
		tileClass: 'bg-mustard',
		leaders: ['kim'],
		name: m.mode_runcomrade_name,
		description: m.mode_runcomrade_description
	},
	{
		id: 'beltroad',
		status: 'playable',
		href: '/play/beltroad',
		icon: IconRoute,
		tileClass: 'bg-skin',
		leaders: ['xi', 'modi'],
		name: m.mode_beltroad_name,
		description: m.mode_beltroad_description
	},
	{
		id: 'maze',
		status: 'playable',
		href: '/play/maze',
		icon: IconLandmark,
		tileClass: 'bg-banner-slate',
		leaders: ['merz'],
		name: m.mode_maze_name,
		description: m.mode_maze_description
	},
	{
		id: 'purrpentagram',
		status: 'playable',
		href: '/play/purrpentagram',
		icon: IconCat,
		tileClass: 'bg-tie-red',
		leaders: [],
		name: m.mode_purrpentagram_name,
		description: m.mode_purrpentagram_description
	},
	{
		id: 'energiewende',
		status: 'playable',
		href: '/play/energiewende',
		icon: IconZap,
		tileClass: 'bg-explosion-yellow',
		leaders: ['merz', 'macron'],
		name: m.mode_energiewende_name,
		description: m.mode_energiewende_description
	},
	{
		id: 'centrifuge',
		status: 'playable',
		href: '/play/centrifuge',
		icon: IconGauge,
		tileClass: 'bg-sky',
		leaders: [],
		name: m.mode_centrifuge_name,
		description: m.mode_centrifuge_description
	},
	{
		id: 'venezuela',
		status: 'playable',
		href: '/play/venezuela',
		icon: IconFlag,
		tileClass: 'bg-mustard',
		leaders: ['maduro', 'trump'],
		name: m.mode_venezuela_name,
		description: m.mode_venezuela_description
	},
	{
		id: 'sondage',
		status: 'playable',
		href: '/play/sondage',
		icon: IconVote,
		tileClass: 'bg-flag-blue',
		leaders: ['macron'],
		name: m.mode_sondage_name,
		description: m.mode_sondage_description
	},
	{
		id: 'suez',
		status: 'playable',
		href: '/play/suez',
		icon: IconAnchor,
		tileClass: 'bg-khaki',
		leaders: ['modi', 'starmer'],
		name: m.mode_suez_name,
		description: m.mode_suez_description
	},
	{
		id: 'chipfab',
		status: 'playable',
		href: '/play/chipfab',
		icon: IconCpu,
		tileClass: 'bg-sky',
		leaders: ['huang', 'altman', 'musk'],
		name: m.mode_chipfab_name,
		description: m.mode_chipfab_description
	},
	{
		id: 'vault',
		status: 'playable',
		href: '/play/vault',
		icon: IconVault,
		tileClass: 'bg-explosion-yellow',
		leaders: ['merz', 'macron'],
		name: m.mode_vault_name,
		description: m.mode_vault_description
	},
	{
		id: 'veto',
		status: 'playable',
		href: '/play/veto',
		icon: IconGavel,
		tileClass: 'bg-flag-blue',
		leaders: ['trump', 'macron', 'xi', 'putin'],
		name: m.mode_veto_name,
		description: m.mode_veto_description
	},
	{
		id: 'balloon',
		status: 'playable',
		href: '/play/balloon',
		icon: IconWind,
		tileClass: 'bg-sky',
		leaders: ['xi', 'trump'],
		name: m.mode_balloon_name,
		description: m.mode_balloon_description
	},
	{
		id: 'dome',
		status: 'playable',
		href: '/play/dome',
		icon: IconSiren,
		tileClass: 'bg-mustard',
		leaders: ['netanyahu'],
		name: m.mode_dome_name,
		description: m.mode_dome_description
	},
	{
		id: 'gpsliar',
		status: 'playable',
		href: '/play/gpsliar',
		icon: IconCompass,
		tileClass: 'bg-flag-blue',
		leaders: ['putin', 'zelensky'],
		name: m.mode_gpsliar_name,
		description: m.mode_gpsliar_description
	},
	{
		id: 'leakpatrol',
		status: 'playable',
		href: '/play/leakpatrol',
		icon: IconDroplets,
		tileClass: 'bg-banner-slate',
		leaders: ['trump'],
		name: m.mode_leakpatrol_name,
		description: m.mode_leakpatrol_description
	},
	{
		id: 'tycoon',
		status: 'playable',
		href: '/play/tycoon',
		icon: IconDrill,
		tileClass: 'bg-tie-red',
		leaders: ['mbs', 'trump'],
		name: m.mode_tycoon_name,
		description: m.mode_tycoon_description
	},
	{
		id: 'wordle',
		status: 'playable',
		href: '/play/wordle',
		icon: IconSpellCheck,
		tileClass: 'bg-khaki',
		leaders: [],
		name: m.mode_wordle_name,
		description: m.mode_wordle_description
	},
	{
		id: 'maple',
		status: 'playable',
		href: '/play/maple',
		icon: IconLeaf,
		tileClass: 'bg-mustard',
		leaders: ['trump'],
		name: m.mode_maple_name,
		description: m.mode_maple_description
	},
	{
		id: 'rareearth',
		status: 'playable',
		href: '/play/rareearth',
		icon: IconContainer,
		tileClass: 'bg-skin',
		leaders: ['xi', 'modi'],
		name: m.mode_rareearth_name,
		description: m.mode_rareearth_description
	},
	{
		id: 'raid',
		status: 'playable',
		href: '/play/raid',
		icon: IconSwords,
		tileClass: 'bg-tie-red',
		leaders: ['zelensky', 'putin'],
		name: m.mode_raid_name,
		description: m.mode_raid_description
	},
	{
		id: 'fleethunt',
		status: 'playable',
		href: '/play/fleethunt',
		icon: IconRocket,
		tileClass: 'bg-flag-blue',
		leaders: ['zelensky', 'putin'],
		name: m.mode_fleethunt_name,
		description: m.mode_fleethunt_description
	},
	{
		id: 'redsquare',
		status: 'playable',
		href: '/play/redsquare',
		icon: IconMusic,
		tileClass: 'bg-tie-red',
		leaders: ['putin'],
		name: m.mode_redsquare_name,
		description: m.mode_redsquare_description
	},
	{
		id: 'petrobras',
		status: 'playable',
		href: '/play/petrobras',
		icon: IconHandshake,
		tileClass: 'bg-mustard',
		leaders: ['lula', 'zuckerberg'],
		name: m.mode_petrobras_name,
		description: m.mode_petrobras_description
	},
	{
		id: 'bordershift',
		status: 'playable',
		href: '/play/bordershift',
		icon: IconBinoculars,
		tileClass: 'bg-banner-slate',
		leaders: ['tusk', 'zelensky', 'putin'],
		name: m.mode_bordershift_name,
		description: m.mode_bordershift_description
	},
	{
		id: 'droneworks',
		status: 'playable',
		href: '/play/droneworks',
		icon: IconFactory,
		tileClass: 'bg-mustard',
		leaders: ['zelensky', 'putin'],
		name: m.mode_droneworks_name,
		description: m.mode_droneworks_description
	},
	{
		id: 'falklands',
		status: 'playable',
		href: '/play/falklands',
		icon: IconSailboat,
		tileClass: 'bg-sky',
		leaders: ['starmer', 'milei'],
		name: m.mode_falklands_name,
		description: m.mode_falklands_description
	},
	{
		id: 'warroom',
		status: 'playable',
		href: '/play/warroom',
		icon: IconMap,
		tileClass: 'bg-banner-slate',
		leaders: ['merz', 'macron'],
		name: m.mode_warroom_name,
		description: m.mode_warroom_description
	},
	{
		id: 'hackers',
		status: 'playable',
		href: '/play/hackers',
		icon: IconTerminal,
		tileClass: 'bg-tie-red',
		leaders: ['kim'],
		name: () => 'Hermit Hackers',
		description: () => 'Retro terminal: crack crypto wallets, install siphons and worms, flip breaker lights. Reach the quota before the trace hits 100.'
	},
	{
		id: 'recon',
		status: 'playable',
		href: '/play/recon',
		icon: IconRadar,
		tileClass: 'bg-ink',
		leaders: ['musk'],
		name: () => 'Recon',
		description: () => 'Analyze satellite, Global Hawk and Reaper footage militarily — identify targets, read thermal signatures, assess threat levels.'
	}
];

export function modeById(id: ModeId): GameMode {
	const mode = MODES.find((candidate) => candidate.id === id);
	if (!mode) throw new Error(`Unknown mode: ${id}`);
	return mode;
}

/** The modes that feature a leader, in registry order */
export function modesFeaturing(leader: LeaderId): readonly GameMode[] {
	return MODES.filter((mode) => mode.leaders.includes(leader));
}
