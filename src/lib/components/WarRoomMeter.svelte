<!--
	A horizontal meter whose fill follows its value on a spring, so a change overshoots a little and
	settles. With reduced motion the fill jumps straight to the value.
-->
<script lang="ts">
	import { Spring } from 'svelte/motion';

	let {
		label,
		value,
		max = 100,
		tone,
		state: stateText = '',
		low = 0,
		high = 100
	}: {
		label: string;
		value: number;
		max?: number;
		/** CSS colour of the fill */
		tone: string;
		/** A short state line, such as "Strikes" */
		state?: string;
		/** Tick positions in percent, drawn as thin marks */
		low?: number;
		high?: number;
	} = $props();

	const spring = new Spring(0, { stiffness: 0.12, damping: 0.55 });
	let pulse = $state(false);
	let last = 0;

	const reduced = () =>
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		const target = Math.max(0, Math.min(100, (value / max) * 100));
		spring.set(target, { instant: reduced() });
		if (Math.abs(target - last) >= 3 && !reduced()) {
			pulse = true;
			setTimeout(() => (pulse = false), 400);
		}
		last = target;
	});

	const fill = $derived(Math.max(0, Math.min(100, spring.current)));
</script>

<div class="flex min-w-0 flex-col gap-0.5">
	<div class="flex items-baseline justify-between gap-2 text-[0.7rem] font-bold">
		<span dir="auto" class="tracking-wide uppercase opacity-70">{label}</span>
		<span dir="auto" class="font-display tabular-nums">
			{Math.round(value)}{#if stateText}<span class="ms-1 font-semibold opacity-70"
					>{stateText}</span
				>{/if}
		</span>
	</div>
	<div
		dir="ltr"
		class="relative h-3 overflow-hidden rounded-full border-2 border-ink bg-paper {pulse
			? 'meter-pulse'
			: ''}"
		role="meter"
		aria-label={label}
		aria-valuemin="0"
		aria-valuemax={max}
		aria-valuenow={Math.round(value)}
	>
		<span class="block h-full" style:width="{fill}%" style:background={tone}></span>
		{#if low > 0}
			<span class="absolute inset-y-0 w-px bg-ink/50" style:left="{low}%" aria-hidden="true"></span>
		{/if}
		{#if high < 100}
			<span class="absolute inset-y-0 w-px bg-ink/50" style:left="{high}%" aria-hidden="true"
			></span>
		{/if}
	</div>
</div>

<style>
	.meter-pulse {
		animation: meter-pulse 0.4s ease-out;
	}
	@keyframes meter-pulse {
		0% {
			transform: scaleY(1.5);
		}
		100% {
			transform: scaleY(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.meter-pulse {
			animation: none;
		}
	}
</style>
