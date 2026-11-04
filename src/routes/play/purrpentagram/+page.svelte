<script lang="ts">
	import '@fontsource/cinzel-decorative/latin-400.css';
	import '@fontsource/cinzel-decorative/latin-700.css';
	import '@fontsource/kurale/cyrillic-400.css';
	import '@fontsource/aref-ruqaa/arabic-400.css';
	import '@fontsource/aref-ruqaa/arabic-700.css';
	import '#lib/styles/riddle.css';
	import { onMount } from 'svelte';
	import { haptic } from '#lib/haptic/haptic.svelte.js';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import LivesBar from '#lib/components/LivesBar.svelte';
	import PurrFinalePanel from '#lib/components/PurrFinalePanel.svelte';
	import PurrPentagramBoard from '#lib/components/PurrPentagramBoard.svelte';
	import PurrRiddleCard from '#lib/components/PurrRiddleCard.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { litCount } from '#lib/game/purrpentagram/candles.js';
	import { finaleStage } from '#lib/game/purrpentagram/finale.js';
	import { totalHearts } from '#lib/game/purrpentagram/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import { eventText } from '#lib/theme/purrText.js';
	import { PurrPentagramGame, type NoticeKind } from '#lib/stores/purrPentagramGame.svelte.js';
	import IconCandle from '~icons/lucide/flame';
	import IconDim from '~icons/lucide/moon';
	import IconDoor from '~icons/lucide/door-open';
	import IconDraft from '~icons/lucide/wind';
	import IconHelp from '~icons/lucide/circle-help';
	import IconLaser from '~icons/lucide/target';
	import IconPause from '~icons/lucide/pause';
	import IconPlay from '~icons/lucide/play';
	import IconCookie from '~icons/lucide/cookie';
	import IconStar from '~icons/lucide/star';
	import IconThunder from '~icons/lucide/cloud-lightning';

	const game = new PurrPentagramGame();
	const modeName = m.mode_purrpentagram_name();

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		game.load();
		showTutorial = firstPlay('purrpentagram');
		return () => game.dispose();
	});

	function openHelp() {
		game.pause();
		showTutorial = true;
	}

	const ritual = $derived(game.state);
	const banner = $derived(
		game.status === 'won' ? finaleStage(ritual.finaleMs, game.reducedMotion).banner : 0
	);

	const won = $derived(game.status === 'won');
	// The result sheet slides up once the star has burned and the banner is in
	const sheetOpen = $derived(game.status === 'over' || (won && banner > 0));

	const NOTICES: Record<NoticeKind, () => string> = {
		mistake: m.purr_notice_mistake,
		'not-ready': m.purr_notice_not_ready,
		'out-of-turn': m.purr_notice_out_of_turn,
		'no-treats': m.purr_notice_no_treats,
		'candle-spent': m.purr_notice_candle_spent
	};

	// The stars on the result sheet pop in one after another, each with a rising ping
	let shownStars = $state(0);
	$effect(() => {
		if (!sheetOpen || !won) {
			shownStars = 0;
			return;
		}
		const wanted = game.stars;
		const timers: ReturnType<typeof setTimeout>[] = [];
		for (let i = 1; i <= wanted; i++) {
			timers.push(
				setTimeout(
					() => {
						shownStars = i;
						soundManager().play('star-earn', i / 3);
						haptic().play(0.2 + i * 0.15);
					},
					game.reducedMotion ? 0 : 350 * i
				)
			);
		}
		return () => timers.forEach(clearTimeout);
	});
</script>

