<!-- Primary way to place buoy flags on touch screens (long-press is only a shortcut) -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import MinefieldBuoy from './MinefieldBuoy.svelte';

	let {
		active,
		disabled = false,
		ontoggle
	}: { active: boolean; disabled?: boolean; ontoggle: () => void } = $props();
</script>

<button
	type="button"
	class="btn-chunky min-h-14 flex-1 {active ? 'bg-tie-red' : ''}"
	style:rotate={active ? '-1.5deg' : '0deg'}
	aria-pressed={active}
	{disabled}
	onclick={ontoggle}
>
	<MinefieldBuoy class="size-8 shrink-0" />
	<span class="flex flex-col items-start leading-tight">
		<span>{m.minefield_flag_mode()}</span>
		<span class="text-xs">{active ? m.minefield_mode_on() : m.minefield_mode_off()}</span>
	</span>
</button>
