<script lang="ts">
	import { resolve } from '$app/paths';
	import type { RouteId } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { MODES } from '#lib/modes/registry.js';
	import { leaderById, type LeaderId } from '#lib/theme/leaders.js';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconX from '~icons/lucide/x';

	// resolve() has one overload per route, and TypeScript gives up on matching a union of more than
	// 25 routes against them. The registry already type-checks every href against RouteId.
	const resolveRoute = resolve as (route: RouteId) => string;

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
				<!-- Faint gameplay screenshot behind the card, captured by scripts/generate-card-screenshots.ts -->
				<img
					src="/cards/{mode.id}.webp"
					alt=""
					class="pointer-events-none absolute inset-0 -z-10 size-full object-cover object-top opacity-25"
					loading="lazy"
					draggable="false"
				/>
				{#if mode.leaders.length > 0}
					<span class="absolute top-2 right-2 flex flex-wrap justify-end gap-1" aria-hidden="true">
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
				<span class="mt-6 rounded-xl border-3 border-ink p-3 {mode.tileClass}" aria-hidden="true">
					<Icon class="size-12" stroke-width="2.5" />
				</span>
				<h3 class="text-center text-lg leading-tight font-bold">{mode.name()}</h3>
			{/snippet}

			{#if mode.status === 'playable'}
				<a
					href={resolveRoute(mode.href)}
					class="sticker sticker-interactive relative isolate flex w-full flex-col items-center gap-2 overflow-hidden p-3 active:scale-95"
					style:--tilt="{tilt}deg"
				>
					{@render card()}
				</a>
			{:else}
				<div
					class="sticker relative isolate flex w-full flex-col items-center gap-2 overflow-hidden p-3 opacity-80"
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
