<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { MazeGame } from '#lib/stores/mazeGame.svelte.js';
	import GameShell from '#lib/components/GameShell.svelte';
	import MazeSizePicker from '#lib/components/MazeSizePicker.svelte';

	const game = new MazeGame();

	function pick() {
		goto('/play/maze');
	}

	function start() {
		goto('/play/maze');
	}

	let showedTutorial = $state(false);
	onMount(() => { showedTutorial = firstPlay('maze'); });
</script>

<GameShell title={m.mode_maze_name()} back={false}>
	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-2 py-2">
		{#if showedTutorial}
			<p class="text-sm leading-snug opacity-80">{m.maze_controls_hint()}</p>
		{/if}

		<MazeSizePicker {game} />

		<div class="flex justify-end">
			<button type="button" class="btn-chunky px-4 py-1 text-lg" onclick={start}>Start</button>
		</div>
	</div>
</GameShell>
