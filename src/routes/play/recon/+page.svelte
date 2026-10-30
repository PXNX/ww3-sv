<!--
	Recon: an analyst tasks a drone over hostile ground. Each sortie is a map larger than the scope;
	the player pans, locks the EO, IR and SAR sensors onto contacts to build a dossier, then
	strikes the hostile ones and clears the rest, with a limited stock of missiles, civilians to
	spare and air defence that hurts the drone. Up to eight sorties make a run.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import ReconCanvas from '#lib/components/ReconCanvas.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { MAX_SORTIES } from '#lib/game/recon/config.js';
	import { SENSORS } from '#lib/game/recon/contacts.js';
	import { RECON_TEXT } from '#lib/game/recon/text.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { ReconGame } from '#lib/stores/reconGame.svelte.js';
	import IconCircleHelp from '~icons/lucide/circle-help';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconShieldCheck from '~icons/lucide/shield-check';

	const game = new ReconGame();
	const modeName = RECON_TEXT.title;

	let showTutorial = $state(false);
	onMount(() => {
		showTutorial = firstPlay('recon');
	});

	const flying = $derived(game.status === 'playing' || game.status === 'paused');
	const canAct = $derived(game.status === 'playing' && game.selectedNumber !== null);
	const dossierRows = $derived(
		game.dossier
			? SENSORS.map((sensor) => ({
					sensor,
					reading: game.dossier?.[sensor] ?? null
				}))
			: []
	);
	const hint = $derived.by(() => {
		if (game.selectedNumber === null) return RECON_TEXT.dossier.idle;
		if (game.locking) return RECON_TEXT.dossier.locking;
		if (game.suggestedSensor) return RECON_TEXT.dossier.needs(game.suggestedSensor);
		return RECON_TEXT.dossier.settled;
	});
</script>

