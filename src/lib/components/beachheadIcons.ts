/* The icon of every troop kind, shared by the army sheet and the result panels */
import type { Component } from 'svelte';
import type { SvelteHTMLElements } from 'svelte/elements';
import type { SkillId, TroopKind } from '#lib/game/beachhead/config.js';
import IconBomb from '~icons/lucide/bomb';
import IconCloud from '~icons/lucide/cloud';
import IconCrosshair from '~icons/lucide/crosshair';
import IconFlame from '~icons/lucide/flame';
import IconFlameKindling from '~icons/lucide/flame-kindling';
import IconGavel from '~icons/lucide/gavel';
import IconHeartPulse from '~icons/lucide/heart-pulse';
import IconRocket from '~icons/lucide/rocket';
import IconSend from '~icons/lucide/send';
import IconShield from '~icons/lucide/shield';
import IconStar from '~icons/lucide/star';
import IconTarget from '~icons/lucide/target';
import IconTruck from '~icons/lucide/truck';
import IconUsers from '~icons/lucide/users';
import IconZap from '~icons/lucide/zap';

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

export const SKILL_ICONS: Record<SkillId, IconComponent> = {
	flamingo: IconRocket,
	barrage: IconBomb,
	flare: IconFlameKindling,
	smoke: IconCloud,
	heal: IconHeartPulse,
	emp: IconZap
};
