<!--
	Result screen shared by every mode (requirements Section 10): final score, a random cameo
	portrait with its matching message, the game's character reacting to whether the player won or
	lost, and a Try Again button. On a new personal best it adds confetti and a Share button.
-->
<script lang="ts" module>
	import type { CameoId } from '#lib/theme/cameos.js';

	// Remembered across game overs so the same cameo never appears twice in a row
	let lastCameo: CameoId | undefined;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { modeById, type ModeId } from '#lib/modes/registry.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import {
		CAMEO_PLACEHOLDER,
		CAMEOS,
		cameoFlag,
		cameoPortrait,
		pickCameo,
		pickCameoMessage,
		type Cameo,
		type CameoOverride
	} from '#lib/theme/cameos.js';
	import { CHARACTER_NAME } from '#lib/theme/character.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import Confetti from './Confetti.svelte';
	import ResultCharacter from './ResultCharacter.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let {
		open,
		score,
		mode,
		modeName,
		outcome = 'lost',
		withCharacter = true,
		isNewBest = false,
		title,
		drawBoard,
		customCameo,
		onRetry,
		children
	}: {
		open: boolean;
		score: number;
		/** Picks the character that reacts: the first leader the mode features */
		mode: ModeId;
		modeName: string;
		/** Whether the player won or lost, which decides how the character reacts */
		outcome?: 'won' | 'lost';
		/** Turn off when the mode's own cameo already is that character */
		withCharacter?: boolean;
		isNewBest?: boolean;
		/** Defaults to "Game over" */
		title?: string;
		drawBoard?: ScoreCard['drawBoard'];
		/**
		 * Image slot: a mode-specific cameo (image from static/assets/cameos/, alt text and message)
		 * shown instead of the random one; null hides the cameo. Omit it for the shared roster.
		 */
		customCameo?: CameoOverride | null;
		onRetry: () => void;
		/** Mode-specific extra stats, shown under the score */
		children?: Snippet;
	} = $props();

	const isCameoId = (id: string | undefined): id is CameoId =>
		CAMEOS.some((candidate) => candidate.id === id);

	// How much of the sheet stays on screen when it is slid away to show the board underneath
	const PEEK_VISIBLE = 56;

	let dialog: HTMLDialogElement | undefined = $state();
	let box: HTMLDivElement | undefined = $state();
	// Slid down so the board shows; the handle stays reachable to bring the sheet back
	let peeked = $state(false);
	// Pixels the sheet is pulled down while a finger or mouse is dragging the handle
	let dragOffset: number | null = $state(null);
	let dragStartY = 0;
	let dragStartOffset = 0;
	let dragMoved = false;

	const peekDistance = () => Math.max(0, (box?.offsetHeight ?? 0) - PEEK_VISIBLE);
	const offset = $derived(dragOffset ?? (peeked ? peekDistance() : 0));
	// The dim backdrop fades out as the sheet slides away
	const backdropAlpha = $derived(0.4 * (1 - offset / Math.max(1, peekDistance())));

	function startDrag(event: PointerEvent) {
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		dragStartY = event.clientY;
		dragStartOffset = offset;
		dragMoved = false;
		dragOffset = offset;
	}

	function moveDrag(event: PointerEvent) {
		if (dragOffset === null) return;
		const delta = event.clientY - dragStartY;
		if (Math.abs(delta) > 4) dragMoved = true;
		dragOffset = Math.min(peekDistance(), Math.max(0, dragStartOffset + delta));
	}

	function endDrag() {
		if (dragOffset === null) return;
		// A plain tap is left to the click handler; a drag settles on whichever end is nearer
		if (dragMoved) peeked = dragOffset > peekDistance() / 2;
		dragOffset = null;
	}

	function togglePeek() {
		if (dragMoved) {
			dragMoved = false;
			return;
		}
		peeked = !peeked;
	}
	let cameo: Cameo | undefined = $state();
	let cameoLine = $state(0);
	let portraitFailed = $state(false);

	const portrait = $derived(
		customCameo
			? portraitFailed
				? CAMEO_PLACEHOLDER
				: customCameo.image
			: cameo && !portraitFailed
				? cameoPortrait(cameo.id)
				: CAMEO_PLACEHOLDER
	);
	const showCameo = $derived(customCameo ? true : customCameo === undefined && cameo !== undefined);
	const cameoAlt = $derived(
		portrait === CAMEO_PLACEHOLDER
			? m.cameo_placeholder_alt()
			: customCameo
				? customCameo.alt
				: m.cameo_portrait_alt({ name: cameo?.name() ?? '' })
	);
	const flag = $derived(customCameo ? customCameo.flag : cameo ? cameoFlag(cameo.id) : undefined);
	const cameoLabel = $derived(customCameo?.label ?? m.gameover_cameo_label());
	const cameoMessage = $derived(
		customCameo
			? customCameo.message
			: (cameo?.messages[cameoLine]({ characterName: CHARACTER_NAME[getLocale()] }) ?? '')
	);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			if (customCameo === undefined) {
				// The host already fills the character slot, so the roster pick is someone else
				const host = modeById(mode).leaders[0];
				const taken = withCharacter && isCameoId(host) ? [host] : [];
				cameo = pickCameo(Math.random, lastCameo, taken);
				cameoLine = pickCameoMessage(Math.random, cameo);
				lastCameo = cameo.id;
			}
			portraitFailed = false;
			peeked = false;
			dragOffset = null;
			dialog.showModal();
			soundManager().play(isNewBest ? 'new-best' : 'game-over');
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby="game-over-title"
	style:background-color={offset > 0 ? `oklch(0% 0 0 / ${backdropAlpha})` : undefined}
	oncancel={(event) => event.preventDefault()}
