<!--
	Petrobras playfield: the two fronts (the boardroom and the society feed) as bars, the problem on
	the front in play with its clock, the two calls, the fixed-step loop and the overlays (start card,
	pause card, the verdict toast, the quiet note about the ignored front, the red flash for a lost
	point). The playfield stays left to right and never scrolls. Reduced motion: no shake, the toasts
	simply fade.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PetrobrasGame } from '#lib/stores/petrobrasGame.svelte.js';
	import type { Choice } from '#lib/game/petrobras/scenarios.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import { choiceName, frontName, scenarioText } from './petrobrasText.js';
	import IconBriefcase from '~icons/lucide/briefcase';
	import IconMegaphone from '~icons/lucide/megaphone';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: PetrobrasGame } = $props();

	let field: HTMLDivElement | undefined = $state();

	const CALLS = [
		{ choice: 'firm', key: 'Digit1' },
		{ choice: 'loose', key: 'Digit2' }
	] as const satisfies readonly { choice: Choice; key: string }[];

	const loop = createFixedLoop({
		update: (dtMs) => game.update(dtMs),
		render: () => {}
	});

	onMount(() => {
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

	// The card jolts whenever a call is missed or the clock runs out
	$effect(() => {
		const count = game.shakeCount;
		if (count === 0 || !field || game.reducedMotion) return;
		field.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: 'translate(-5px, 2px) rotate(-0.3deg)' },
				{ transform: 'translate(5px, -2px) rotate(0.3deg)' },
				{ transform: 'translate(0, 0)' }
			],
			{ duration: 240, easing: 'ease-out' }
		);
	});

	const neglected = $derived(game.boss ? null : game.front === 'board' ? 'society' : 'board');
	const promptUp = $derived(game.status === 'playing' && game.phase === 'prompt');
	const clockClass = $derived(
		game.clock > 0.5 ? 'bg-[#6f8d4b]' : game.clock > 0.25 ? 'bg-explosion-yellow' : 'bg-tie-red'
	);

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
			return;
		}
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('input, select, textarea')) return;
		if (event.code === 'KeyP') {
			if (!event.repeat && !(target instanceof HTMLButtonElement)) game.togglePause();
			return;
		}
		if (target instanceof HTMLButtonElement) return;
		if (event.code === 'Digit1' || event.code === 'Numpad1') {
			event.preventDefault();
			game.choose('firm');
		} else if (event.code === 'Digit2' || event.code === 'Numpad2') {
			event.preventDefault();
			game.choose('loose');
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	bind:this={field}
	data-playfield
	dir="ltr"
	class="relative flex w-full touch-none flex-col gap-3 overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand p-2 shadow-[4px_4px_0_var(--color-ink)] select-none sm:p-3"
	style:touch-action="none"
>
	<!-- Round, front and, on every fifth round, the feed algorithm -->
	<div
		class="flex items-center justify-between gap-2 rounded-md border-3 border-ink bg-paper px-3 py-1.5 shadow-[2px_2px_0_var(--color-ink)]"
	>
		<p
			dir="auto"
			class="min-w-0 truncate font-display text-sm leading-tight font-bold sm:text-base"
		>
			{m.petrobras_hud_round({ round: game.round })}
		</p>
		<p
			dir="auto"
			class="shrink-0 font-display text-sm leading-tight font-bold sm:text-base"
			class:text-tie-red={game.boss}
		>
			{game.boss ? m.petrobras_hud_boss() : m.petrobras_hud_front({ front: frontName(game.front) })}
		</p>
	</div>

	<!-- The two fronts, scored by the lower one -->
	<div class="grid grid-cols-2 gap-2">
		{#each [{ key: 'board', value: game.board }, { key: 'society', value: game.society }] as track (track.key)}
			<div
				class="rounded-md border-3 border-ink bg-paper px-2 py-1.5 shadow-[2px_2px_0_var(--color-ink)]"
				class:opacity-60={neglected === track.key && game.status === 'playing'}
			>
				<div class="flex items-baseline justify-between gap-1">
					<p
						dir="auto"
						class="flex min-w-0 items-center gap-1 truncate font-display text-xs font-bold sm:text-sm"
					>
						{#if track.key === 'board'}
							<IconBriefcase class="size-3.5 shrink-0" aria-hidden="true" />
						{:else}
							<IconMegaphone class="size-3.5 shrink-0" aria-hidden="true" />
						{/if}
						<span class="truncate">
							{track.key === 'board' ? m.petrobras_front_board() : m.petrobras_front_society()}
						</span>
					</p>
					<p class="shrink-0 font-display text-sm font-bold tabular-nums">{track.value}</p>
				</div>
				<div class="mt-1 h-2 overflow-hidden rounded-sm border-2 border-ink bg-sand">
					<div
						class="h-full {track.key === 'board' ? 'bg-banner-slate' : 'bg-[#6f8d4b]'}"
						style:width="{Math.max(0, Math.min(100, track.value))}%"
					></div>
				</div>
				{#if neglected === track.key && game.status === 'playing'}
					<p
						dir="auto"
						class="mt-0.5 truncate text-[11px] leading-tight font-semibold text-tie-red"
					>
						{m.petrobras_neglected()}
					</p>
				{/if}
			</div>
		{/each}
	</div>

	<!-- The problem on the front in play, with the clock -->
	<div
		class="flex min-h-24 flex-col justify-between gap-2 rounded-md border-3 border-ink bg-paper p-2 shadow-[2px_2px_0_var(--color-ink)] sm:min-h-28 sm:p-3"
		class:bg-[#f6d9d9]={game.boss}
	>
		<p
			dir="auto"
			class="font-display text-sm leading-snug font-bold sm:text-base"
			aria-live="polite"
		>
			{scenarioText(game.front, game.scenarioIndex)}
		</p>
		<div class="h-2 overflow-hidden rounded-sm border-2 border-ink bg-sand" aria-hidden="true">
			<div
				class="h-full transition-[width] duration-100 ease-linear {clockClass}"
				style:width="{game.clock * 100}%"
			></div>
		</div>
	</div>

	<!-- The two calls -->
	<div class="grid grid-cols-2 gap-2">
		{#each CALLS as call (call.choice)}
			<button
				type="button"
				class="btn-chunky min-h-14 flex-col gap-0.5 px-2 py-2 text-sm leading-tight disabled:opacity-60 sm:text-base"
				class:bg-[#8fd19e]={promptUp && call.choice === 'firm'}
				class:bg-explosion-yellow={promptUp && call.choice === 'loose'}
				aria-keyshortcuts={call.key === 'Digit1' ? '1' : '2'}
				disabled={!promptUp}
				onclick={() => game.choose(call.choice)}
			>
				<span class="font-display text-[11px] font-bold tabular-nums opacity-70 sm:text-xs">
					{call.key === 'Digit1' ? '1' : '2'}
				</span>
				<span dir="auto">{choiceName(game.front, call.choice)}</span>
			</button>
		{/each}
	</div>

	{#if game.toast && game.status === 'playing'}
		{#key game.toast.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[38%] z-10 text-center font-display text-xl leading-tight font-bold text-paper [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke] sm:text-2xl"
				aria-live="polite"
			>
				{game.toast.text}
			</p>
		{/key}
	{/if}

	{#if game.neglectNote && game.status === 'playing'}
		{#key game.neglectNote.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[54%] z-10 text-center font-display text-sm leading-tight font-bold text-paper [-webkit-text-stroke:4px_var(--color-ink)] [paint-order:stroke] sm:text-base"
			>
				{game.neglectNote.text}
			</p>
		{/key}
	{/if}

	<!-- A red flash around the field whenever a front loses a point to a bad call -->
	{#key game.hurtCount}
		{#if game.hurtCount > 0 && game.status === 'playing'}
			<div class="hurt pointer-events-none absolute inset-0 z-10 border-8 border-tie-red"></div>
		{/if}
	{/key}

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink/35 p-4"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.petrobras_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.petrobras_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.petrobras_start()}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{/if}
</div>

<style>
	.notice {
		animation: notice 1300ms ease-out forwards;
	}

	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	@keyframes notice {
		0% {
			opacity: 0;
			transform: scale(0.7);
		}
		12% {
			opacity: 1;
			transform: scale(1.08);
		}
		20% {
			transform: scale(1);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-0.75rem);
		}
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
		.notice {
			animation: none;
		}

		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
