<!--
	Error page illustration in the freeonis style: pale sky, flat clouds, a grey-green steppe with
	grass tufts and a bare tree. "lost" shows the truck at a question-mark signpost; "broken" shows it
	steaming with a flat tyre under a starburst. Purely decorative, bloodless.
-->
<script lang="ts">
	import ArmyTruck from './ArmyTruck.svelte';
	import Cloud from './Cloud.svelte';
	import Starburst from './Starburst.svelte';

	let { kind }: { kind: 'lost' | 'broken' } = $props();

	const tufts = [
		[20, 196],
		[70, 214],
		[130, 204],
		[250, 218],
		[300, 200],
		[360, 212],
		[180, 226]
	];
</script>

<svg viewBox="0 0 400 240" class="block h-auto w-full" aria-hidden="true" data-playfield>
	<rect width="400" height="240" fill="#D8E6E8" />
	<rect y="186" width="400" height="54" fill="#A3AB9A" />
	{#each tufts as [x, y], index (index)}
		<path d="M{x} {y} l2 -5 M{x + 5} {y} l-2 -5" stroke="#7F8876" stroke-width="2" />
	{/each}

	<Cloud x={36} y={30} width={62} />
	<Cloud x={250} y={56} width={48} />

	<!-- bare tree -->
	<path
		d="M352 190 V150 M352 170 l-10 -12 M352 160 l9 -14 M352 150 l-5 -12 M361 146 l4 -6"
		stroke="#A5A5A5"
		stroke-width="5"
		stroke-linecap="round"
		fill="none"
	/>

	{#if kind === 'lost'}
		<ArmyTruck x={40} y={104} />
		<g stroke="#2B2B2B" stroke-width="3" stroke-linejoin="round">
			<rect x="283" y="130" width="6" height="60" fill="#8B6B46" />
			<path d="M262 112 H316 L326 124 L316 136 H262 Z" fill="#FFFFFF" />
		</g>
		<text
			x="292"
			y="132"
			text-anchor="middle"
			font-size="22"
			font-weight="900"
			fill="#E5484D"
			font-family="system-ui, sans-serif">?</text
		>
	{:else}
		<ArmyTruck x={70} y={104} broken />
		<Starburst x={230} y={74} radius={44} animated />
	{/if}
</svg>
