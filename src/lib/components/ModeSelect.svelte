<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname, RouteId } from '$app/types';
	import { isCareerMode } from '#lib/game/career/config.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import { pickOne } from '#lib/game/random.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { MODES, modeById } from '#lib/modes/registry.js';
	import { PLAY_STYLES, STYLE_OF_MODE, type PlayStyle } from '#lib/modes/styles.js';
	import { leaderById, type LeaderId } from '#lib/theme/leaders.js';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconShuffle from '~icons/lucide/shuffle';
	import IconTrophy from '~icons/lucide/trophy';
	import IconX from '~icons/lucide/x';

	// resolve() has one overload per route, and TypeScript gives up on matching a union of more than
	// 25 routes against them. The registry already type-checks every href against RouteId.
	const resolveRoute = resolve as (route: RouteId) => ResolvedPathname;

	let { leader = $bindable(null) }: { leader?: LeaderId | null } = $props();

	const careerState = career();

	// Varied, slight tilts so the cards read like a sticker sheet rather than a dashboard
	const TILTS = [-2.5, 1.8, -1.2, 2.6, -1.9, 1.1, -2.2, 1.6];

	// Tilt follows the card, not its position in the filtered list, so cards do not jiggle on filter
	const cards = $derived(
		MODES.map((mode, index) => ({ mode, tilt: TILTS[index % TILTS.length] })).filter(
			({ mode }) => leader === null || mode.leaders.includes(leader)
		)
	);

	const recent = $derived(careerState.recent(1).map((id) => modeById(id)));

	const featured = (ids: readonly LeaderId[]) =>
		new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(
			ids.map((id) => leaderById(id).name())
		);

	const progressFor = (id: (typeof MODES)[number]['id']) =>
		isCareerMode(id) ? careerState.profile.modes[id] : undefined;

	/** How each style is named and described in its heading */
	const STYLE_TEXT: Record<PlayStyle, { name: () => string; hint: () => string }> = {
		reaction: { name: m.home_style_reaction, hint: m.home_style_reaction_hint },
		platformer: { name: m.home_style_platformer, hint: m.home_style_platformer_hint },
		shooter: { name: m.home_style_shooter, hint: m.home_style_shooter_hint },
		tactics: { name: m.home_style_tactics, hint: m.home_style_tactics_hint },
		puzzle: { name: m.home_style_puzzle, hint: m.home_style_puzzle_hint },
		riddle: { name: m.home_style_riddle, hint: m.home_style_riddle_hint },
		management: { name: m.home_style_management, hint: m.home_style_management_hint }
	};

	/** The visible games by play style, in the order of the styles; styles with none are left out */
	const groups = $derived(
		PLAY_STYLES.map((style) => ({
			style,
			cards: cards.filter(({ mode }) => STYLE_OF_MODE[mode.id] === style)
		})).filter((group) => group.cards.length > 0)
	);

	const contestModeId = $derived(careerState.profile.contest?.mode ?? null);

	function surprise() {
		const playable = MODES.filter((mode) => mode.status === 'playable');
		const mode = pickOne(Math.random, playable);
		if (mode.status !== 'playable') return;
		void goto(resolveRoute(mode.href));
	}
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

<div class="mb-4 flex flex-wrap items-center gap-2">
	<button type="button" class="btn-chunky bg-explosion-yellow px-3 py-1 text-sm" onclick={surprise}>
		<IconShuffle class="size-4" aria-hidden="true" />
		{m.home_surprise()}
	</button>
	{#if recent.length > 0}
		<span class="ms-1 text-sm font-bold">{m.home_recent()}</span>
		{#each recent as mode (mode.id)}
			{#if mode.status === 'playable'}
				{@const Icon = mode.icon}
				<a href={resolveRoute(mode.href)} class="btn-chunky bg-paper px-2.5 py-1 text-sm">
					<Icon class="size-4" aria-hidden="true" />
					{mode.name()}
				</a>
			{/if}
		{/each}
	{/if}
</div>

{#snippet item(mode: (typeof MODES)[number], tilt: number)}
	{@const Icon = mode.icon}
	{@const progress = progressFor(mode.id)}
	<li class="flex">
		{#snippet card()}
			<img
				src="/cards/{mode.id}.webp"
				alt=""
				class="pointer-events-none absolute inset-0 -z-10 size-full object-cover object-top opacity-45"
				decoding="async"
				loading="lazy"
				draggable="false"
			/>
			<span
				class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-ink/80 via-ink/40 to-transparent"
				aria-hidden="true"
			></span>
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
			{#if progress && progress.best > 0}
				<span
					class="absolute start-2 top-2 inline-flex items-center gap-1 rounded-md border-2 border-ink bg-explosion-yellow px-1.5 py-0.5 text-xs font-bold tabular-nums"
					aria-label={m.career_best({ score: progress.best })}
				>
					<IconTrophy class="size-3.5" aria-hidden="true" />
					{progress.best}
				</span>
			{/if}
			<span class="mt-auto rounded-xl border-3 border-ink p-3 {mode.tileClass}" aria-hidden="true">
				<Icon class="size-12" stroke-width="2.5" />
			</span>
			<h4 class="text-lg leading-tight font-bold text-paper [text-shadow:0_2px_0_var(--color-ink)]">
				{mode.name()}
			</h4>
		{/snippet}
		{#if mode.status === 'playable'}
			<a
				href={resolveRoute(mode.href)}
				class="sticker sticker-interactive relative isolate flex min-h-40 w-full flex-col items-start gap-2 overflow-hidden bg-ink p-3 active:scale-95{mode.id ===
				contestModeId
					? ' ring-4 ring-explosion-yellow ring-offset-2'
					: ''}"
				style:--tilt="{tilt}deg">{@render card()}</a
			>
		{:else}
			<div
				class="sticker relative isolate flex min-h-40 w-full flex-col items-start gap-2 overflow-hidden bg-ink p-3 opacity-80{mode.id ===
				contestModeId
					? ' ring-4 ring-explosion-yellow ring-offset-2'
					: ''}"
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
{/snippet}

{#if leader === null}
	<!-- Grouped by how the games are played -->
	<div class="flex flex-col gap-8">
		{#each groups as group (group.style)}
			<section class="flex flex-col gap-3" aria-labelledby="style-{group.style}">
				<div class="flex flex-col gap-0.5">
					<h3 id="style-{group.style}" class="font-display text-xl leading-tight font-bold">
						{STYLE_TEXT[group.style].name()}
					</h3>
					<p class="text-sm leading-snug opacity-75">{STYLE_TEXT[group.style].hint()}</p>
				</div>
				<ul class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
					{#each group.cards as { mode, tilt } (mode.id)}
						{@render item(mode, tilt)}
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{:else}
	<ul class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
		{#each cards as { mode, tilt } (mode.id)}
			{@render item(mode, tilt)}
		{/each}
	</ul>
{/if}
