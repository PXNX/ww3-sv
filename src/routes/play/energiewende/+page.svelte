<!--
	Energiewende Panic (roadmap 3.9): run the national grid. Nine sources feed it, the weather and the
	time of day swing the supply and the demand, and whenever the two drift apart for too long the
	grid trips and a heart is lost. Two cartoon critics react to the price and to the dirty mix.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import EnergiewendeCameo from '#lib/components/EnergiewendeCameo.svelte';
	import EnergiewendeChart from '#lib/components/EnergiewendeChart.svelte';
	import EnergiewendeSourceCard from '#lib/components/EnergiewendeSourceCard.svelte';
	import EnergiewendeSourceIcon from '#lib/components/EnergiewendeSourceIcon.svelte';
	import {
		businessmanQuote,
		cameoAlt,
		cameoName,
		EVENT_HINTS,
		EVENT_NAMES,
		overMessage,
		SOURCE_COLORS,
		SOURCE_HINTS,
		SOURCE_NAMES,
		womanQuote
	} from '#lib/components/energiewendeNames.js';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { TOLERANCE, STARTING_LIVES } from '#lib/game/energiewende/grid.js';
	import { cameoFile } from '#lib/game/energiewende/reactions.js';
	import { SOURCE_IDS } from '#lib/game/energiewende/sources.js';
	import { createFixedLoop, onAppHidden, prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { EnergiewendeGame, type Notice } from '#lib/stores/energiewendeGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconArrowDown from '~icons/lucide/arrow-down';
	import IconArrowUp from '~icons/lucide/arrow-up';
	import IconHelp from '~icons/lucide/circle-help';
	import IconMinus from '~icons/lucide/minus';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconZap from '~icons/lucide/zap';

	const game = new EnergiewendeGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_energiewende_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('energiewende');
		return onAppHidden(() => game.pause());
	});

	// The game clock runs only while playing; the loop stops itself on pause and game over
	$effect(() => {
		if (game.status !== 'playing') return;
		const loop = createFixedLoop({ stepMs: 50, update: (dt) => game.update(dt), render: () => {} });
		loop.start();
		return () => loop.pause();
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const pad = (value: number) => String(value).padStart(2, '0');
	const clockText = $derived(
		`${pad(Math.floor(game.clock))}:${pad(Math.floor((game.clock % 1) * 60))}`
	);

	const gap = $derived(game.supply - game.demand);
	const balance = $derived.by(() => {
		const power = Math.abs(gap).toFixed(1);
		if (Math.abs(gap) <= game.demand * TOLERANCE) return m.energiewende_balance_ok();
		return gap < 0
			? m.energiewende_balance_short({ power })
			: m.energiewende_balance_surplus({ power });
	});
	const trendText = $derived(
		game.trend === 'up'
			? m.energiewende_trend_up()
			: game.trend === 'down'
				? m.energiewende_trend_down()
				: m.energiewende_trend_flat()
	);

	/** Share of each source in the power that is delivered, for the mix bar */
	const mix = $derived.by(() => {
		const parts = game.sources.filter((source) => source.output > 0.05);
		const total = parts.reduce((sum, source) => sum + source.output, 0);
		return parts.map((source) => ({ id: source.id, share: total > 0 ? source.output / total : 0 }));
	});

	function noticeText(notice: Notice): string {
		switch (notice.kind) {
			case 'blackout':
				return m.energiewende_notice_blackout();
			case 'overload':
				return m.energiewende_notice_overload();
			case 'tripped':
				return m.energiewende_notice_tripped({ source: SOURCE_NAMES[notice.source]() });
			default:
				return m.energiewende_notice_online({ source: SOURCE_NAMES[notice.source]() });
		}
	}

	const eventLabels = $derived(
		game.events.map((view) => {
			const name = EVENT_NAMES[view.kind]({
				source: view.source ? SOURCE_NAMES[view.source]() : ''
			});
			return {
				view,
				text: view.active
					? m.energiewende_event_active({ event: name, hours: view.hours })
					: m.energiewende_event_incoming({ event: name, hours: view.hours })
			};
		})
	);
	const headline = $derived(eventLabels.find((label) => label.view.active) ?? eventLabels[0]);

	const over = $derived(game.status === 'over' ? game.overCameo() : null);
	const overCameo = $derived(
		over
			? {
					image: cameoAsset(cameoFile(over.kind, over.mood)),
					alt: cameoAlt(over.kind, over.mood),
					message: overMessage(over.kind, over.mood, over.nuclear),
					label: m.energiewende_over_label()
				}
			: null
	);
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.energiewende_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.energiewende_help_button()}</span>
		</button>
		{#if game.status === 'playing' || game.status === 'paused'}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.togglePause()}>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					{m.game_resume()}
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					{m.game_pause()}
				{/if}
			</button>
		{/if}
	{/snippet}

	<section class="mx-auto flex w-full max-w-3xl flex-col gap-2">
		<!-- HUD: clock, lives, balance and the grid stress -->
		<div
			class="flex flex-col gap-1.5 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<div class="flex items-center justify-between gap-3">
				<p class="flex items-baseline gap-2 font-display font-bold tabular-nums">
					<span class="text-xl leading-none">{clockText}</span>
					<span dir="auto" class="text-sm">{m.energiewende_hud_day({ day: game.day })}</span>
				</p>
				<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
			</div>
			<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm font-bold">
				<p dir="auto" class="flex items-center gap-1 tabular-nums">
					<IconZap class="size-4 shrink-0" aria-hidden="true" />
					<span>
						{m.energiewende_hud_balance({
							supply: game.supply.toFixed(1),
							demand: game.demand.toFixed(1)
						})}
					</span>
				</p>
				<p dir="auto" class="flex items-center gap-1 tabular-nums">
					<span>{balance}</span>
					<span aria-hidden="true">·</span>
					<span>{m.energiewende_hud_frequency({ hz: game.hertz.toFixed(2) })}</span>
				</p>
			</div>
			<div class="flex items-center gap-2">
				<span dir="auto" class="shrink-0 text-xs font-bold">{m.energiewende_hud_stress()}</span>
				<div
					class="relative h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-sand"
					role="progressbar"
					aria-label={m.energiewende_hud_stress()}
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={Math.round(game.stress * 100)}
				>
					<div
						class="h-full {game.stress > 0.66
							? 'bg-tie-red'
							: game.stress > 0.33
								? 'bg-explosion-yellow'
								: 'bg-khaki'}"
						style:width="{game.stress * 100}%"
					></div>
				</div>
				<span class="flex shrink-0 items-center gap-0.5 text-xs font-bold">
					{#if game.trend === 'up'}
						<IconArrowUp class="size-3.5" aria-hidden="true" />
					{:else if game.trend === 'down'}
						<IconArrowDown class="size-3.5" aria-hidden="true" />
					{:else}
						<IconMinus class="size-3.5" aria-hidden="true" />
					{/if}
					<span dir="auto">{trendText}</span>
				</span>
			</div>
		</div>

		<!-- The two critics react to the price and to the mix -->
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<EnergiewendeCameo
				kind="businessman"
				mood={game.businessman}
				name={cameoName('businessman')}
				alt={cameoAlt('businessman', game.businessman)}
				figure={m.energiewende_hud_price({ price: Math.round(game.price) })}
				quote={businessmanQuote(game.businessman, game.businessmanLine)}
				loud={game.businessman === 'outraged'}
			/>
			<EnergiewendeCameo
				kind="woman"
				mood={game.woman}
				name={cameoName('woman')}
				alt={cameoAlt('woman', game.woman)}
				figure={m.energiewende_hud_co2({ co2: Math.round(game.intensity) })}
				quote={womanQuote(game.woman, game.womanReason, game.womanLine)}
				loud={game.woman === 'outraged'}
			/>
		</div>

		<!-- Forecast and notices -->
		<div
			class="flex min-h-9 flex-col gap-1 rounded-[10px_6px_12px_7px] border-3 border-ink bg-sand px-2 py-1 text-sm font-semibold"
			role="status"
		>
			{#if game.notice}
				<p dir="auto" class="font-display text-base font-bold text-heart">
					{noticeText(game.notice)}
				</p>
			{/if}
			{#if eventLabels.length === 0}
				<p dir="auto">{m.energiewende_events_none()}</p>
			{:else}
				<ul class="flex flex-wrap gap-1">
					{#each eventLabels as label (label.view.kind)}
						<li
							dir="auto"
							class="rounded-full border-2 border-ink px-2 py-0.5 text-xs font-bold {label.view
								.active
								? 'bg-tie-red'
								: 'bg-explosion-yellow'}"
						>
							{label.text}
						</li>
					{/each}
				</ul>
				{#if headline}
					<p dir="auto" class="text-xs leading-tight">{EVENT_HINTS[headline.view.kind]()}</p>
				{/if}
			{/if}
		</div>

		<!-- The playfield: the chart and the sliders stay left to right -->
		<div class="relative flex flex-col gap-2" data-playfield style:touch-action="none">
			<div
				class="flex flex-col gap-1 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)]"
			>
				<EnergiewendeChart
					history={game.history}
					demand={game.demand}
					supply={game.supply}
					class="h-20 sm:h-24"
				/>
				<div
					class="flex h-2.5 w-full overflow-hidden rounded-full border-2 border-ink bg-sand"
					aria-hidden="true"
				>
					{#each mix as part (part.id)}
						<div style:width="{part.share * 100}%" style:background={SOURCE_COLORS[part.id]}></div>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-3 gap-1.5 sm:gap-2">
				{#each game.sources as view (view.id)}
					<EnergiewendeSourceCard
						{view}
						charge={game.charge}
						disabled={game.status !== 'playing'}
						onchange={(value) => game.setTarget(view.id, value)}
					/>
				{/each}
			</div>

			<!-- A red flash around the board whenever a heart is lost -->
			{#key game.hurtCount}
				{#if game.hurtCount > 0 && game.status === 'playing'}
					<div
						class="hurt pointer-events-none absolute -inset-1 rounded-[14px_8px_16px_10px] border-8 border-tie-red"
					></div>
				{/if}
			{/key}

			{#if game.status === 'ready'}
				<div
					class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-4"
				>
					<div
						class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
						style:--tilt="-1.5deg"
					>
						<p dir="auto" class="text-sm leading-snug font-semibold">
							{m.energiewende_ready_hint()}
						</p>
						{#if game.best !== null}
							<p dir="auto" class="text-sm font-semibold">
								{m.energiewende_best({ score: game.best })}
							</p>
						{/if}
						<button
							type="button"
							class="btn-chunky bg-tie-red text-xl"
							onclick={() => game.start()}
						>
							<IconPlay class="size-5" aria-hidden="true" />
							{m.energiewende_start()}
						</button>
					</div>
				</div>
			{:else if game.status === 'paused'}
				<PauseOverlay onResume={() => game.resume()} />
			{/if}
		</div>
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.energiewende_tutorial_title()}
		closeLabel={m.energiewende_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.energiewende_tutorial_goal()}</p>
		<p>{m.energiewende_tutorial_sliders()}</p>
		<ul class="flex flex-col gap-2">
			{#each SOURCE_IDS as id (id)}
				<li class="flex items-center gap-2">
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-md border-2 border-ink"
						style:background={SOURCE_COLORS[id]}
					>
						<EnergiewendeSourceIcon
							{id}
							class="size-6 {id === 'coal' || id === 'nuclear' ? 'text-paper' : 'text-ink'}"
						/>
					</span>
					<span><strong>{SOURCE_NAMES[id]()}</strong> {SOURCE_HINTS[id]()}</span>
				</li>
			{/each}
		</ul>
		<p>{m.energiewende_tutorial_cold()}</p>
		<p>{m.energiewende_tutorial_stress()}</p>
		<p>{m.energiewende_tutorial_events()}</p>
		<p>{m.energiewende_tutorial_critics()}</p>
		<ul class="flex flex-col gap-2">
			{#each ['businessman', 'woman'] as const as kind (kind)}
				<li class="flex items-center gap-2">
					{#each ['calm', 'annoyed', 'outraged'] as const as mood (mood)}
						<img
							src={cameoAsset(cameoFile(kind, mood))}
							alt={cameoAlt(kind, mood)}
							class="size-12 shrink-0 rounded-md border-2 border-ink bg-paper object-cover"
						/>
					{/each}
					<span><strong>{cameoName(kind)}</strong></span>
				</li>
			{/each}
		</ul>
		<p>{m.energiewende_tutorial_score()}</p>
		<p class="hidden text-sm sm:block">{m.energiewende_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.energiewende_gameover_title()}
		customCameo={overCameo}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.energiewende_stat_days()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.daysSurvived}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.energiewende_stat_trips()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.blackouts + game.overloads}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.energiewende_stat_price()}</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{m.energiewende_hud_price({ price: Math.round(game.avgPrice) })}
				</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.energiewende_stat_co2()}</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{m.energiewende_hud_co2({ co2: Math.round(game.avgIntensity) })}
				</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.energiewende_stat_clean()}</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{m.energiewende_state_percent({ percent: Math.round(game.cleanShare * 100) })}
				</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.energiewende_stat_flips()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.flips}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>

<style>
	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	@keyframes hurt {
		from {
			opacity: 0.85;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
