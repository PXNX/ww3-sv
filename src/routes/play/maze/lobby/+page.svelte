<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { MazeGame } from '#lib/stores/mazeGame.svelte.js';
	import GameShell from '#lib/components/GameShell.svelte';
	import MazeSizePicker from '#lib/components/MazeSizePicker.svelte';

	const game = new MazeGame();

	function pick(size: string) {
		game.start(size as any);
		goto('/play/maze');
	}

	function start() {
		goto('/play/maze');
	}

	let showedTutorial = $state(false);
	onMount(() => {
		showedTutorial = firstPlay('maze');
		const interval = setInterval(() => {
			if (game.screen === 'play') goto('/play/maze');
		}, 150);
		return () => clearInterval(interval);
	});
</script>

<GameShell title={m.mode_maze_name()} back={false}>
	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-2 py-2">
		{#if showedTutorial}
			<p class="text-sm leading-snug opacity-80">{m.maze_keyboard_hint()}</p>
		{/if}

		<MazeSizePicker {game} />


	</div>
</GameShell>