>
	<div
		bind:this={box}
		style:translate={offset > 0 ? `0 ${offset}px` : undefined}
		style:transition={dragOffset === null ? undefined : 'none'}
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 text-center shadow-(--shadow-hard)"
		style:--tilt="-1deg"
	>
		<button
			type="button"
			class="-mt-3 flex h-8 w-full shrink-0 cursor-grab touch-none items-center justify-center border-0 bg-transparent p-0 active:cursor-grabbing"
			aria-label={peeked ? m.gameover_peek_show() : m.gameover_peek_hide()}
			aria-expanded={!peeked}
			onpointerdown={startDrag}
			onpointermove={moveDrag}
			onpointerup={endDrag}
			onpointercancel={endDrag}
			onclick={togglePeek}
		>
			<span class="h-1.5 w-14 rounded-full bg-ink/40"></span>
		</button>

		<div class="flex w-full flex-col items-center gap-3" inert={peeked}>
			{#if isNewBest}
				<Confetti />
			{/if}

			<h2 id="game-over-title" class="text-3xl font-bold">{title ?? m.gameover_title()}</h2>

			<div class="flex flex-col items-center">
				<span class="text-sm font-bold uppercase">{m.gameover_final_score()}</span>
				<span class="pop-in font-display text-5xl font-bold text-tie-red tabular-nums">{score}</span
				>
				{#if isNewBest}
					<span
						class="pop-in mt-1 rotate-2 rounded-md border-2 border-ink bg-explosion-yellow px-2 font-bold"
					>
						{m.gameover_new_best()}
					</span>
				{/if}
			</div>

			{#if children}
				<div class="w-full">{@render children()}</div>
			{/if}

			{#if showCameo}
				<figure
					class="flex w-full items-center gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-sand p-3 text-start"
				>
					<img
						src={portrait}
						alt={cameoAlt}
						class="size-20 shrink-0 -rotate-2 rounded-lg border-3 border-ink bg-paper object-cover"
						style:background={flag ? `url(${flag}) center / 100% 100%` : undefined}
						onerror={() => (portraitFailed = true)}
					/>
					<figcaption class="flex flex-col gap-1">
						<span class="text-xs font-bold uppercase">{cameoLabel}</span>
						<span class="leading-snug">{cameoMessage}</span>
					</figcaption>
				</figure>
			{/if}

			{#if withCharacter && open}
				<ResultCharacter {mode} {outcome} class="w-24" />
			{/if}

			<div class="flex flex-wrap items-center justify-center gap-3">
				<!-- Focus lands on the main action, not on the drag handle above it -->
				<!-- svelte-ignore a11y_autofocus -->
				<button
					type="button"
					class="btn-chunky bg-tie-red text-lg focus-visible:outline-none"
					autofocus
					onclick={onRetry}
				>
					<IconRotate class="size-5" aria-hidden="true" />
					{m.gameover_try_again()}
				</button>
				<a href={resolve('/')} class="btn-chunky">{m.gameover_home()}</a>
			</div>

			{#if isNewBest}
				<ShareButton {modeName} {score} {drawBoard} />
			{/if}
		</div>
	</div>
</dialog>
