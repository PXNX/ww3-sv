<!--
	Game-over screen shared by every mode (requirements Section 10): final score, a random cameo
	portrait with its matching message, the mascot's "sunk" pose, and a Try Again button.
	On a new personal best it adds confetti and a Share button.
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
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { ScoreCard } from '#lib/services/share.js';
	import {
		CAMEO_PLACEHOLDER,
		cameoFlag,
		cameoPortrait,
		pickCameo,
		pickCameoMessage,
		type Cameo,
		type CameoOverride
	} from '#lib/theme/cameos.js';
	import { CHARACTER_NAME } from '#lib/theme/character.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import CharacterMascot from './CharacterMascot.svelte';
	import Confetti from './Confetti.svelte';
	import ShareButton from './ShareButton.svelte';
	import IconRotate from '~icons/lucide/rotate-ccw';

	let {
		open,
		score,
		modeName,
		isNewBest = false,
		title,
		drawBoard,
		customCameo,
		onRetry,
		children
	}: {
		open: boolean;
		score: number;
		modeName: string;
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

	let dialog: HTMLDialogElement | undefined = $state();
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
				cameo = pickCameo(Math.random, lastCameo);
				cameoLine = pickCameoMessage(Math.random, cameo);
				lastCameo = cameo.id;
			}
			portraitFailed = false;
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
	oncancel={(event) => event.preventDefault()}
>
	<div
		class="sticker relative modal-box flex max-h-[92dvh] flex-col items-center gap-3 overflow-y-auto rounded-[18px_10px_16px_8px] border-3 border-ink bg-paper p-5 text-center shadow-(--shadow-hard)"
		style:--tilt="-1deg"
	>
		{#if isNewBest}
			<Confetti />
		{/if}

		<h2 id="game-over-title" class="text-3xl font-bold">{title ?? m.gameover_title()}</h2>

		<div class="flex flex-col items-center">
			<span class="text-sm font-bold uppercase">{m.gameover_final_score()}</span>
			<span class="pop-in font-display text-5xl font-bold text-tie-red tabular-nums">{score}</span>
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

		<CharacterMascot pose="sunk" class="w-24 rotate-6" />

		<div class="flex flex-wrap items-center justify-center gap-3">
			<button type="button" class="btn-chunky bg-tie-red text-lg" onclick={onRetry}>
				<IconRotate class="size-5" aria-hidden="true" />
				{m.gameover_try_again()}
			</button>
			<a href={resolve('/')} class="btn-chunky">{m.gameover_home()}</a>
		</div>

		{#if isNewBest}
			<ShareButton {modeName} {score} {drawBoard} />
		{/if}
	</div>
</dialog>
