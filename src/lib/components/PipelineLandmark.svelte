<!--
	Generic placeholder art for the pumping station (above the grid, pipe pointing down into it)
	and the export terminal (below the grid, pipe coming down from it). No names, no flags.
-->
<script lang="ts">
	let { kind, active, label }: { kind: 'station' | 'terminal'; active: boolean; label: string } =
		$props();

	const pipeFill = $derived(active ? '#2b2f36' : '#ffffff');
</script>

<svg viewBox="0 0 100 100" class="size-full" role="img" aria-label={label}>
	<g stroke="#111111" stroke-width="5" stroke-linejoin="round">
		{#if kind === 'station'}
			<!-- Pipe stub leading down into the first tile -->
			<rect x="38" y="62" width="24" height="38" fill={pipeFill} />
			<!-- Pump house with a big pump wheel -->
			<path d="M10 66 V30 L50 8 L90 30 V66 Z" fill="#7c8c5c" />
			<circle cx="50" cy="42" r="16" fill="#e8e1bc" />
			<path d="M50 26 V58 M34 42 H66" stroke-width="4" />
			<circle cx="50" cy="42" r="5" fill="#111111" />
		{:else}
			<rect x="38" y="0" width="24" height="36" fill={pipeFill} />
			<!-- Squat storage tank on a jetty -->
			<rect x="4" y="84" width="92" height="12" fill="#ddb93c" />
			<path d="M16 84 V44 Q50 28 84 44 V84 Z" fill="#ffffff" />
			<path d="M16 44 Q50 60 84 44" fill="none" />
			<rect x="28" y="62" width="44" height="12" rx="3" fill={active ? '#4fa8d8' : '#e8e1bc'} />
		{/if}
	</g>
</svg>
