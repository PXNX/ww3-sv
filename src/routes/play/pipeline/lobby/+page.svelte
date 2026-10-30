<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { PipelineGame } from '#lib/stores/pipelineGame.svelte.js';
	import GameShell from '#lib/components/GameShell.svelte';
	import PipelineDifficultyPicker from '#lib/components/PipelineDifficultyPicker.svelte';

	const game = new PipelineGame();

	function pick(level: string) {
		game.setDifficulty(level as any);
		goto('/play/pipeline');
	}

	function start() {
		goto('/play/pipeline');
	}

	let showedTutorial = $state(false);
	onMount(() => {
		showedTutorial = firstPlay('pipeline');
	});
</script>

<GameShell title={m.mode_pipeline_name()} back={false}>
	<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-2 py-2">
		{#if showedTutorial}
			<p class="text-sm leading-snug opacity-80">{m.pipeline_controls_hint()}</p>
		{/if}

		<h2 class="text-2xl font-bold">{m.pipeline_difficulty_label()}</h2>
		<PipelineDifficultyPicker selected={game.difficulty} onpick={pick} />


	</div>
</GameShell>
