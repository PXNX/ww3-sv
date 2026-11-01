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
	import CurlingCanvas from '#lib/components/CurlingCanvas.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { CurlingGame } from '#lib/stores/curlingGame.svelte.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new CurlingGame({ reducedMotion: prefersReducedMotion() });
	const modeName = 'Iceberg Curling';

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		showTutorial = firstPlay('curling');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const cameo = {
		image: '??',
		alt: '',
		message: '',
		label: ''
	};
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
				aria-label="Help"
				onclick={openHelp}
			>
				<IconHelp class="size-4" aria-hidden="true" />
			</button>
		{/if}
	{/snippet}

	<CurlingCanvas {game} />

	{#if showTutorial}
		<TutorialModal
			open={showTutorial}
			title="Iceberg Curling"
			closeLabel="Got it"
			onclose={() => (showTutorial = false)}
		>
			<p>Drag back to aim and set power. Release to throw the stone.</p>
			<p>Hold SWEEP while sliding to reduce friction and control curl.</p>
			<p>Knock blocks into the house across 8 ends to score stars.</p>
		</TutorialModal>
	{/if}
</GameShell>