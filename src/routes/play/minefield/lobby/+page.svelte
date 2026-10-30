<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import type { DifficultyId } from '#lib/game/minefield/difficulty.js';
	import { MinefieldGame } from '#lib/stores/minefieldGame.svelte.js';
	import GameShell from '#lib/components/GameShell.svelte';
	import MinefieldDifficultyPicker from '#lib/components/MinefieldDifficultyPicker.svelte';

	const game = new MinefieldGame();

	function pick(id: DifficultyId) {
		game.newGame(id);
		goto(resolve('/play/minefield'));
	}

	let showedTutorial = $state(false);
	onMount(() => {
		showedTutorial = firstPlay('minefield');
	});
</script>

<GameShell title={m.mode_minefield_name()} back={false}>
	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-2 py-2">
		{#if showedTutorial}
			<p class="text-sm leading-snug opacity-80">{m.minefield_help()}</p>
		{/if}

		<MinefieldDifficultyPicker selected={game.difficultyId} onpick={pick} />
	</div>
</GameShell>
