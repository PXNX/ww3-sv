<!-- Arms a mine-removal submarine; the next tap on unexplored water sends it there -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { spriteSrc } from '$lib/theme/sprites';

	let {
		armed,
		left,
		disabled = false,
		ontoggle
	}: { armed: boolean; left: number; disabled?: boolean; ontoggle: () => void } = $props();
</script>

<button
	type="button"
	class="btn-chunky min-h-14 flex-1 {armed ? 'bg-explosion-yellow!' : ''}"
	style:rotate={armed ? '1.5deg' : '0deg'}
	aria-pressed={armed}
	disabled={disabled || left === 0}
	onclick={ontoggle}
>
	<img
		src={spriteSrc('submarine')}
		alt=""
		class="w-12 shrink-0 {left === 0 ? 'opacity-40 grayscale' : ''}"
		draggable="false"
	/>
	<span class="flex flex-col items-start leading-tight">
		<span>{m.minefield_submarine()}</span>
		<span class="text-xs tabular-nums">{m.minefield_submarines_left({ count: left })}</span>
	</span>
</button>

<style>
	button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