<GameShell
	title={modeName}
	score={game.status === 'won' ? game.score : undefined}
	best={game.best}
	confirmLeave={game.status === 'playing' || game.status === 'paused'}
	onQuit={() => game.forfeit()}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.purr_help_button()}
			onclick={openHelp}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.purr_help_button()}</span>
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

	<section class="mx-auto flex w-full max-w-xl flex-col gap-2 pb-2">
		<div
			class="flex w-full items-center justify-between gap-3 rounded-[12px_6px_14px_8px] border-3 border-ink bg-paper px-3 py-1 shadow-[3px_3px_0_var(--color-ink)]"
		>
			<p dir="auto" class="min-h-8 flex-1 text-sm leading-tight font-bold" role="status">
				{#if game.notice}
					{#key game.notice.id}
						<span class="pop-in inline-block">{NOTICES[game.notice.kind]()}</span>
					{/key}
				{:else if ritual.omen && game.status === 'playing'}
					{#key ritual.omen.kind}
						<span class="pop-in inline-block text-tie-red">
							{m.purr_omen({ event: eventText(ritual.omen.kind) })}
						</span>
					{/key}
				{:else if ritual.event && game.status === 'playing'}
					{#key ritual.event.kind}
						<span class="pop-in inline-block italic">{eventText(ritual.event.kind)}</span>
					{/key}
				{:else}
					<span class="opacity-70">{m.purr_hud_hint()}</span>
				{/if}
			</p>
			<div class="flex shrink-0 items-center gap-2">
				{#if ritual.combo > 1}
					{#key ritual.combo}
						<span class="pop-in rounded-md border-2 border-ink bg-sand px-1.5 text-xs font-bold">
							{m.purr_combo({ count: ritual.combo })}
						</span>
					{/key}
				{/if}
				<LivesBar lives={game.lives} max={ritual.maxLives} class="text-xl" />
			</div>
		</div>

		{#if game.status === 'playing' || game.status === 'paused'}
			<div class="flex items-center justify-between gap-2">
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm {game.treatArmed ? 'bg-tie-red' : ''}"
					aria-pressed={game.treatArmed}
					disabled={ritual.treats <= 0 && !game.treatArmed}
					onclick={() => game.toggleTreat()}
				>
					<IconCookie class="size-4" aria-hidden="true" />
					{m.purr_treat_button({ count: ritual.treats })}
				</button>
				<p dir="auto" class="flex-1 text-end text-xs font-semibold opacity-80" aria-live="polite">
					{#if game.treatArmed}{m.purr_treat_armed()}{/if}
				</p>
				<span class="flex items-center gap-1 text-sm font-bold" aria-hidden="true">
					<IconCandle class="size-4" />{litCount(ritual.candles)}
				</span>
			</div>
		{/if}

		<PurrRiddleCard
			riddle={ritual.riddle}
			calm={game.reducedMotion}
			joined={ritual.chain.length}
			closed={ritual.closed}
		/>

		<PurrPentagramBoard {game}>
			<PurrFinalePanel {banner} calm={game.reducedMotion} />
		</PurrPentagramBoard>
	</section>

	<TutorialModal
		open={showTutorial}
		title={m.purr_tutorial_title()}
		closeLabel={m.purr_tutorial_close()}
		onclose={() => (showTutorial = false)}
	>
		<p>{m.purr_tutorial_goal()}</p>
		<p>{m.purr_tutorial_petting()}</p>
		<p>{m.purr_tutorial_clues()}</p>
		<p>{m.purr_tutorial_star()}</p>
		<p>{m.purr_tutorial_room()}</p>
		<ul class="flex flex-col gap-1.5 text-sm">
			<li class="flex items-center gap-2">
				<IconCandle class="size-5 shrink-0" aria-hidden="true" />{m.purr_event_candles()}
			</li>
			<li class="flex items-center gap-2">
				<IconDim class="size-5 shrink-0" aria-hidden="true" />{m.purr_event_dim()}
			</li>
			<li class="flex items-center gap-2">
				<IconDraft class="size-5 shrink-0" aria-hidden="true" />{m.purr_event_draft()}
			</li>
			<li class="flex items-center gap-2">
				<IconThunder class="size-5 shrink-0" aria-hidden="true" />{m.purr_event_thunder()}
			</li>
			<li class="flex items-center gap-2">
				<IconLaser class="size-5 shrink-0" aria-hidden="true" />{m.purr_event_laser()}
			</li>
			<li class="flex items-center gap-2">
				<IconDoor class="size-5 shrink-0" aria-hidden="true" />{m.purr_event_creak()}
			</li>
		</ul>
		<p>{m.purr_tutorial_calm()}</p>
		<p>{m.purr_tutorial_candles()}</p>
		<p>{m.purr_tutorial_extras()}</p>
		<p class="hidden text-sm sm:block">{m.purr_keyboard_hint()}</p>
	</TutorialModal>

	<GameOverModal
		open={sheetOpen}
		score={game.score}
		mode="purrpentagram"
		{modeName}
		outcome={won ? 'won' : 'lost'}
		isNewBest={won && game.isNewBest}
		title={won ? m.purr_ritual_complete() : m.purr_gameover_title()}
		onRetry={() => game.start()}
	>
		{#if won}
			<p dir="auto" class="riddle-font mb-3 text-sm leading-snug">{m.purr_win_subtitle()}</p>
		{/if}
		{#if won}
			<div
				class="mb-3 flex items-center justify-center gap-2"
				role="img"
				aria-label={m.purr_stars_label({ count: game.stars })}
			>
				{#each [1, 2, 3] as n (n)}
					<IconStar
						class="size-10 transition-transform duration-300 {n <= shownStars
							? 'scale-100 fill-warning text-ink'
							: 'scale-75 text-ink/30'}"
					/>
				{/each}
			</div>
		{/if}
		<dl class="grid grid-cols-3 gap-2 font-display text-sm">
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.purr_stat_time()}</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{m.purr_time_value({ seconds: Math.round(ritual.elapsedMs / 1000) })}
				</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.purr_stat_mistakes()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{ritual.mistakes}</dd>
			</div>
			<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
				<dt class="font-bold">{m.purr_stat_hearts()}</dt>
				<dd class="text-2xl font-bold tabular-nums">{totalHearts(ritual)}</dd>
			</div>
			{#if won}
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.purr_stat_combo()}</dt>
					<dd class="text-2xl font-bold tabular-nums">x{ritual.bestCombo}</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.purr_stat_candles()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{litCount(ritual.candles)}/5</dd>
				</div>
				<div class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2">
					<dt class="font-bold">{m.purr_stat_treats()}</dt>
					<dd class="text-2xl font-bold tabular-nums">{ritual.treatsUsed}</dd>
				</div>
			{/if}
		</dl>
	</GameOverModal>
</GameShell>
