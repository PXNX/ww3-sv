<!--
	The player's hand of three event cards, drawn like real playing cards: a white card face with an
	inner frame, the icon in the corners (upside down at the bottom), a colored art panel and a name
	banner. The hand is fanned out; a tapped card straightens up and lifts out of the fan. A card
	that needs no target is played with the button below, a ball or strike is thrown by tapping a
	highlighted enemy piece on the board. A played or confiscated card leaves its card back behind,
	so the cards never shuffle around.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { cardDefinition, type CardId, type CardKind } from '#lib/game/chess/cards.js';
	import { m } from '#lib/paraglide/messages.js';
	import { cardDescription, cardName, type ChessGame } from '#lib/stores/chessGame.svelte.js';
	import IconUkraine from '~icons/circle-flags/ua';
	import IconUsa from '~icons/circle-flags/us';
	import IconBiohazard from '~icons/lucide/biohazard';
	import IconBall from '~icons/lucide/circle-dot';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconHandshake from '~icons/lucide/handshake';
	import IconHeartCrack from '~icons/lucide/heart-crack';
	import IconLandmark from '~icons/lucide/landmark';
	import IconNet from '~icons/lucide/grid-3x3';
	import IconPaw from '~icons/lucide/paw-print';
	import IconPlane from '~icons/lucide/plane';
	import IconRocket from '~icons/lucide/rocket';
	import IconScale from '~icons/lucide/scale';
	import IconShip from '~icons/lucide/ship';
	import IconSnowflake from '~icons/lucide/snowflake';
	import IconSwords from '~icons/lucide/swords';
	import IconVote from '~icons/lucide/vote';
	import IconWheat from '~icons/lucide/wheat';

	let { game }: { game: ChessGame } = $props();

	type Icon = Component<SvelteHTMLElements['svg']>;

	const ICONS: Record<CardId, Icon> = {
		plague: IconBiohazard,
		'marriage-crisis': IconHeartCrack,
		'gotcha-ball': IconBall,
		'great-ball': IconBall,
		'ultra-ball': IconBall,
		'master-ball': IconBall,
		'pawn-net': IconNet,
		'farmer-revolution': IconWheat,
		mercenaries: IconSwords,
		'rigged-election': IconVote,
		'bear-hug': IconPaw,
		javelin: IconCrosshair,
		bayraktar: IconPlane,
		himars: IconRocket,
		'grain-corridor': IconShip,
		'lend-lease': IconLandmark,
		'frozen-assets': IconSnowflake,
		'trade-war': IconScale,
		'art-of-the-deal': IconHandshake
	};

	/** Cards with a country behind them wear its flag in the corner */
	const FLAGS: Partial<Record<CardId, Icon>> = {
		javelin: IconUkraine,
		bayraktar: IconUkraine,
		himars: IconUkraine,
		'grain-corridor': IconUkraine,
		'lend-lease': IconUsa,
		'frozen-assets': IconUsa,
		'trade-war': IconUsa,
		'art-of-the-deal': IconUsa
	};

	const KIND_TILE: Record<CardKind, string> = {
		chaos: 'bg-tie-red',
		capture: 'bg-flag-blue',
		strike: 'bg-sky',
		boost: 'bg-khaki',
		'trade-off': 'bg-mustard'
	};

	const KIND_NAME: Record<CardKind, () => string> = {
		chaos: m.chess_kind_chaos,
		capture: m.chess_kind_capture,
		strike: m.chess_kind_strike,
		boost: m.chess_kind_boost,
		'trade-off': m.chess_kind_trade_off
	};

	/** How far each place of the fan is turned and dropped, left to right */
	const FAN = [
		{ rotate: -7, drop: 0.5 },
		{ rotate: 0, drop: 0 },
		{ rotate: 7, drop: 0.5 }
	];

	const armed = $derived(game.armedCard);
	const needsTarget = $derived(armed !== null && cardDefinition(armed).target === 'piece');
	const remaining = $derived(game.cardSlots.filter((id) => id !== null).length);
</script>

