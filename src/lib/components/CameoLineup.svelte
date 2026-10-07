<!--
	Start screen hero: the mascot and every game-over cameo side by side as tilted portrait cards.
	Purely decorative.
-->
<script lang="ts">
	import { CAMEOS, cameoPortrait } from '#lib/theme/cameos.js';
	import { mascotImage } from '#lib/theme/character.js';

	const portraits = [mascotImage('idle'), ...CAMEOS.map((cameo) => cameoPortrait(cameo.id))];
</script>

<ul class="grid grid-cols-5 gap-2 p-3" aria-hidden="true">
	{#each portraits as portrait, index (portrait)}
		<li>
			<img
				src={portrait}
				alt=""
				draggable="false"
				class="aspect-square w-full rounded-lg border-3 border-ink bg-paper object-cover shadow-[2px_2px_0_var(--color-ink)] {index %
					2 ===
				0
					? '-rotate-2'
					: 'rotate-2'}"
			/>
		</li>
	{/each}
</ul>
