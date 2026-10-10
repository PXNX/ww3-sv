<!--
	Centrifuge Spin: "Nothing Ever Happens" (roadmap 3.7). A calm face sits next to a spinning dial.
	Sirens, BREAKING banners, screen shake and a looming Something try to make you press the button,
	but the only right moment is when the needle really leaves the safe band. Reacting to a fake scare
	or missing a real drift costs a heart.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import CentrifugeField from '#lib/components/CentrifugeField.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { STARTING_LIVES } from '#lib/game/centrifuge/config.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { CentrifugeGame } from '#lib/stores/centrifugeGame.svelte.js';
	import { cameoAsset } from '#lib/theme/cameos.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';

	const game = new CentrifugeGame({ reducedMotion: prefersReducedMotion() });
	const modeName = m.mode_centrifuge_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.loadBest();
		showTutorial = firstPlay('centrifuge');
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const cameo = $derived({
		image: cameoAsset('centrifuge-calm.svg'),
		alt: m.centrifuge_cameo_alt(),
		message: m.centrifuge_cameo_message(),
		label: m.centrifuge_cameo_label()
	});
</script>

<GameShell
	title={modeName}
	score={game.score}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.centrifuge_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.centrifuge_help_button()}</span>
		</button>
		{#if game.status === 'playing' || game.status === 'paused'}
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => game.togglePause()}>
				{#if game.status === 'paused'}
					<IconPlay class="size-4" aria-hidden="true" />
					{m.game_resume()}
				{:else}
					<IconPause class="size-4" aria-hidden="true" />
					{m.game_pause()}
				{/if}
			</button>
		{/if}
	{/snippet}

	<section class="mx-auto flex w-full max-w-md flex-col items-center gap-2">
		<div
			class="flex w-full items-center justify-between gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p dir="auto" class="font-display text-base font-bold tabular-nums sm:text-lg">
				{m.centrifuge_hud_streak({ streak: game.streak, multiplier: game.multiplier })}
			</p>
			<LivesBar lives={game.lives} max={STARTING_LIVES} class="shrink-0 text-xl" />
		</div>

		<CentrifugeField {game} />
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.centrifuge_tutorial_title()}
		closeLabel={m.centrifuge_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.centrifuge_tutorial_goal()}</p>
		<p>{m.centrifuge_tutorial_dial()}</p>
		<p>{m.centrifuge_tutorial_scares()}</p>
		<p>{m.centrifuge_tutorial_fix()}</p>
		<p>{m.centrifuge_tutorial_score()}</p>
		<p class="hidden text-sm sm:block">{m.centrifuge_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={game.status === 'over'}
		score={game.score}
		{modeName}
		isNewBest={game.isNewBest}
		title={m.centrifuge_gameover_title()}
		customCameo={cameo}
		onRetry={() => game.start()}
	>
		<dl class="grid grid-cols-2 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.centrifuge_stat_calm()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.calmScares}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.centrifuge_stat_fixes()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.fixes}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.centrifuge_stat_overreactions()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.overreactions}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.centrifuge_stat_meltdowns()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.meltdowns}</dd>
			</div>
			<div class="col-span-2 flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.centrifuge_stat_streak()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{game.bestStreak}</dd>
			</div>
		</dl>
	</GameOverModal>
</GameShell>
