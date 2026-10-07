<!--
	The player's hand of three event cards. Tap a card to pick it up: a card that needs no target is
	played with the button below, a ball is thrown by tapping a highlighted enemy piece on the board.
	A played or confiscated card leaves an empty place, so the cards never shuffle around.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { cardDefinition, type CardId, type CardKind } from '#lib/game/chess/cards.js';
	import { m } from '#lib/paraglide/messages.js';
	import { cardDescription, cardName, type ChessGame } from '#lib/stores/chessGame.svelte.js';
	import IconBiohazard from '~icons/lucide/biohazard';
	import IconBall from '~icons/lucide/circle-dot';
	import IconHeartCrack from '~icons/lucide/heart-crack';
	import IconNet from '~icons/lucide/grid-3x3';
	import IconPaw from '~icons/lucide/paw-print';
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
		'bear-hug': IconPaw
	};

	const KIND_TILE: Record<CardKind, string> = {
		chaos: 'bg-tie-red',
		capture: 'bg-flag-blue',
		boost: 'bg-khaki',
		'trade-off': 'bg-mustard'
	};

	const KIND_NAME: Record<CardKind, () => string> = {
		chaos: m.chess_kind_chaos,
		capture: m.chess_kind_capture,
		boost: m.chess_kind_boost,
		'trade-off': m.chess_kind_trade_off
	};

	const armed = $derived(game.armedCard);
	const needsTarget = $derived(armed !== null && cardDefinition(armed).target === 'piece');
	const remaining = $derived(game.cardSlots.filter((id) => id !== null).length);
</script>

<section class="flex flex-col gap-2" aria-label={m.chess_cards_label()}>
	<ul class="grid grid-cols-3 gap-2">
		{#each game.cardSlots as id, index (index)}
			<li class="flex">
				{#if id}
					{@const Icon = ICONS[id]}
					{@const kind = cardDefinition(id).kind}
					<button
						type="button"
						class="sticker flex w-full flex-col items-center gap-1 p-2 text-center active:scale-95 disabled:opacity-60"
						class:bg-explosion-yellow={armed === id}
						style:--tilt="{(index - 1) * 1.5}deg"
						aria-pressed={armed === id}
						disabled={!game.canAct}
						onclick={() => game.armCard(id)}
					>
						<span class="rounded-md border-2 border-ink p-1.5 {KIND_TILE[kind]}" aria-hidden="true">
							<Icon class="size-6" stroke-width="2.5" />
						</span>
						<span class="text-sm leading-tight font-bold">{cardName(id)}</span>
						<span class="text-[0.65rem] leading-none font-semibold uppercase opacity-70">
							{KIND_NAME[kind]()}
						</span>
					</button>
				{:else}
					<div
						class="flex w-full flex-col items-center justify-center rounded-[12px_6px_14px_8px] border-3 border-dashed border-ink/40 p-2 text-center text-xs font-semibold opacity-60"
					>
						{m.chess_card_used()}
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
