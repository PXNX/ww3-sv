<!--
	Shared frame for every game page: a back link to the start screen and a slate header banner
	with the mode name and the current score. The game itself goes in the default slot. While a
	game is running (`confirmLeave`) the back link asks once more before throwing it away, unless
	the page passes `onQuit`: then the back link ends the run as a loss, showing the game over
	screen the game already has. Whatever sound is still playing stops when the page is left. Immersive games fill the whole
	viewport instead: the controls and a small score badge float above the playfield, and the
	`--hud-top` variable tells the game how far down its own overlays start to stay clear of them;
	`--hud-left` and `--hud-right` keep overlays along the top edge clear of the corners, where
	Telegram's full screen puts its own buttons. Landscape games also go full screen on phones while immersive, hiding the browser bars.
	A `compact` page puts the back link and the actions into the banner, one row instead of two, for
	games whose board needs the height; `back={false}` drops the back link, for a game opened from a
	chat's game message that has nowhere to go back to.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { enterLandscape, leaveLandscape } from '#lib/game/landscape.js';
	import { m } from '#lib/paraglide/messages.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';

	let {
		title,
		score,
		best,
		actions,
		confirmLeave = false,
		onQuit,
		wide = false,
		immersive = false,
		landscape = false,
		compact = false,
		back = true,
		children
	}: {
		title: string;
		score?: number;
		best?: number | null;
		/** Extra header controls, such as a pause button */
		actions?: Snippet;
		/** True while a game is in progress: the back link then needs a second tap to leave */
		confirmLeave?: boolean;
		/** Ends the running game as a loss instead of leaving the page */
		onQuit?: () => void;
		/** Landscape games: use the full width and drop the banner on short (sideways phone) screens */
		wide?: boolean;
		/** The game fills the whole viewport; the back link and the actions float on top of it */
		immersive?: boolean;
		/** Played sideways: while immersive, phones go full screen and lock to landscape */
		landscape?: boolean;
		/** Not immersive: the back link and the actions sit in a slimmer banner instead of a row above it */
		compact?: boolean;
		/** Shows the back link to the start screen */
		back?: boolean;
		children: Snippet;
	} = $props();

	const CONFIRM_MS = 3000;
	let confirmingLeave = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(confirmTimer));

	// A page that can end its own run takes over the back link while that run is going
	const quit = $derived(confirmLeave ? onQuit : undefined);

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

{#snippet backLink()}
	{#if back}
		{#if quit}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={m.game_back()}
				onclick={quit}
			>
				<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
				<span class="hidden sm:inline">{m.game_back()}</span>
			</button>
		{:else}
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
		{/if}
	{/if}
{/snippet}

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main
	class={immersive
		? 'fixed inset-0 overflow-hidden [--hud-left:calc(0.5rem+var(--top-left-inset))] [--hud-right:calc(0.5rem+var(--top-right-inset))] [--hud-top:calc(3.25rem+var(--top-inset))]'
		: `mx-auto flex h-dvh ${wide ? 'max-w-none' : 'max-w-3xl'} flex-col gap-2 overflow-hidden px-2 pt-[calc(0.5rem+var(--top-inset))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] [--hud-left:0.5rem] [--hud-right:0.5rem] [--hud-top:0.5rem] sm:gap-3 sm:px-3 sm:pt-[calc(0.75rem+var(--top-inset))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]`}
>
	<!-- Without a back link or actions the row above the banner would only be empty space -->
	{#if immersive || (!compact && (back || actions))}
		<div
			class={immersive
				? 'pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 pt-[calc(0.5rem+var(--top-inset))] pr-(--hud-right) pl-(--hud-left) *:pointer-events-auto'
				: 'flex items-center justify-between gap-2 pr-(--top-right-inset) pl-(--top-left-inset)'}
		>
			<div class="flex items-center gap-2">
				{@render backLink()}
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
			</div>
		</div>
	{/if}

	{#if immersive}
		<h1 class="sr-only">{title}</h1>
	{:else if compact}
		<header
			class="ms-(--top-left-inset) me-(--top-right-inset) flex items-center gap-2 rounded-[14px_8px_16px_10px] border-3 border-ink bg-banner-slate py-1 ps-1.5 pe-3 text-paper shadow-[4px_4px_0_var(--color-ink)] sm:gap-3 sm:py-1.5 sm:ps-2 sm:pe-4"
		>
			{@render backLink()}
			<h1
				class="min-w-0 flex-1 truncate text-lg leading-tight font-bold sm:text-2xl {back
					? ''
					: 'ps-1.5'}"
			>
				{title}
			</h1>
			{@render actions?.()}
			{#if score !== undefined}
				<div class="flex items-baseline gap-2 font-display leading-none">
					{#if best}
						<span class="text-xs font-bold opacity-90">{m.game_best()}: {best}</span>
					{/if}
					<span class="sr-only">{m.game_score()}</span>
					{#key score}
						<span class="pop-in text-2xl font-bold tabular-nums sm:text-3xl">{score}</span>
					{/key}
				</div>
			{/if}
		</header>
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
