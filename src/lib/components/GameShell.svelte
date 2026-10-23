<!--
	Shared frame for every game page: a back link to the start screen and a slate header banner
	with the mode name and the current score. The game itself goes in the default slot. While a
	game is running (`confirmLeave`) the back link asks once more before throwing it away, and
	whatever sound is still playing stops when the page is left. Immersive games fill the whole
	viewport instead: the controls and a small score badge float above the playfield, and the
	`--hud-top` variable tells the game how far down its own overlays start to stay clear of them.
	Landscape games also go full screen on phones while immersive, hiding the browser bars.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { enterLandscape, leaveLandscape } from '#lib/game/landscape.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import SoundToggle from './SoundToggle.svelte';
	import IconArrowLeft from '~icons/lucide/arrow-left';

	let {
		title,
		score,
		best,
		actions,
		confirmLeave = false,
		wide = false,
		immersive = false,
		landscape = false,
		children
	}: {
		title: string;
		score?: number;
		best?: number | null;
		/** Extra header controls, such as a pause button */
		actions?: Snippet;
		/** True while a game is in progress: the back link then needs a second tap to leave */
		confirmLeave?: boolean;
		/** Landscape games: use the full width and drop the banner on short (sideways phone) screens */
		wide?: boolean;
		/** The game fills the whole viewport; the back link and the actions float on top of it */
		immersive?: boolean;
		/** Played sideways: while immersive, phones go full screen and lock to landscape */
		landscape?: boolean;
		children: Snippet;
	} = $props();

	const CONFIRM_MS = 3000;
	let confirmingLeave = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(confirmTimer));

	// A running game is only left on the second tap within a few seconds
	function onBack(event: MouseEvent) {
		if (!confirmLeave || confirmingLeave) return;
		event.preventDefault();
		confirmingLeave = true;
		clearTimeout(confirmTimer);
		confirmTimer = setTimeout(() => (confirmingLeave = false), CONFIRM_MS);
	}

	$effect(() => {
		if (!confirmLeave) confirmingLeave = false;
	});

	// Runs right after the tap that started the game, which still counts as the gesture that full
	// screen needs
	$effect(() => {
		if (!immersive || !landscape) return;
		void enterLandscape();
		return () => leaveLandscape();
	});

	// Nothing a game started (a voice line, a long explosion) keeps sounding on the next page
	$effect(() => () => soundManager().stopAll());
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main
	class={immersive
		? 'fixed inset-0 overflow-hidden [--hud-top:calc(3.25rem+env(safe-area-inset-top))]'
		: `mx-auto flex h-dvh ${wide ? 'max-w-none' : 'max-w-3xl'} flex-col gap-2 overflow-hidden px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] [--hud-top:0.5rem] sm:gap-3 sm:px-3 sm:pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]`}
>
	<div
		class={immersive
			? 'pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 ps-[calc(0.5rem+env(safe-area-inset-left))] pe-[calc(0.5rem+env(safe-area-inset-right))] pt-[calc(0.5rem+env(safe-area-inset-top))] *:pointer-events-auto'
			: 'flex items-center justify-between gap-2'}
	>
		<div class="flex items-center gap-2">
			<a
				href={resolve('/')}
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				class:bg-explosion-yellow={confirmingLeave}
				aria-label={confirmingLeave ? m.game_back_confirm() : m.game_back()}
				onclick={onBack}
			>
				<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
				<span class={confirmingLeave ? '' : 'hidden sm:inline'}>
					{confirmingLeave ? m.game_back_confirm() : m.game_back()}
				</span>
			</a>
			{#if immersive && score !== undefined}
				<div
					class="flex items-baseline gap-2 rounded-[10px_6px_12px_8px] border-3 border-ink bg-banner-slate px-2 py-1 font-display leading-none font-bold text-paper shadow-[3px_3px_0_var(--color-ink)]"
				>
					<span class="sr-only">{m.game_score()}</span>
					{#key score}
						<span class="pop-in text-lg tabular-nums">{score}</span>
					{/key}
					{#if best}
						<span class="text-xs opacity-90">{m.game_best()}: {best}</span>
					{/if}
				</div>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{@render actions?.()}
			<SoundToggle />
		</div>
	</div>

	{#if immersive}
		<h1 class="sr-only">{title}</h1>
	{:else}
		<header
			class="{wide
				? '[@media(max-height:520px)]:hidden'
				: ''} flex items-center justify-between gap-3 rounded-[14px_8px_16px_10px] border-3 border-ink bg-banner-slate px-3 py-1.5 text-paper shadow-[4px_4px_0_var(--color-ink)] sm:px-4 sm:py-2"
		>
			<h1 class="text-xl leading-tight font-bold sm:text-2xl lg:text-3xl">{title}</h1>
			{#if score !== undefined}
				<div class="flex flex-col items-end font-display leading-none">
					<span class="text-xs font-bold tracking-wide uppercase opacity-90">{m.game_score()}</span>
					{#key score}
						<span class="pop-in text-3xl font-bold tabular-nums">{score}</span>
					{/key}
					{#if best}
						<span class="text-xs font-bold opacity-90">{m.game_best()}: {best}</span>
					{/if}
				</div>
			{/if}
		</header>
	{/if}

	<div
		class={immersive
			? 'absolute inset-0 flex flex-col overflow-hidden'
			: 'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto sm:gap-3'}
	>
		{@render children()}
	</div>
</main>