<section class="flex flex-col gap-2" aria-label={m.chess_cards_label()}>
	<ul class="flex justify-center px-1 pt-10 pb-1">
		{#each game.cardSlots as id, index (index)}
			{@const fan = FAN[index % FAN.length]}
			<li
				class="w-28 shrink-0 not-first:-ms-3.5"
				style:--r="{fan.rotate}deg"
				style:--y="{fan.drop}rem"
			>
				{#if id}
					{@const Icon = ICONS[id]}
					{@const Flag = FLAGS[id]}
					{@const kind = cardDefinition(id).kind}
					<button
						type="button"
						class="card relative flex aspect-5/7 w-full flex-col rounded-xl border-3 border-ink bg-paper text-center shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-60"
						aria-pressed={armed === id}
						disabled={!game.canAct}
						onclick={() => game.armCard(id)}
					>
						<!-- Inner frame, like the border printed on a real card -->
						<span
							class="pointer-events-none absolute inset-1 rounded-lg border-2 border-ink/25"
							aria-hidden="true"
						></span>

						<!-- Corner indices: the icon top left, upside down bottom right -->
						<span
							class="pointer-events-none absolute start-1.5 top-1.5 flex flex-col items-center"
							aria-hidden="true"
						>
							<Icon class="size-4" stroke-width="2.5" />
						</span>
						<span
							class="pointer-events-none absolute end-1.5 bottom-1.5 flex rotate-180 flex-col items-center"
							aria-hidden="true"
						>
							<Icon class="size-4" stroke-width="2.5" />
						</span>
						{#if Flag}
							<span class="pointer-events-none absolute end-1.5 top-1.5" aria-hidden="true">
								<Flag class="size-4 rounded-full ring-1 ring-ink" />
							</span>
						{/if}

						<!-- Art panel -->
						<span
							class="mx-4 mt-6 flex flex-1 items-center justify-center rounded-md border-2 border-ink {KIND_TILE[
								kind
							]}"
							aria-hidden="true"
						>
							<Icon class="size-10" stroke-width="2.25" />
						</span>

						<!-- Name banner -->
						<span class="mx-3 mt-1 mb-4 flex min-h-8 flex-col items-center justify-center">
							<span class="text-[0.72rem] leading-[1.05] font-bold">{cardName(id)}</span>
							<span
								class="mt-0.5 text-[0.5rem] leading-none font-semibold tracking-wide uppercase opacity-60"
							>
								{KIND_NAME[kind]()}
							</span>
						</span>
					</button>
				{:else}
					<!-- Card back of a card that has been played or confiscated -->
					<div
						class="card flex aspect-5/7 w-full flex-col items-center justify-center gap-1 rounded-xl border-3 border-ink bg-banner-slate p-1.5 text-paper opacity-60 shadow-[3px_3px_0_var(--color-ink)]"
					>
						<div
							class="back flex size-full flex-col items-center justify-center rounded-md border-2 border-paper/70"
						>
							<span class="font-display text-3xl leading-none font-bold">4D</span>
							<span class="mt-1 text-[0.6rem] font-semibold uppercase">{m.chess_card_used()}</span>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="flex min-h-12 flex-col gap-2 text-sm leading-snug" role="status" aria-live="polite">
		{#if armed}
			<p class="font-semibold">{cardDescription(armed)}</p>
			{#if needsTarget}
				<p class="font-bold text-tie-red">{m.chess_card_pick_target()}</p>
			{:else}
				<button
					type="button"
					class="btn-chunky self-start bg-explosion-yellow px-3 py-1"
					disabled={!game.canAct}
					onclick={() => game.playCardNow()}
				>
					{m.chess_card_play()}
				</button>
			{/if}
		{:else if remaining > 0}
			<p>{m.chess_cards_hint({ count: remaining })}</p>
		{:else}
			<p>{m.chess_cards_none()}</p>
		{/if}
	</div>
</section>

<style>
	.card {
		transform: translateY(var(--y)) rotate(var(--r));
		transition: transform 220ms var(--ease-spring);
	}

	button.card:hover:not(:disabled) {
		transform: translateY(calc(var(--y) - 0.5rem)) rotate(var(--r));
	}

	/* A tapped card straightens up, lifts out of the fan and grows a little */
	button.card[aria-pressed='true'] {
		z-index: 20;
		transform: translateY(-1.75rem) rotate(0deg) scale(1.14);
		box-shadow: 0 8px 0 var(--color-ink);
		outline: 4px solid var(--color-explosion-yellow);
	}

	.back {
		background-image: repeating-linear-gradient(
			45deg,
			transparent 0 6px,
			rgb(255 255 255 / 0.14) 6px 12px
		);
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			transition: none;
		}
	}
</style>
