<!--
	Centrifuge Spin playfield: the calm face next to the spinning dial, the scares (sirens, a
	BREAKING banner, screen shake, a looming "Something") and the one big Stabilize button. A tap
	anywhere on the field presses it, and so do Space and Enter. Shake and the other animations have
	a still fallback for reduced motion. The field never mirrors in right-to-left languages and never
	scrolls (touch-action: none).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import type { CentrifugeGame, Popup } from '#lib/stores/centrifugeGame.svelte.js';
	import { bannerText, calmLine } from './centrifugeText.js';
	import CentrifugeDial from './CentrifugeDial.svelte';
	import CentrifugeFace from './CentrifugeFace.svelte';
	import CentrifugeSomething from './CentrifugeSomething.svelte';
	import PauseOverlay from './PauseOverlay.svelte';
	import IconGauge from '~icons/lucide/gauge';
	import IconPlay from '~icons/lucide/play';

	let { game }: { game: CentrifugeGame } = $props();

	const playing = $derived(game.status === 'playing');
	const still = $derived(game.reducedMotion || !playing);
	const play = $derived(playing ? 'running' : 'paused');

	const siren = $derived(game.scares.find((scare) => scare.kind === 'siren'));
	const banner = $derived(game.scares.find((scare) => scare.kind === 'banner'));
	const shake = $derived(game.scares.find((scare) => scare.kind === 'shake'));
	const something = $derived(game.scares.find((scare) => scare.kind === 'something'));

	const loop = createFixedLoop({ update: (dtMs) => game.update(dtMs), render: () => {} });

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

	function popupText(popup: Popup): string {
		switch (popup.kind) {
			case 'calm':
				return m.centrifuge_popup_calm({ points: popup.points });
			case 'fix':
				return m.centrifuge_popup_fix({ points: popup.points });
			case 'overreact':
				return `${m.centrifuge_popup_overreact()} -1 ♥`;
			default:
				return `${m.centrifuge_popup_meltdown()} -1 ♥`;
		}
	}

	const isInteractive = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		target.closest('button, a, input, select, textarea, [contenteditable]') !== null;

	function onKey(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
		} else if (isInteractive(event.target) || event.repeat) {
			return;
		} else if (event.code === 'KeyP') {
			game.togglePause();
		} else if (event.code === 'Space' || event.code === 'Enter') {
			event.preventDefault();
			game.press();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	data-playfield
	dir="ltr"
	class="flex w-full flex-col gap-3 select-none"
	style:touch-action="none"
	aria-label={m.centrifuge_playfield_label()}
	onpointerdown={() => game.press()}
>
	<div class="relative">
		<div
			class="scene relative aspect-[5/6] overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand shadow-[4px_4px_0_var(--color-ink)]"
			class:shaking={shake && !still}
			class:rumble={shake && game.reducedMotion}
			style:--shake="{shake ? 2 + shake.intensity * 7 : 0}px"
			style:animation-play-state={play}
		>
			<!-- The looming Something creeps up behind everything -->
			{#if something}
				<div
					class="loom pointer-events-none absolute inset-x-[12%] top-[8%] bottom-0 z-0"
					class:loom-still={game.reducedMotion}
					style:--dur="{something.durationMs}ms"
					style:--strength={0.35 + something.intensity * 0.45}
					style:animation-play-state={play}
				>
					<CentrifugeSomething class="size-full" />
				</div>
				<p
					dir="auto"
					class="absolute inset-x-0 bottom-1 z-10 text-center font-display text-sm font-bold text-paper"
				>
					{m.centrifuge_scare_something()}
				</p>
			{/if}

			<div class="relative z-10 flex h-full flex-col justify-end gap-1 p-3 pt-20">
				<div class="flex items-end justify-between gap-2">
					<div class="relative flex w-[40%] flex-col items-center">
						<p
							dir="auto"
							class="mb-1 rounded-[10px_6px_12px_8px] border-2 border-ink bg-paper px-2 py-0.5 text-center font-display text-xs leading-tight font-bold sm:text-sm"
						>
							{calmLine(game.calmScares)}
						</p>
						<CentrifugeFace
							startled={game.startled}
							alt={m.centrifuge_face_label()}
							class="w-full"
						/>
					</div>
					<CentrifugeDial
						value={game.dialValue}
						spinning={playing}
						reducedMotion={game.reducedMotion}
						label={m.centrifuge_dial_label()}
						class="w-[58%]"
					/>
				</div>
			</div>

			<!-- Sirens: two light bars at the sides (a steady glow with reduced motion) -->
			{#if siren}
				<div
					class="siren siren-red pointer-events-none absolute inset-y-0 start-0 z-20 w-6"
					class:siren-still={game.reducedMotion}
					style:--glow={0.35 + siren.intensity * 0.4}
					style:animation-play-state={play}
				></div>
				<div
					class="siren siren-blue pointer-events-none absolute inset-y-0 end-0 z-20 w-6"
					class:siren-still={game.reducedMotion}
					style:--glow={0.35 + siren.intensity * 0.4}
					style:animation-play-state={play}
				></div>
			{/if}

			<!-- BREAKING banner and a label for the shake -->
			<div class="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1 p-2">
				{#if banner}
					{#key banner.id}
						<div
							class="banner flex items-stretch overflow-hidden rounded-md border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
							class:banner-still={game.reducedMotion}
						>
							<span
								dir="auto"
								class="flex shrink-0 items-center bg-tie-red px-2 font-display text-xs font-bold tracking-wide text-paper uppercase"
							>
								{m.centrifuge_breaking()}
							</span>
							<span dir="auto" class="px-2 py-1 text-xs leading-tight font-bold sm:text-sm">
								{bannerText(banner.variant)}
							</span>
						</div>
					{/key}
				{/if}
				{#if shake}
					<span
						dir="auto"
						class="self-center rounded-full border-2 border-ink bg-explosion-yellow px-3 font-display text-xs font-bold"
					>
						{m.centrifuge_scare_shake()}
					</span>
				{/if}
				{#if siren}
					<span
						dir="auto"
						class="self-center rounded-full border-2 border-ink bg-tie-red px-3 font-display text-xs font-bold text-paper"
					>
						{m.centrifuge_scare_siren()}
					</span>
				{/if}
			</div>

			<!-- Floating notices: points and lost hearts -->
			<div
				class="pointer-events-none absolute inset-x-0 top-1/3 z-30 flex flex-col items-center gap-1"
			>
				{#each game.popups as popup (popup.id)}
					<span
						class="popup rounded-md border-2 border-ink px-2 py-0.5 font-display text-base font-bold shadow-[2px_2px_0_var(--color-ink)]"
						class:popup-still={game.reducedMotion}
						class:bg-explosion-yellow={popup.kind === 'fix' || popup.kind === 'calm'}
						class:bg-tie-red={popup.kind === 'overreact' || popup.kind === 'meltdown'}
						class:text-paper={popup.kind === 'overreact' || popup.kind === 'meltdown'}
						style:animation-play-state={play}
					>
						{popupText(popup)}
					</span>
				{/each}
			</div>
		</div>

		<!-- A red flash around the field whenever a heart is lost -->
		{#key game.hurtCount}
			{#if game.hurtCount > 0 && playing}
				<div
					class="hurt pointer-events-none absolute inset-0 z-30 rounded-[14px_8px_16px_10px] border-8 border-tie-red"
				></div>
			{/if}
		{/key}

		{#if game.status === 'ready'}
			<div
				class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 rounded-[14px_8px_16px_10px] bg-ink/35 p-4"
			>
				<div
					class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
					style:--tilt="-1.5deg"
				>
					<p dir="auto" class="text-sm leading-snug font-semibold">{m.centrifuge_ready_hint()}</p>
					{#if game.best !== null}
						<p class="text-sm font-semibold">{m.centrifuge_best({ score: game.best })}</p>
					{/if}
					<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
						<IconPlay class="size-5" aria-hidden="true" />
						{m.centrifuge_start()}
					</button>
				</div>
			</div>
		{:else if game.status === 'paused'}
			<PauseOverlay onResume={() => game.resume()} />
		{/if}
	</div>

	<button
		type="button"
		class="btn-chunky w-full justify-center bg-explosion-yellow py-4 text-2xl"
		aria-keyshortcuts="Space"
		onclick={(event) => {
			// A pointer press is already handled by the field; this is the keyboard path
			if (event.detail === 0) game.press();
		}}
	>
		<IconGauge class="size-6" aria-hidden="true" />
		{m.centrifuge_stabilize()}
	</button>

	<p class="sr-only" aria-live="polite">
		{#if playing}
			{game.outOfBand ? m.centrifuge_status_drift() : m.centrifuge_status_calm()}
		{/if}
	</p>
</div>

<style>
	.shaking {
		animation: shake 90ms linear infinite alternate;
	}

	/* With reduced motion the screen holds still and gets a zigzag outline instead */
	.rumble {
		outline: 6px dashed var(--color-explosion-yellow);
		outline-offset: -10px;
	}

	.loom {
		opacity: var(--strength);
		animation: loom var(--dur) ease-in forwards;
	}

	.loom-still {
		animation: none;
		transform: scale(0.95);
	}

	.siren {
		opacity: var(--glow);
		animation: siren 900ms ease-in-out infinite alternate;
	}

	.siren-red {
		background: linear-gradient(to right, var(--color-tie-red), transparent);
	}

	.siren-blue {
		background: linear-gradient(to left, var(--color-flag-blue), transparent);
		animation-delay: -450ms;
	}

	.siren-still {
		animation: none;
	}

	.banner {
		animation: banner-in 260ms ease-out;
	}

	.banner-still {
		animation: none;
	}

	.popup {
		animation: popup-rise 1200ms ease-out forwards;
	}

	.popup-still {
		animation: none;
	}

	.hurt {
		animation: hurt 420ms ease-out forwards;
	}

	@keyframes shake {
		from {
			transform: translate(calc(var(--shake) * -1), calc(var(--shake) * 0.4)) rotate(-0.4deg);
		}
		to {
			transform: translate(var(--shake), calc(var(--shake) * -0.4)) rotate(0.4deg);
		}
	}

	@keyframes loom {
		from {
			transform: translateY(30%) scale(0.6);
		}
		to {
			transform: translateY(0) scale(1.08);
		}
	}

	@keyframes siren {
		from {
			opacity: calc(var(--glow) * 0.25);
		}
		to {
			opacity: var(--glow);
		}
	}

	@keyframes banner-in {
		from {
			transform: translateY(-120%);
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes popup-rise {
		from {
			opacity: 1;
			transform: translateY(8px);
		}
		to {
			opacity: 0;
			transform: translateY(-28px);
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
		.hurt {
			animation-duration: 1ms;
		}
	}
</style>
