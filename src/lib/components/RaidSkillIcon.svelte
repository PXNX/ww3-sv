<!-- The icon of a raid weapon skill, as on the buttons around the attack button -->
<script lang="ts">
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import type { SkillId } from '#lib/game/raid/config.js';
	import IconBomb from '~icons/lucide/bomb';
	import IconChevronsRight from '~icons/lucide/chevrons-right';
	import IconDroplets from '~icons/lucide/droplets';
	import IconFastForward from '~icons/lucide/fast-forward';
	import IconFlameKindling from '~icons/lucide/flame-kindling';
	import IconPlane from '~icons/lucide/plane';
	import IconCircleDot from '~icons/lucide/circle-dot';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlame from '~icons/lucide/flame';
	import IconGauge from '~icons/lucide/gauge';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconRocket from '~icons/lucide/rocket';
	import IconSun from '~icons/lucide/sun';
	import IconZap from '~icons/lucide/zap';

	let { skill, class: className = 'size-7' }: { skill: SkillId; class?: string } = $props();

	const ICONS: Record<SkillId, { icon: Component<SvelteHTMLElements['svg']>; color: string }> = {
		heal: { icon: IconHeartPulse, color: 'text-tie-red' },
		grenade: { icon: IconBomb, color: 'text-ink' },
		focus: { icon: IconCrosshair, color: 'text-tie-red' },
		railshot: { icon: IconZap, color: 'text-flag-blue' },
		dash: { icon: IconChevronsRight, color: 'text-ink' },
		blast: { icon: IconFlame, color: 'text-tie-red' },
		overdrive: { icon: IconGauge, color: 'text-mustard' },
		nova: { icon: IconSun, color: 'text-mustard' },
		barrage: { icon: IconRocket, color: 'text-khaki' },
		mine: { icon: IconCircleDot, color: 'text-khaki' },
		flashpoint: { icon: IconFlameKindling, color: 'text-tie-red' },
		napalm: { icon: IconDroplets, color: 'text-mustard' },
		swarm: { icon: IconPlane, color: 'text-flag-blue' },
		overclock: { icon: IconFastForward, color: 'text-khaki' }
	};

	const Icon = $derived(ICONS[skill].icon);
</script>

<Icon class="{className} {ICONS[skill].color}" aria-hidden="true" />
