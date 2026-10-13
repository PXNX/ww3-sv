<!--
	Start screen hero: the mascot and every game-over cameo side by side as tilted portrait cards,
	each in front of its country's flag. Tapping a leader filters the game list to the games that
	feature them; tapping again (or the chip under the lineup) shows every game.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import {
		CAMEOS,
		MASCOT_FLAG,
		cameoFlag,
		cameoPortrait,
		type CameoId
	} from '#lib/theme/cameos.js';
	import { mascotImage } from '#lib/theme/character.js';

	let { selected = $bindable(null) }: { selected?: CameoId | null } = $props();

	const tilt = (index: number) => (index % 2 === 0 ? '-rotate-2' : 'rotate-2');
</script>

<ul class="grid grid-cols-5 gap-2 p-3" aria-label={m.home_filter_label()}>
	<li aria-hidden="true">
		<img
			src={mascotImage('idle')}
			alt=""
			draggable="false"
			class="aspect-square w-full -rotate-2 rounded-lg border-3 border-ink object-cover shadow-[2px_2px_0_var(--color-ink)] {selected
				? 'opacity-50'
				: ''}"
			style:background="url({MASCOT_FLAG}) center / 100% 100%"
		/>
	</li>
	{#each CAMEOS as cameo, index (cameo.id)}
		{@const active = selected === cameo.id}
		<li>
			<button
				type="button"
				class="block w-full cursor-pointer rounded-lg transition-[opacity,scale] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tie-red focus-visible:outline-dashed active:scale-95 {selected &&
				!active
					? 'opacity-50'
					: ''}"
				aria-pressed={active}
				aria-label={m.home_filter_leader({ name: cameo.name() })}
				onclick={() => (selected = active ? null : cameo.id)}
			>
				<img
					src={cameoPortrait(cameo.id)}
					alt=""
					draggable="false"
					class="aspect-square w-full {tilt(
						index + 1
					)} rounded-lg border-3 border-ink object-cover shadow-[2px_2px_0_var(--color-ink)] {active
						? 'ring-4 ring-tie-red ring-offset-2'
						: ''}"
					style:background="url({cameoFlag(cameo.id)}) center / 100% 100%"
				/>
			</button>
		</li>
	{/each}
</ul>
