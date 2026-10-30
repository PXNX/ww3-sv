<!--
	Hermit Hackers: the Supreme Leader's cyber unit works through fictional crypto banks on a retro
	green terminal. Every contract has three stages: crack the access code, plant a keylogger and
	capture the admin's passphrase, then switch off the alarm relays. A trace meter creeps up and
	jumps on mistakes: full means traced, a heart lost and the contract gone. Three hearts.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import HackersBreach from '#lib/components/HackersBreach.svelte';
	import HackersKeylog from '#lib/components/HackersKeylog.svelte';
	import HackersRelays from '#lib/components/HackersRelays.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import { STARTING_LIVES, TRACE_MAX } from '#lib/game/hackers/config.js';
	import type { Stage } from '#lib/game/hackers/state.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { HackersGame } from '#lib/stores/hackersGame.svelte.js';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new HackersGame();
	const modeName = m.mode_hackers_name();

	const STAGES: { id: Stage; label: () => string }[] = [
		{ id: 'breach', label: m.hackers_stage_breach },
		{ id: 'keylog', label: m.hackers_stage_keylog },
		{ id: 'breaker', label: m.hackers_stage_relays }
	];
	const stageIndex = $derived(STAGES.findIndex((stage) => stage.id === game.stage));

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: () => {} });

	onMount(() => {
		game.loadBest();
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') loop.start();
		else loop.pause();
	});

	function onKey(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('input, textarea, select')) return;
		if (event.code === 'Escape') {
			game.pause();
			return;
		}
		if (event.code === 'KeyP' && !event.repeat) {
			if (game.status === 'playing' || game.status === 'paused') {
				game.togglePause();
				event.preventDefault();
			}
			return;
		}
		if (game.status !== 'playing') return;
		if (game.stage === 'breach') {
			if (/^Digit[1-8]$/.test(event.code)) game.pushSymbol(Number(event.code.slice(5)) - 1);
			else if (event.code === 'Backspace') game.popSymbol();
			else if (event.code === 'Enter' && !(target instanceof HTMLButtonElement)) game.submit();
			else return;
			event.preventDefault();
		} else if (game.stage === 'keylog' && /^Key[A-Z]$/.test(event.code)) {
			game.typeLetter(event.code.slice(3).toLowerCase());
			event.preventDefault();
		}
	}

	const traceTone = $derived(
		game.trace >= 80 ? 'bg-[#e5484d]' : game.trace >= 50 ? 'bg-[#e8b923]' : 'bg-[#39ff6a]'
	);
</script>

<svelte:window onkeydown={onKey} />

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
>
	{#snippet actions()}
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

	<section class="mx-auto flex w-full max-w-xl flex-col gap-2">
		<div
			class="flex items-center gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1.5 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
			<div class="min-w-0 flex-1">
				<div class="flex items-baseline justify-between gap-2 font-display text-xs font-bold">
					<span>{m.hackers_contract({ n: game.contractNumber })}</span>
					<span class="tabular-nums">{m.hackers_trace()} {Math.floor(game.trace)}%</span>
				</div>
				<div
					class="mt-0.5 h-2.5 overflow-hidden rounded-full border-2 border-ink bg-sand"
					role="meter"
					aria-label={m.hackers_trace()}
					aria-valuemin={0}
					aria-valuemax={TRACE_MAX}
					aria-valuenow={Math.floor(game.trace)}
				>
					<div class="h-full {traceTone}" style:width="{game.trace}%"></div>
				</div>
			</div>
		</div>

		{#key game.hurtCount}
			<div
				dir="ltr"
				class="relative overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-[#021208] p-3 font-mono text-[#39ff6a] shadow-[4px_4px_0_var(--color-ink)] [text-shadow:0_0_6px_rgba(57,255,106,0.55)] {game.hurtCount >
				0
					? 'motion-safe:animate-[pulse_0.4s_ease-out_1]'
					: ''}"
			>
				<div
					class="pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.22)_0_1px,transparent_1px_3px)]"
					aria-hidden="true"
				></div>

				<div class="relative flex flex-col gap-3">
					<div class="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
						<span class="font-bold">{game.ip}</span>
						<span class="opacity-80">{game.system}</span>
					</div>

					<ol class="flex gap-1.5 text-[11px] font-bold" aria-label={m.hackers_stages_label()}>
						{#each STAGES as stage, i (stage.id)}
							<li
								class="flex-1 rounded border px-1.5 py-0.5 text-center {i === stageIndex
									? 'border-[#39ff6a] bg-[#39ff6a] text-[#021208] [text-shadow:none]'
									: i < stageIndex
										? 'border-[#39ff6a]/60'
										: 'border-[#39ff6a]/25 opacity-50'}"
								aria-current={i === stageIndex ? 'step' : undefined}
							>
								{i + 1}/3 {stage.label()}
							</li>
						{/each}
					</ol>

					{#if game.stage === 'breach'}
						<HackersBreach {game} />
					{:else if game.stage === 'keylog'}
						<HackersKeylog {game} />
					{:else}
						<HackersRelays {game} />
					{/if}

					<div
						class="min-h-[7.5rem] border-t border-[#39ff6a]/30 pt-2 text-xs leading-relaxed"
						aria-live="polite"
					>
						{#each game.log as line, i (i)}
							<p class={i === game.log.length - 1 ? '' : 'opacity-65'}>{line}</p>
						{/each}
						<span class="inline-block h-3 w-1.5 bg-[#39ff6a] align-middle motion-safe:animate-pulse"
						></span>
					</div>
				</div>

				{#if game.status === 'ready'}
					<div
						class="absolute inset-0 z-20 flex items-center justify-center bg-ink/60 p-4 [text-shadow:none]"
					>
						<div
							class="sticker pop-in flex max-w-sm flex-col items-center gap-3 p-4 text-center font-sans text-ink"
							style:--tilt="-1.5deg"
						>
							<p class="leading-snug font-semibold">{m.hackers_how_to()}</p>
							<p class="hidden text-sm sm:block">{m.hackers_keyboard_hint()}</p>
							<button
								type="button"
								class="btn-chunky bg-tie-red text-xl"
								onclick={() => game.start()}
							>
								<IconPlay class="size-5" aria-hidden="true" />
								{m.hackers_start()}
							</button>
						</div>
					</div>
				{:else if game.status === 'paused'}
					<div class="absolute inset-0 z-20 [text-shadow:none]">
						<PauseOverlay cover onResume={() => game.resume()} />
					</div>
				{/if}
			</div>
		{/key}
	</section>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="hackers"
		{modeName}
		isNewBest={game.isNewBest}
		title={m.hackers_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="flex justify-center gap-6 font-display">
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.hackers_stat_contracts()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.completed}</dd>
			</div>
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.hackers_stat_coins()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.score}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
