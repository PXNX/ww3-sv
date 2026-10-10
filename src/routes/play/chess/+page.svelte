<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ChessBoard from '#lib/components/ChessBoard.svelte';
	import ChessCards from '#lib/components/ChessCards.svelte';
	import GameOverModal from '#lib/components/GameOverModal.svelte';
	import GameShell from '#lib/components/GameShell.svelte';
	import TutorialModal from '#lib/components/TutorialModal.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { firstPlay } from '#lib/services/tutorial.js';
	import { cardName, ChessGame, quipText, VANCE_CHANCE } from '#lib/stores/chessGame.svelte.js';
	import {
		CAMEO_PLACEHOLDER,
		cameoFlag,
		cameoPortrait,
		guestPortrait,
		type CameoOverride
	} from '#lib/theme/cameos.js';
	import IconHelp from '~icons/lucide/circle-help';
	import IconRotate from '~icons/lucide/rotate-ccw';

	const game = new ChessGame();
	onDestroy(() => game.destroy());

	// The how-to-play screen opens on the first visit and whenever the help button is tapped
	let showTutorial = $state(false);
	onMount(() => {
		showTutorial = firstPlay('chess');
	});

	const putinPortrait = cameoPortrait('putin');
	const putinAlt = $derived(
		putinPortrait === CAMEO_PLACEHOLDER
			? m.cameo_placeholder_alt()
			: m.cameo_portrait_alt({ name: m.cameo_putin_name() })
	);
	const putinFlag = cameoFlag('putin');
	// The player takes the white side as Zelensky
	const zelenskyPortrait = cameoPortrait('zelensky');
	const zelenskyAlt = $derived(
		zelenskyPortrait === CAMEO_PLACEHOLDER
			? m.cameo_placeholder_alt()
			: m.cameo_portrait_alt({ name: m.cameo_zelensky_name() })
	);
	const zelenskyFlag = cameoFlag('zelensky');
	const vancePortrait = guestPortrait('vance');

	// "New game" asks once more before throwing away a running game
	const CONFIRM_MS = 3000;
	let confirmingRestart = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(confirmTimer));

	function newGame() {
		clearTimeout(confirmTimer);
		if (confirmingRestart || game.moveCount === 0) {
			confirmingRestart = false;
			game.restart();
			return;
		}
		confirmingRestart = true;
		confirmTimer = setTimeout(() => (confirmingRestart = false), CONFIRM_MS);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || showTutorial) return;
		game.disarmCard();
		game.cancelPromotion();
	}

	const result = $derived(
		game.status.kind === 'checkmate' ? (game.status.winner === 'w' ? 'win' : 'loss') : 'draw'
	);
	const gameOverTitle = $derived(
		{ win: m.chess_gameover_win, loss: m.chess_gameover_loss, draw: m.chess_gameover_draw }[
			result
		]()
	);
	const putinCameo: CameoOverride = $derived({
		image: putinPortrait,
		flag: putinFlag,
		alt: putinAlt,
		message: {
			win: m.chess_gameover_putin_win,
			loss: m.chess_gameover_putin_loss,
			draw: m.chess_gameover_putin_draw
		}[result]()
	});
	const cardsLeft = $derived(game.cardSlots.filter((id) => id !== null).length);
</script>

<svelte:window onkeydown={onKeyDown} />

<GameShell
	title={m.mode_chess_name()}
	score={game.score}
	best={game.best}
	confirmLeave={!game.over && game.moveCount > 0}
