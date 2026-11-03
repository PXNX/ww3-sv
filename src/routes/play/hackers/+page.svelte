<!--
	Hermit Hackers: the Supreme Leader's cyber unit works through fictional crypto banks on a retro
	green terminal. Every contract has three stages: crack the access code, plant a keylogger and
	capture the admin's passphrase, then switch off the alarm relays. A trace meter creeps up and
	jumps on mistakes: full means traced, a heart lost and the contract gone. Three hearts.

	The page is a full screen terminal: no title bar and no score readout, only the game's own
	numbers (hearts, trace, DogeLite to spend) inside the screen. The back link, the pause button
	and the pause and result panels all wear the same green-on-black look.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import HackersBoot from '#lib/components/HackersBoot.svelte';
	import HackersBreach from '#lib/components/HackersBreach.svelte';
	import HackersKeylog from '#lib/components/HackersKeylog.svelte';
	import HackersRelays from '#lib/components/HackersRelays.svelte';
	import HackersShop from '#lib/components/HackersShop.svelte';
	import HackersTerminal from '#lib/components/HackersTerminal.svelte';
	import HackersTyped from '#lib/components/HackersTyped.svelte';
	import PauseOverlay from '#lib/components/PauseOverlay.svelte';
	import { STARTING_LIVES, TRACE_MAX } from '#lib/game/hackers/config.js';
	import type { Stage } from '#lib/game/hackers/state.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { HackersGame, TRACE_WARN, type HackersStatus } from '#lib/stores/hackersGame.svelte.js';
	import '#lib/styles/hackers.css';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconTerminal from '~icons/lucide/terminal';
	import IconWrench from '~icons/lucide/wrench';

	const game = new HackersGame();
	const modeName = m.mode_hackers_name();
	let shopOpen = $state(false);
	/** The run's boot sequence is showing: the clock and the keys wait for it */
	let booting = $state(false);
	let previousStatus: HackersStatus = 'ready';

	const STAGES: { id: Stage; label: () => string }[] = [
		{ id: 'breach', label: m.hackers_stage_breach },
		{ id: 'keylog', label: m.hackers_stage_keylog },
		{ id: 'breaker', label: m.hackers_stage_relays }
	];
	const stageIndex = $derived(STAGES.findIndex((stage) => stage.id === game.stage));

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: () => {} });

	onMount(() => {
		game.loadBest();
		game.loadProfile();
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			stopHidden();
		};
	});

	// A run that starts from the terminal or the result sheet opens with the boot sequence
	$effect(() => {
		const status = game.status;
		if (status === 'playing' && (previousStatus === 'ready' || previousStatus === 'over')) {
			booting = true;
			shopOpen = false;
		}
		if (status === 'ready' || status === 'over') booting = false;
		previousStatus = status;
	});

	$effect(() => {
		if (game.status === 'playing' && !booting) loop.start();
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
		if (game.status !== 'playing' || booting) return;
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
		game.trace >= TRACE_WARN
			? 'text-(--hk-red)'
			: game.trace >= 50
				? 'text-(--hk-amber)'
				: 'text-(--hk-green)'
	);
	const critical = $derived(game.trace >= TRACE_WARN);
	const playing = $derived(game.status === 'playing' || game.status === 'paused');
	const flashKind = $derived(game.status === 'over' ? 'fail' : game.flashKind);
	const flashText = $derived(
		game.status === 'over'
			? m.hackers_flash_traced()
			: game.flashKind === 'ok'
				? m.hackers_flash_granted()
				: m.hackers_flash_denied()
	);
</script>

<svelte:window onkeydown={onKey} />

<GameShell title={modeName} confirmLeave={playing} immersive backStyle="terminal">
	{#snippet actions()}
		{#if playing && !booting}
			<button type="button" class="hk-btn text-sm" onclick={() => game.togglePause()}>
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

	<section class="hk-screen" aria-label={m.hackers_term_aria()}>
		{#if game.status === 'ready'}
			<HackersTerminal {game} />
		{:else}
			<div class="flex min-h-0 flex-1 flex-col gap-2" class:hk-glitch={critical}>
				<div class="hk-panel flex items-center gap-3 px-3 py-2">
					<span
						class="shrink-0 text-lg leading-none tracking-wider text-(--hk-red) [text-shadow:0_0_6px_rgb(255_77_85/0.6)]"
						role="img"
						aria-label={m.hackers_lives({ count: game.lives })}
					>
						{#each { length: STARTING_LIVES }, i (i)}
							<span class={i < game.lives ? '' : 'opacity-30'}>{i < game.lives ? '♥' : '♡'}</span>
						{/each}
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2 text-xs font-bold">
							<span>{m.hackers_contract({ n: game.contractNumber })}</span>
							{#if critical}
								<span class="hk-warn" role="alert">{m.hackers_trace_critical()}</span>
							{/if}
							<span class="tabular-nums">{m.hackers_trace()} {Math.floor(game.trace)}%</span>
						</div>
						<div
							class="hk-meter mt-1 {traceTone}"
							role="meter"
							aria-label={m.hackers_trace()}
							aria-valuemin={0}
							aria-valuemax={TRACE_MAX}
							aria-valuenow={Math.floor(game.trace)}
						>
							<span style:width="{game.trace}%"></span>
						</div>
					</div>
					{#if playing}
						<button
							type="button"
							class="hk-btn shrink-0 text-xs"
							aria-expanded={shopOpen}
							aria-controls="hackers-shop"
							onclick={() => (shopOpen = !shopOpen)}
						>
							<IconWrench class="size-4" aria-hidden="true" />
							<span class="tabular-nums">{m.hackers_dogelite({ amount: game.score })}</span>
						</button>
					{/if}
				</div>

				<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
					{#if playing}
						{#if game.incomePerSecond > 0 || game.siphonRate > 0}
							<div class="flex flex-wrap gap-1.5 text-[11px] font-bold">
								{#if game.incomePerSecond > 0}
									<span class="hk-panel px-1.5 py-0.5">
										{m.hackers_tool_miner()}
										{m.hackers_income_rate({ rate: game.incomePerSecond })}
									</span>
								{/if}
								{#if game.siphonRate > 0}
									<span class="hk-panel px-1.5 py-0.5">
										{m.hackers_tool_siphon()}
										{m.hackers_wallet({ left: game.wallet, total: game.walletStart })}
									</span>
								{/if}
							</div>
						{/if}
						{#if shopOpen}
							<div id="hackers-shop">
								<HackersShop {game} />
							</div>
						{/if}
					{/if}

					{#key game.hurtCount}
						<div
							dir="ltr"
							class="hk-panel flex flex-col gap-3 p-3 {game.hurtCount > 0 ? 'hk-shake' : ''}"
						>
							<div class="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
								<span class="font-bold">{game.ip}</span>
								<span class="opacity-80">{game.system}</span>
							</div>

							<ol class="flex gap-1.5 text-[11px] font-bold" aria-label={m.hackers_stages_label()}>
								{#each STAGES as stage, i (stage.id)}
									<li
										class="flex-1 rounded border px-1.5 py-1 text-center {i === stageIndex
											? 'border-(--hk-green) bg-(--hk-green) text-(--hk-bg) [text-shadow:none]'
											: i < stageIndex
												? 'border-(--hk-green-dim)'
												: 'border-(--hk-green-faint) opacity-50'}"
										aria-current={i === stageIndex ? 'step' : undefined}
									>
										{i + 1}/3
										{stage.label()}
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

							<div class="hk-rule min-h-[7.5rem] pt-2 text-xs leading-relaxed" aria-live="polite">
								{#each game.log as line, i (game.logSeq - (game.log.length - 1 - i))}
									{@const newest = i === game.log.length - 1}
									<p class={newest ? '' : 'opacity-65'}>
										<HackersTyped text={line} animate={newest} />
									</p>
								{/each}
								<span class="hk-cursor" aria-hidden="true"></span>
							</div>
						</div>
					{/key}
				</div>
			</div>

			{#if booting}
				<HackersBoot {game} onDone={() => (booting = false)} />
			{/if}

			{#if game.status === 'paused'}
				<PauseOverlay cover terminal onResume={() => game.resume()} />
			{/if}

			{#if game.flashSeq > 0}
				{#key game.flashSeq}
					<div class="hk-flash" data-kind={flashKind} aria-hidden="true">
						{flashText}
					</div>
				{/key}
			{/if}
		{/if}

		<div class="hk-glow" aria-hidden="true"></div>
		<div class="hk-crt" aria-hidden="true"></div>
	</section>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		mode="hackers"
		{modeName}
		isNewBest={game.isNewBest}
		terminal
		withCharacter={false}
		title={m.hackers_gameover_title()}
		drawBoard={game.drawBoard}
		onRetry={() => game.start()}
	>
		<dl class="flex justify-center gap-6">
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.hackers_stat_contracts()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.completed}</dd>
			</div>
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.hackers_stat_coins()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.score}</dd>
			</div>
			<div class="flex flex-col items-center">
				<dt class="text-xs font-bold uppercase">{m.hackers_stat_siphoned()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.siphoned}</dd>
			</div>
		</dl>
		<button
			type="button"
			class="btn-chunky mx-auto mt-1 px-3 py-1 text-sm"
			onclick={() => game.quit()}
		>
			<IconTerminal class="size-4" aria-hidden="true" />
			{m.hackers_term_back()}
		</button>
	</GameOverModal>
</GameShell>
