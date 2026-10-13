<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { MODES } from '#lib/modes/registry.js';
	import { leaderById, type LeaderId } from '#lib/theme/leaders.js';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconX from '~icons/lucide/x';

	let { leader = $bindable(null) }: { leader?: LeaderId | null } = $props();

	// Varied, slight tilts so the cards read like a sticker sheet rather than a dashboard
	const TILTS = [-2.5, 1.8, -1.2, 2.6, -1.9, 1.1, -2.2, 1.6];

	// Tilt follows the card, not its position in the filtered list, so cards do not jiggle on filter
	const cards = $derived(
		MODES.map((mode, index) => ({ mode, tilt: TILTS[index % TILTS.length] })).filter(
			({ mode }) => leader === null || mode.leaders.includes(leader)
		)
	);

	const featured = (ids: readonly LeaderId[]) =>
		new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(
			ids.map((id) => leaderById(id).name())
		);
</script>

{#if leader}
	<div class="mb-4 flex">
		<button
			type="button"
			class="btn-chunky inline-flex items-center gap-2 bg-explosion-yellow"
			aria-label={m.home_filter_clear()}
			onclick={() => (leader = null)}
		>
			<img
				src={leaderById(leader).flag}
				alt=""
				class="h-4 w-6 rounded-sm border-2 border-ink object-cover"
				draggable="false"
			/>
			{m.home_filter_active({ name: leaderById(leader).name() })}
			<IconX class="size-4" aria-hidden="true" />
		</button>
	</div>
{/if}

<ul class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
	{#each cards as { mode, tilt } (mode.id)}
		{@const Icon = mode.icon}
		<li class="flex">
			{#snippet card()}
				<span class="flex w-full items-start justify-between gap-2">
					<span class="rounded-lg border-3 border-ink p-2 {mode.tileClass}" aria-hidden="true">
						<Icon class="size-8" stroke-width="2.5" />
					</span>
					{#if mode.leaders.length > 0}
						<span class="flex flex-wrap justify-end gap-1" aria-hidden="true">
							{#each mode.leaders as id (id)}
								<img
									src={leaderById(id).flag}
									alt=""
									class="h-4 w-6 rounded-sm border-2 border-ink object-cover"
									draggable="false"
								/>
							{/each}
						</span>
						<span class="sr-only">{m.mode_features({ names: featured(mode.leaders) })}</span>
					{/if}
				</span>
				<h3 class="text-lg leading-tight font-bold">{mode.name()}</h3>
				<p class="text-sm leading-snug">{mode.description()}</p>
			{/snippet}

			{#if mode.status === 'playable'}
				<a
					href={resolve(mode.href)}
					class="sticker sticker-interactive flex w-full flex-col items-start gap-2 p-3 active:scale-95"
					style:--tilt="{tilt}deg"
				>
					{@render card()}
				</a>
			{:else}
				<div
					class="sticker flex w-full flex-col items-start gap-2 p-3 opacity-80"
					style:--tilt="{tilt}deg"
				>
					{@render card()}
					<span
						class="mt-auto inline-flex items-center gap-1 rounded-md border-2 border-ink bg-sand px-2 py-0.5 text-xs font-bold"
					>
						<IconHourglass class="size-3.5" aria-hidden="true" />
						{m.mode_coming_soon()}
					</span>
				</div>
			{/if}
		</li>
	{/each}
</ul>
