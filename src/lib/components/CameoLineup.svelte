<!--
	Start screen hero: the mascot and every game-over cameo side by side as tilted portrait cards,
	each in front of its country's flag. Purely decorative.
-->
<script lang="ts">
	import { CAMEOS, MASCOT_FLAG, cameoFlag, cameoPortrait } from '#lib/theme/cameos.js';
	import { mascotImage } from '#lib/theme/character.js';

	const people = [
		{ portrait: mascotImage('idle'), flag: MASCOT_FLAG },
		...CAMEOS.map((cameo) => ({ portrait: cameoPortrait(cameo.id), flag: cameoFlag(cameo.id) }))
	];
</script>

<ul class="grid grid-cols-5 gap-2 p-3" aria-hidden="true">
	{#each people as { portrait, flag }, index (portrait)}
		<li>
			<img
				src={portrait}
				alt=""
				draggable="false"
				class="aspect-square w-full rounded-lg border-3 border-ink object-cover shadow-[2px_2px_0_var(--color-ink)] {index %
					2 ===
				0
					? '-rotate-2'
					: 'rotate-2'}"
				style:background="url({flag}) center / 100% 100%"
			/>
		</li>
	{/each}
</ul>
