/* The icon of every troop kind, shared by the army sheet and the result panels */
import type { Component } from 'svelte';
import type { SvelteHTMLElements } from 'svelte/elements';
import type { TroopKind } from '#lib/game/beachhead/config.js';
import IconBomb from '~icons/lucide/bomb';
import IconCrosshair from '~icons/lucide/crosshair';
import IconFlame from '~icons/lucide/flame';
import IconGavel from '~icons/lucide/gavel';
import IconHeartPulse from '~icons/lucide/heart-pulse';
import IconSend from '~icons/lucide/send';
import IconShield from '~icons/lucide/shield';
import IconStar from '~icons/lucide/star';
import IconTarget from '~icons/lucide/target';
import IconTruck from '~icons/lucide/truck';
import IconUsers from '~icons/lucide/users';

export type IconComponent = Component<SvelteHTMLElements['svg']>;

export const TROOP_ICONS: Record<TroopKind, IconComponent> = {
	assault: IconUsers,
	tank: IconShield,
	mortar: IconTarget,
	drone: IconSend,
	medic: IconHeartPulse,
	hero: IconGavel,
	artillery: IconCrosshair,
	apc: IconTruck,
	demo: IconBomb,
	heavy: IconFlame,
	azov: IconStar
};