<GameShell
	compact
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status !== 'ready' && game.status !== 'over'}
>
	{#snippet actions()}
		{#if flying}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={game.status === 'paused' ? m.game_resume() : m.game_pause()}
				onclick={() => game.togglePause()}
			>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m.game_resume()}</span>
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					<span class="hidden sm:inline">{m.game_pause()}</span>
				{/if}
			</button>
		{/if}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={RECON_TEXT.help}
			onclick={() => (showTutorial = true)}
		>
			<IconCircleHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{RECON_TEXT.help}</span>
		</button>
	{/snippet}

	<!-- Portrait: HUD, scope, sensors and dossier in a column. On a short (sideways phone) screen the
	     scope sits on the left, as tall as the screen allows, and the rest stacks beside it. -->
	<section
		class="mx-auto grid w-full max-w-[max(17rem,min(100%,calc((100dvh-23rem)*0.857)))] gap-2 pb-2 [@media(max-height:520px)]:max-w-none [@media(max-height:520px)]:grid-cols-[auto_minmax(0,1fr)] [@media(max-height:520px)]:content-start"
	>
		<!-- Everything that can end the run or the sortie, above the scope it applies to -->
		<div
			class="grid grid-cols-4 gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 font-display shadow-[3px_3px_0_var(--color-ink)] [@media(max-height:520px)]:col-start-2"
		>
			<div class="flex flex-col leading-tight">
				<span class="text-[0.65rem] font-bold uppercase opacity-70">{RECON_TEXT.hud.sortie}</span>
				<span class="text-lg font-bold tabular-nums">{game.sortie}/{MAX_SORTIES}</span>
			</div>
			<div class="flex flex-col leading-tight">
				<span class="text-[0.65rem] font-bold uppercase opacity-70">{RECON_TEXT.hud.time}</span>
				<span
					class="text-lg font-bold tabular-nums {game.timeLeft <= 10 && flying
						? 'text-tie-red'
						: ''}">{game.timeLeft}s</span
				>
			</div>
			<div class="flex flex-col leading-tight">
				<span class="text-[0.65rem] font-bold uppercase opacity-70">{RECON_TEXT.hud.ordnance}</span>
				<span class="flex items-center gap-1 text-lg font-bold tabular-nums">
					<IconCrosshair class="size-4" aria-hidden="true" />{game.ordnance}
				</span>
			</div>
			<div class="flex flex-col justify-between gap-0.5 leading-tight">
				<span class="text-[0.65rem] font-bold uppercase opacity-70">{RECON_TEXT.hud.hull}</span>
				<div
					class="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-sand"
					role="meter"
					aria-label={RECON_TEXT.hud.hull}
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={game.integrity}
				>
					<div
						class="h-full {game.integrity < 35 || game.threatened ? 'bg-tie-red' : 'bg-chartreuse'}"
						style:width="{game.integrity}%"
					></div>
				</div>
				<span class="text-[0.65rem] font-bold uppercase opacity-70"
					>{RECON_TEXT.hud.escalation}</span
				>
				<div
					class="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-sand"
					role="meter"
					aria-label={RECON_TEXT.hud.escalation}
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={game.escalation}
				>
					<div
						class="h-full {game.escalation >= 60 ? 'bg-tie-red' : 'bg-explosion-yellow'}"
						style:width="{game.escalation}%"
					></div>
				</div>
			</div>
		</div>

		<div
			class="[@media(max-height:520px)]:row-span-3 [@media(max-height:520px)]:row-start-1 [@media(max-height:520px)]:w-[calc((100dvh-8rem)*0.857)]"
		>
			<ReconCanvas {game} />
		</div>

		<div
			class="grid grid-cols-3 gap-2 [@media(max-height:520px)]:col-start-2"
			role="group"
			aria-label={RECON_TEXT.hud.sortie}
		>
			{#each SENSORS as sensor, index (sensor)}
				<button
					type="button"
					class="btn-chunky flex-col justify-center gap-0 px-2 py-1 leading-tight {game.sensor ===
					sensor
						? 'bg-explosion-yellow'
						: 'bg-paper'}"
					aria-pressed={game.sensor === sensor}
					disabled={game.status !== 'playing'}
					onclick={() => game.chooseSensor(sensor)}
				>
					<span class="text-lg font-bold">{RECON_TEXT.sensors[sensor].name}</span>
					<span
						class="text-[0.65rem] font-bold uppercase opacity-70 [@media(max-height:520px)]:hidden"
						>{RECON_TEXT.sensors[sensor].caption}<span class="hidden [@media(hover:hover)]:inline">
							· {index + 1}</span
						></span
					>
				</button>
			{/each}
		</div>

		<!-- The dossier of the selected contact and the verdict buttons, within reach of the thumb -->
		<div
			class="flex flex-col gap-2 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_var(--color-ink)] [@media(max-height:520px)]:col-start-2"
		>
			<div class="flex min-h-9 items-center gap-2">
				<span class="shrink-0 font-display text-sm font-bold uppercase">
					{game.selectedNumber === null
						? RECON_TEXT.title
						: RECON_TEXT.dossier.track(game.selectedNumber)}
				</span>
				<div class="flex flex-1 justify-end gap-1.5">
					{#each dossierRows as row (row.sensor)}
						<span
							class="flex min-w-0 flex-col items-center rounded-md border-2 border-ink px-1.5 leading-tight {row.reading ===
							null
								? 'bg-sand'
								: 'bg-explosion-yellow'}"
						>
							<span class="text-[0.6rem] font-bold uppercase"
								>{RECON_TEXT.sensors[row.sensor].name}</span
							>
							<span class="truncate text-xs font-bold">
								{row.reading === null ? '–' : RECON_TEXT.readings[row.reading]}
							</span>
						</span>
					{/each}
				</div>
			</div>
			<p
				class="min-h-5 text-sm leading-tight font-semibold"
				role="status"
				aria-live="polite"
				dir="auto"
			>
				{hint}
			</p>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					class="btn-chunky min-h-12 justify-center bg-tie-red text-paper"
					disabled={!canAct || game.ordnance === 0}
					onclick={() => game.strike()}
				>
					<IconCrosshair class="size-5" aria-hidden="true" />
					{RECON_TEXT.dossier.strike}
				</button>
				<button
					type="button"
					class="btn-chunky min-h-12 justify-center bg-paper"
					disabled={!canAct}
					onclick={() => game.clearSelected()}
				>
					<IconShieldCheck class="size-5" aria-hidden="true" />
					{RECON_TEXT.dossier.clear}
				</button>
			</div>
		</div>
	</section>

	<TutorialModal
		open={showTutorial}
		title={RECON_TEXT.tutorial.title}
		closeLabel={RECON_TEXT.helpClose}
		onclose={() => (showTutorial = false)}
	>
		<p>{RECON_TEXT.tutorial.goal}</p>
		<p>{RECON_TEXT.tutorial.controls}</p>
		<p>{RECON_TEXT.tutorial.sensors}</p>
		<p>{RECON_TEXT.tutorial.rules}</p>
		<p>{RECON_TEXT.tutorial.verdict}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="recon"
		{modeName}
		outcome={game.overReason === 'won' ? 'won' : 'lost'}
		title={game.overReason ? RECON_TEXT.over.title(game.overReason) : undefined}
		isNewBest={game.isNewBest}
		onRetry={() => game.retry()}
	>
		{#if game.overReason}
			<p class="mb-3 text-center text-sm leading-snug" dir="auto">
				{RECON_TEXT.over.body(game.overReason)}
			</p>
		{/if}
		<dl class="flex justify-center gap-6 font-display">
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{RECON_TEXT.over.sorties}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.sortiesFlown}</dd>
			</div>
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{RECON_TEXT.over.best}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestSortie}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
