<!--
	Security Council Veto playfield: the draft resolution on its paper with the clock bar, the five
	seats with their cards, the three action buttons, the fixed-step loop, and the overlays (start
	card, pause card, toast, the red flash for a lost heart, the veto stamp with its screen shake).
	The playfield stays left-to-right and never scrolls. Reduced motion: no shake, no slam, the
	stamp simply appears.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { SEATS } from '#lib/game/veto/seats.js';
	import { formatDraftNumber } from '#lib/game/veto/resolutions.js';
	import { ACTIONS, actionForStance, type Action } from '#lib/game/veto/vote.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { VetoGame } from '#lib/stores/vetoGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import VetoPodium from './VetoPodium.svelte';
	import { actionName, resolutionText } from './vetoText.js';
	import IconAbstain from '~icons/lucide/hand';
	import IconYes from '~icons/lucide/thumbs-up';
	import IconPlay from '~icons/lucide/play';
	import IconStamp from '~icons/lucide/stamp';

	let { game }: { game: VetoGame } = $props();

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

	// Screen shake: the whole table jolts when the veto stamp lands
	$effect(() => {
		const count = game.shakeCount;
		if (count === 0 || !field || game.reducedMotion) return;
		const reach = 5 * game.shakePower;
		field.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: `translate(${-reach}px, ${reach}px) rotate(${-0.4 * game.shakePower}deg)` },
				{
					transform: `translate(${reach}px, ${-reach * 0.6}px) rotate(${0.4 * game.shakePower}deg)`
				},
				{ transform: `translate(${-reach * 0.6}px, ${-reach * 0.5}px)` },
				{ transform: `translate(${reach * 0.4}px, ${reach * 0.4}px)` },
				{ transform: 'translate(0, 0)' }
			],
			{ duration: 260 + 140 * game.shakePower, easing: 'ease-out' }
		);
	});

	const ICONS = { yes: IconYes, abstain: IconAbstain, veto: IconStamp } as const;
	const BUTTON_CLASS: Record<Action, string> = {
		yes: 'bg-[#8fd19e]',
		abstain: 'bg-sand',
		veto: 'bg-tie-red text-paper'
	};

	const verdictUp = $derived(game.phase !== 'question');
	const barClass = $derived(
		game.clock > 0.5 ? 'bg-flag-blue' : game.clock > 0.25 ? 'bg-mustard' : 'bg-tie-red'
	);

	function buttonState(action: Action): 'right' | 'wrong' | undefined {
		if (!verdictUp) return undefined;
		if (action === game.expected) return 'right';
		return game.last?.kind === 'wrong' && game.last.chosen === action ? 'wrong' : undefined;
	}

	const KEYS: Record<string, Action> = {
		Digit1: 'yes',
		Numpad1: 'yes',
		KeyY: 'yes',
		Digit2: 'abstain',
		Numpad2: 'abstain',
		KeyA: 'abstain',
		Digit3: 'veto',
		Numpad3: 'veto',
		KeyV: 'veto'
	};

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
		const action = KEYS[event.code];
		if (action && !event.repeat) {
			event.preventDefault();
			game.vote(action);
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
	<!-- The draft resolution on its paper, with the clock bar underneath -->
	<div
		class="relative flex flex-col gap-1.5 rounded-md border-3 border-ink bg-paper px-3 py-2 shadow-[2px_2px_0_var(--color-ink)]"
		role="group"
		aria-label={m.veto_draft_aria({
			number: formatDraftNumber(game.resolution.number),
			title: resolutionText(game.resolution.index)
		})}
	>
		<p
			class="flex items-center justify-between gap-2 font-display text-[0.65rem] font-bold tracking-wide uppercase sm:text-xs"
		>
			<span dir="auto">{m.veto_draft_label()}</span>
			<span class="tabular-nums">{formatDraftNumber(game.resolution.number)}</span>
		</p>
		{#key game.round}
			<p
				dir="auto"
				class="resolution flex min-h-[3.25rem] items-center justify-center text-center font-display text-xl leading-tight font-bold text-balance sm:min-h-[4rem] sm:text-3xl"
			>
				{resolutionText(game.resolution.index)}
			</p>
		{/key}
		<div class="h-3 overflow-hidden rounded-full border-2 border-ink bg-sand" aria-hidden="true">
			<div class="h-full {barClass}" style:width="{game.clock * 100}%"></div>
		</div>

		{#if game.stamp}
			{#key game.stamp.id}
				<div
					class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
					aria-hidden="true"
				>
					<div
						class="stamp -rotate-6 rounded-md border-[5px] border-tie-red bg-paper/70 px-4 py-1 text-center font-display font-bold text-tie-red uppercase"
					>
						<span class="block text-4xl leading-none sm:text-5xl">{m.veto_stamp_veto()}</span>
						{#if game.stamp.tieBreak}
							<span class="block text-xs leading-tight sm:text-sm">{m.veto_stamp_tie()}</span>
						{/if}
					</div>
				</div>
			{/key}
		{/if}
	</div>

	<!-- The five permanent seats -->
	<div
		role="group"
		aria-label={m.veto_board_label()}
		class="flex items-end justify-between gap-1.5 sm:gap-3"
	>
		{#each SEATS as seat, i (seat)}
			{@const card = game.cards[i]}
			{#if card}
				<VetoPodium
					{seat}
					{card}
					position={i}
					marked={verdictUp && !game.tieBreak && actionForStance(card) === game.expected}
					dimmed={verdictUp && !game.tieBreak && actionForStance(card) !== game.expected}
				/>
			{/if}
		{/each}
	</div>

	<!-- Your vote -->
	<div role="group" aria-label={m.veto_actions_label()} class="grid grid-cols-3 gap-2 sm:gap-3">
		{#each ACTIONS as action, i (action)}
			{@const Icon = ICONS[action]}
			{@const state = buttonState(action)}
			<button
				type="button"
				class="btn-chunky flex-col gap-1 px-1 py-3 text-sm leading-tight sm:text-lg {BUTTON_CLASS[
					action
				]}"
				class:verdict-right={state === 'right'}
				class:verdict-wrong={state === 'wrong'}
				aria-keyshortcuts={['1', '2', '3'][i]}
				onpointerdown={(event) => {
					if (event.pointerType === 'mouse' && event.button !== 0) return;
					game.vote(action);
				}}
				onclick={(event) => {
					// A tap already voted on pointer-down; this catches keyboard and assistive activation
					if (event.detail === 0) game.vote(action);
				}}
			>
				<Icon class="size-6 sm:size-7" aria-hidden="true" />
				<span dir="auto" class="max-w-full break-words">{actionName(action)}</span>
			</button>
		{/each}
	</div>

	{#if game.toast && game.status === 'playing'}
		{#key game.toast.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[38%] z-10 text-center font-display text-2xl leading-tight font-bold text-paper [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke] sm:text-3xl"
				aria-live="polite"
			>
				{game.toast.text}
			</p>
		{/key}
	{/if}

	{#if game.paceNote && game.status === 'playing'}
		{#key game.paceNote.id}
			<p
				dir="auto"
				class="notice pointer-events-none absolute inset-x-2 top-[55%] z-10 text-center font-display text-lg leading-tight font-bold text-paper [-webkit-text-stroke:4px_var(--color-ink)] [paint-order:stroke] sm:text-xl"
			>
				{game.paceNote.text}
			</p>
		{/key}
	{/if}

	<!-- A red flash around the field whenever a heart is lost -->
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
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.veto_ready_hint()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.veto_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.veto_start()}
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

	.resolution {
		animation: flash 420ms ease-out both;
	}

	.stamp {
		animation: slam 520ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
		box-shadow: 3px 3px 0 var(--color-ink);
	}

	.verdict-right {
		box-shadow:
			0 0 0 3px var(--color-paper),
			0 0 0 6px var(--color-ink);
	}

	.verdict-wrong {
		opacity: 0.55;
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

	/* The new draft blinks in, like a flashing notice */
	@keyframes flash {
		0% {
			opacity: 0;
			transform: scale(0.9);
		}
		30% {
			opacity: 1;
		}
		45% {
			opacity: 0.35;
		}
		60%,
		100% {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes slam {
		0% {
			opacity: 0;
			transform: scale(3.2);
		}
		40% {
			opacity: 1;
			transform: scale(0.92);
		}
		60% {
			transform: scale(1.04);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.notice {
			animation: none;
		}

		.resolution {
			animation: none;
		}

		.stamp {
			animation: stamp-fade 200ms linear both;
		}

		.hurt {
			animation-duration: 1ms;
		}

		@keyframes stamp-fade {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}
	}
</style>
