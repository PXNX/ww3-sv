<!--
	Border Shift playfield: the night checkpoint, the waiting convoy, the patience bar, the two
	inspection tools with their clues, and the two decisions. The fixed-step loop only drains the
	convoy's patience. The playfield stays left to right and never scrolls.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { BorderShiftGame } from '#lib/stores/bordershiftGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import { clueText, toolLabel, truthText, vehicleText } from './bordershiftText.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconCamera from '~icons/lucide/camera';
	import IconFileText from '~icons/lucide/file-text';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: BorderShiftGame } = $props();

	let field: HTMLDivElement | undefined = $state();

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

	// The post jolts whenever a call goes wrong
	$effect(() => {
		const count = game.shakeCount;
		if (count === 0 || !field || game.reducedMotion) return;
		field.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: 'translate(-6px, 3px) rotate(-0.4deg)' },
				{ transform: 'translate(6px, -3px) rotate(0.4deg)' },
				{ transform: 'translate(-3px, -2px)' },
				{ transform: 'translate(0, 0)' }
			],
			{ duration: 260, easing: 'ease-out' }
		);
	});

	const watching = $derived(game.status === 'playing' && game.phase === 'watch');
	const patienceClass = $derived(
		game.patience > 0.5
			? 'bg-[#6f8d4b]'
			: game.patience > 0.25
				? 'bg-explosion-yellow'
				: 'bg-tie-red'
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
		if (!watching) return;
		if (event.code === 'KeyD' && !event.repeat) game.inspect('documents');
		if (event.code === 'KeyC' && !event.repeat) game.inspect('camera');
		if (
			event.code === 'ArrowRight' ||
			(event.code === 'Enter' && !(target instanceof HTMLButtonElement))
		) {
			event.preventDefault();
			game.decide('pass');
		}
		if (event.code === 'ArrowLeft') {
			event.preventDefault();
			game.decide('refuse');
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	bind:this={field}
	data-playfield
	dir="ltr"
	class="relative flex w-full flex-1 touch-none flex-col gap-2 overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand p-2 shadow-[4px_4px_0_var(--color-ink)] select-none sm:p-3"
>
	<!-- The night post: sky, lamp, barrier and the convoy waiting on the road -->
	<div
		class="relative min-h-24 overflow-hidden rounded-md border-3 border-ink bg-[#2f3a4a] sm:min-h-28"
		aria-hidden="true"
	>
		<div class="absolute top-2 right-3 h-6 w-6 rounded-full border-2 border-ink bg-[#f4efcf]"></div>
		<div class="absolute top-4 left-4 h-1 w-1 rounded-full bg-[#f4efcf]/70"></div>
		<div class="absolute top-9 left-10 h-1 w-1 rounded-full bg-[#f4efcf]/50"></div>
		<div class="absolute top-3 left-16 h-1 w-1 rounded-full bg-[#f4efcf]/60"></div>
		<div class="absolute top-8 left-24 h-1 w-1 rounded-full bg-[#f4efcf]/40"></div>
		<!-- Road -->
		<div class="absolute inset-x-0 bottom-0 h-8 border-t-3 border-ink bg-[#55604a]"></div>
		<div class="absolute inset-x-0 bottom-3.5 h-0.5 bg-[#f4efcf]/40"></div>
		<!-- Lamp over the barrier -->
		<div class="absolute right-6 bottom-8 h-12 w-1 bg-ink"></div>
		<div
			class="absolute right-3 bottom-[4.4rem] h-7 w-6 rounded-sm border-2 border-ink bg-[#e1a53c]"
		></div>
		<!-- Barrier, red and white -->
		<div class="absolute right-5 bottom-7 flex h-2 w-20 border-2 border-ink">
			<span class="h-full flex-1 bg-tie-red"></span>
			<span class="h-full flex-1 bg-paper"></span>
			<span class="h-full flex-1 bg-tie-red"></span>
			<span class="h-full flex-1 bg-paper"></span>
		</div>
		<div
			class="absolute right-[6.2rem] bottom-4 h-3 w-2 rounded-sm border-2 border-ink bg-ink"
		></div>
		<!-- The convoy, headlights on -->
		<div class="absolute bottom-5 left-5 h-9 w-16 rounded-sm border-2 border-ink bg-[#4b5563]">
			<div class="absolute top-1 left-1 h-3 w-5 rounded-sm border border-ink bg-[#8fa3b8]"></div>
			<div
				class="absolute right-1 bottom-1 h-2 w-2 rounded-full border border-ink bg-[#f5c83a]"
			></div>
		</div>
		<p
			dir="auto"
			class="absolute top-2 left-3 max-w-[70%] font-display text-xs leading-tight font-bold text-paper sm:text-sm"
		>
			{m.bordershift_scene_label()}
		</p>
	</div>

	<!-- Who is at the barrier, and how much patience is left -->
	<div class="flex flex-col gap-1.5 rounded-md border-3 border-ink bg-paper px-3 py-2">
		<p dir="auto" class="font-display text-base leading-tight font-bold sm:text-lg">
			{vehicleText(game.vehicle)}
		</p>
		<div class="flex items-center gap-2">
			<p class="shrink-0 text-xs font-bold whitespace-nowrap">{m.bordershift_patience_label()}</p>
			<div
				class="h-3 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand"
				role="progressbar"
				aria-label={m.bordershift_aria_patience()}
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={Math.round(game.patience * 100)}
			>
				<div class="h-full {patienceClass}" style:width="{game.patience * 100}%"></div>
			</div>
		</div>
	</div>

	<!-- The two tools and the clues they found -->
	<div class="grid grid-cols-2 gap-2">
		<button
			type="button"
			class="btn-chunky flex-col gap-1 px-2 py-2 text-sm leading-tight disabled:opacity-60 sm:text-base"
			disabled={!watching || game.revealed.documents !== null}
			onclick={() => game.inspect('documents')}
		>
			<IconFileText class="size-5" aria-hidden="true" />
			<span dir="auto">{toolLabel('documents')}</span>
		</button>
		<button
			type="button"
			class="btn-chunky flex-col gap-1 px-2 py-2 text-sm leading-tight disabled:opacity-60 sm:text-base"
			disabled={!watching || game.revealed.camera !== null}
			onclick={() => game.inspect('camera')}
		>
			<IconCamera class="size-5" aria-hidden="true" />
			<span dir="auto">{toolLabel('camera')}</span>
		</button>
	</div>

	{#if game.revealed.documents !== null || game.revealed.camera !== null}
		<div class="flex flex-col gap-1.5">
			{#if game.revealed.documents !== null}
				<p
					dir="auto"
					class="rounded-md border-2 border-ink bg-explosion-yellow/25 px-2 py-1 text-xs leading-snug font-semibold sm:text-sm"
				>
					<span class="font-bold">{m.bordershift_papers_label()}</span>
					{clueText('documents', game.revealed.documents)}
				</p>
			{/if}
			{#if game.revealed.camera !== null}
				<p
					dir="auto"
					class="rounded-md border-2 border-ink bg-explosion-yellow/25 px-2 py-1 text-xs leading-snug font-semibold sm:text-sm"
				>
					<span class="font-bold">{m.bordershift_photo_label()}</span>
					{clueText('camera', game.revealed.camera)}
				</p>
			{/if}
		</div>
	{/if}

	<!-- The decision -->
	<div class="grid grid-cols-2 gap-2">
		<button
			type="button"
			class="btn-chunky flex-col gap-1 bg-explosion-yellow px-2 py-2 text-sm leading-tight disabled:opacity-60 sm:text-base"
			disabled={!watching}
			onclick={() => game.decide('refuse')}
		>
			<IconArrowLeft class="size-5" aria-hidden="true" />
			<span dir="auto">{m.bordershift_action_refuse()}</span>
		</button>
		<button
			type="button"
			class="btn-chunky flex-col gap-1 bg-[#8fd19e] px-2 py-2 text-sm leading-tight disabled:opacity-60 sm:text-base"
			disabled={!watching}
			onclick={() => game.decide('pass')}
		>
			<IconArrowRight class="size-5" aria-hidden="true" />
			<span dir="auto">{m.bordershift_action_pass()}</span>
		</button>
	</div>

	<!-- What the call was worth, shown while the next convoy waits -->
	{#if game.last && game.phase !== 'watch' && game.status !== 'ready'}
		<div
			class="rounded-md border-3 border-ink px-3 py-1.5 text-center {game.last.kind === 'correct'
				? 'bg-[#8fd19e]'
				: 'bg-tie-red text-paper'}"
			aria-live="polite"
		>
			<p dir="auto" class="font-display text-sm leading-tight font-bold sm:text-base">
				{game.last.kind === 'correct'
					? m.bordershift_verdict_correct({ points: game.last.points })
					: m.bordershift_verdict_wrong()}
			</p>
			<p dir="auto" class="text-xs leading-tight font-semibold sm:text-sm">
				{m.bordershift_verdict_was({ truth: truthText(game.last.truth) })}
			</p>
		</div>
	{/if}

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

	{#if game.waveNote && game.status === 'playing'}
		{#key game.waveNote.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[56%] z-10 text-center font-display text-base leading-tight font-bold text-paper [-webkit-text-stroke:4px_var(--color-ink)] [paint-order:stroke] sm:text-lg"
			>
				{game.waveNote.text}
			</p>
		{/key}
	{/if}

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
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.bordershift_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.bordershift_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.bordershift_start()}
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
