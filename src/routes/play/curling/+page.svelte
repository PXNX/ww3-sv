<!--
	Iceberg Curling playfield: canvas-based stone physics with sweep controls.
	Aim by dragging back to set power and angle, release to throw the iceberg.
	Sweep to reduce friction and control curl.
	8 ends with stars; seals and a lost penguin are obstacles.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import CurlingCanvas from '#lib/components/CurlingCanvas.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { m } from '#lib/paraglide/messages.js';
	import { CurlingGame } from '#lib/stores/curlingGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new CurlingGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_curling_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('curling');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const cameo = $derived({
		image: cameoAsset('snowflake.svg'),
		alt: m.cameo_placeholder_alt(),
		message: m.cameo_placeholder_message(),
		label: m.cameo_placeholder_label()
	});
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.cState !== 'aiming'}
	onQuit={() => game.forfeit()}
>
	{#snippet actions()}
		{#if game.cState !== 'over'}
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm sm:px-3"
				aria-label={m.game_help()}
				onclick={openHelp}
			>
				<IconHelp class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">{m.game_help()}</span>
			</button>
		{/if}
	{/snippet}

	<CurlingCanvas {game} />

	{#if showTutorial}
		<TutorialModal />
	{/if}
</GameShell>