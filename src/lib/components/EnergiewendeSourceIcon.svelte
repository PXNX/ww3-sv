<!-- The icon of one Energiewende Panic power source; decorative, the name is always next to it -->
<script lang="ts">
	import type { SourceId } from '#lib/game/energiewende/sources.js';
	import IconAtom from '~icons/lucide/atom';
	import IconBattery from '~icons/lucide/battery-charging';
	import IconCable from '~icons/lucide/cable';
	import IconDroplets from '~icons/lucide/droplets';
	import IconFactory from '~icons/lucide/factory';
	import IconFlame from '~icons/lucide/flame';
	import IconLeaf from '~icons/lucide/leaf';
	import IconSun from '~icons/lucide/sun';
	import IconWind from '~icons/lucide/wind';

	let { id, class: className = 'size-5' }: { id: SourceId; class?: string } = $props();

	const icons = {
		coal: IconFactory,
		gas: IconFlame,
		nuclear: IconAtom,
		wind: IconWind,
		solar: IconSun,
		hydro: IconDroplets,
		biomass: IconLeaf,
		batteries: IconBattery,
		imports: IconCable
	};
	const Icon = $derived(icons[id]);
</script>

<Icon class={className} aria-hidden="true" />
