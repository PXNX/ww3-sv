<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { MODES } from '$lib/modes/registry';
	import IconHourglass from '~icons/lucide/hourglass';

	// Varied, slight tilts so the cards read like a sticker sheet rather than a dashboard
	const TILTS = [-2.5, 1.8, -1.2, 2.6, -1.9, 1.1, -2.2, 1.6];
</script>

<ul class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
	{#each MODES as mode, index (mode.id)}
		{@const Icon = mode.icon}
		<li
			class="sticker flex flex-col items-start gap-2 p-3"
			class:opacity-80={mode.status === 'coming-soon'}
			style:--tilt="{TILTS[index % TILTS.length]}deg"
		>
			<span class="rounded-lg border-3 border-ink p-2 {mode.tileClass}" aria-hidden="true">
				<Icon class="size-8" stroke-width="2.5" />
			</span>
			<h3 class="text-lg leading-tight font-bold">{mode.name()}</h3>
			<p class="text-sm leading-snug">{mode.description()}</p>
			{#if mode.status === 'coming-soon'}
				<span
					class="mt-auto inline-flex items-center gap-1 rounded-md border-2 border-ink bg-sand px-2 py-0.5 text-xs font-bold"
				>
					<IconHourglass class="size-3.5" aria-hidden="true" />
					{m.mode_coming_soon()}
				</span>
			{/if}
		</li>
	{/each}
</ul>