>
	{#snippet actions()}
		<button
			type="button"
			class="btn-chunky px-2 py-1 text-sm sm:px-3"
			aria-label={m.chess_help_button()}
			onclick={() => (showTutorial = true)}
		>
			<IconHelp class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">{m.chess_help_button()}</span>
		</button>
		<button
			type="button"
			class="btn-chunky px-3 py-1 text-sm"
			class:bg-explosion-yellow={confirmingRestart}
			onclick={newGame}
		>
			<IconRotate class="size-4" aria-hidden="true" />
			{confirmingRestart ? m.chess_new_game_confirm() : m.chess_new_game()}
		</button>
	{/snippet}

	<!-- Everything fits the screen: the board takes whatever height the other rows leave over -->
	<div class="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-2 px-1">
		<!-- Putin comments on the game, a rookie mistake is always sold as a master plan; you play as Zelensky -->
		<div class="flex min-h-14 items-center gap-3">
			<img
				src={putinPortrait}
				alt={putinAlt}
				class="size-14 shrink-0 -rotate-2 rounded-lg border-3 border-ink bg-paper object-cover"
				style:background="url({putinFlag}) center / 100% 100%"
			/>
			<div class="flex-1" role="status" aria-live="polite">
				{#if game.thinking}
					<p class="sticker px-3 py-1.5 text-sm leading-snug font-bold" style:--tilt="1deg">
						{m.chess_putin_thinking()}
					</p>
				{:else if game.quip}
					{#key game.quip.id}
						<p
							class="sticker pop-in px-3 py-1.5 text-sm leading-snug font-bold"
							style:--tilt="1deg"
						>
							{quipText(game.quip)}
						</p>
					{/key}
				{/if}
			</div>
			<img
				src={zelenskyPortrait}
				alt={zelenskyAlt}
				class="size-14 shrink-0 rotate-2 rounded-lg border-3 border-ink bg-paper object-cover"
				style:background="url({zelenskyFlag}) center / 100% 100%"
			/>
		</div>

		<!-- A size container: the board is the biggest square that fits its width and height -->
		<div class="relative mx-auto min-h-24 w-full flex-1" style:container-type="size">
			<div class="relative mx-auto size-[min(100cqw,100cqh)]">
				<ChessBoard {game} />

				{#if game.vance !== null}
					<div
						class="absolute inset-0 z-20 flex items-center justify-center rounded-[16px_10px_18px_8px] bg-ink/50 p-2"
						role="alertdialog"
						aria-labelledby="vance-title"
					>
						<div
							class="sticker pop-in flex flex-col items-center gap-1.5 p-3 text-center"
							style:--tilt="2deg"
						>
							<img
								src={vancePortrait}
								alt={vancePortrait === CAMEO_PLACEHOLDER
									? m.cameo_placeholder_alt()
									: m.cameo_portrait_alt({ name: m.chess_vance_name() })}
								class="size-14 rotate-2 rounded-lg border-3 border-ink bg-paper object-cover"
							/>
							<h2 id="vance-title" class="text-xl font-bold">{m.chess_vance_title()}</h2>
							<p class="text-sm leading-snug">
								{m.chess_vance_message({ card: cardName(game.vance) })}
							</p>
							<button
								type="button"
								class="btn-chunky bg-explosion-yellow"
								onclick={() => game.dismissVance()}
							>
								{m.chess_vance_dismiss()}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<ChessCards {game} />
	</div>
</GameShell>

<TutorialModal
	open={showTutorial}
	title={m.chess_tutorial_title()}
	closeLabel={m.chess_tutorial_close()}
	onclose={() => (showTutorial = false)}
>
	<p>{m.chess_instructions()}</p>
	<p>{m.chess_tutorial_cards()}</p>
	<p>{m.chess_tutorial_vance({ percent: Math.round(VANCE_CHANCE * 100) })}</p>
	<p>{m.chess_tutorial_putin()}</p>
</TutorialModal>

<GameOverModal
	open={game.over}
	score={game.score}
	modeName={m.mode_chess_name()}
	isNewBest={game.isNewBest}
	title={gameOverTitle}
	customCameo={putinCameo}
	onRetry={() => game.restart()}
>
	<dl class="grid grid-cols-2 gap-2 text-sm">
		<div class="flex flex-col items-center gap-1 rounded-md border-2 border-ink bg-sand p-2">
			<dt class="font-bold">{m.chess_stat_moves()}</dt>
			<dd class="font-display text-2xl font-bold">{game.match.position.fullmove}</dd>
		</div>
		<div class="flex flex-col items-center gap-1 rounded-md border-2 border-ink bg-sand p-2">
			<dt class="font-bold">{m.chess_stat_cards_left()}</dt>
			<dd class="font-display text-2xl font-bold">{cardsLeft}</dd>
		</div>
	</dl>
</GameOverModal>
