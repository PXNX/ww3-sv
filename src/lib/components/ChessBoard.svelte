<!--
	4D Chess board. Tap one of your pieces, then a highlighted square; a ball card is thrown by
	tapping one of the highlighted enemy pieces. The board always stays left-to-right (also in
	Persian and Arabic) so files and ranks match what the player sees. Your pieces are white,
	Putin's are red.
-->
<script lang="ts">
	import {
		colOf,
		rowOf,
		squareName,
		type PieceType,
		type PromotionType
	} from '#lib/game/chess/chess.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { ChessGame } from '#lib/stores/chessGame.svelte.js';
	import ChessPiece from './ChessPiece.svelte';

	let { game }: { game: ChessGame } = $props();

	const PIECE_NAMES: Record<PieceType, () => string> = {
		p: m.chess_piece_pawn,
		n: m.chess_piece_knight,
		b: m.chess_piece_bishop,
		r: m.chess_piece_rook,
		q: m.chess_piece_queen,
		k: m.chess_piece_king
	};

	const PROMOTIONS: PromotionType[] = ['q', 'r', 'b', 'n'];

	const board = $derived(game.match.position.board);
	const lastMove = $derived(game.match.lastMove);
	const moveTargets = $derived(new Set(game.moveTargets));
	const cardTargets = $derived(new Set(game.cardTargets));
	const checkedKing = $derived(game.checkedKing);

	function label(square: number): string {
		const piece = board[square];
		const name = squareName(square);
		if (!piece) return name;
		const type = PIECE_NAMES[piece.type]();
		return piece.color === 'w'
			? m.chess_square_yours({ square: name, piece: type })
			: m.chess_square_putins({ square: name, piece: type });
	}
</script>

<div
	data-playfield
	class="relative aspect-square w-full overflow-hidden rounded-[16px_10px_18px_8px] border-3 border-ink shadow-[4px_4px_0_var(--color-ink)] select-none"
	role="group"
	aria-label={m.chess_board_label()}
>
	<div class="grid size-full grid-cols-8 grid-rows-8">
		{#each board as piece, square (square)}
			{@const dark = (rowOf(square) + colOf(square)) % 2 === 1}
			{@const isTarget = moveTargets.has(square)}
			{@const isCardTarget = cardTargets.has(square)}
			<button
				type="button"
				class="relative flex items-center justify-center p-0 transition-colors focus-visible:z-10 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ink"
				class:bg-sand={!dark}
				class:bg-khaki={dark}
				class:bg-mustard={lastMove && (lastMove.from === square || lastMove.to === square)}
				class:bg-explosion-yellow={game.selected === square}
				class:bg-tie-red={checkedKing === square}
				aria-label={label(square)}
				aria-pressed={game.selected === square}
				onclick={() => game.pressSquare(square)}
			>
				{#if piece}
					<ChessPiece
						type={piece.type}
						color={piece.color}
						class="pointer-events-none size-[88%] drop-shadow-[1px_2px_0_rgb(0_0_0/0.3)]"
					/>
				{/if}

				{#if isTarget}
					{#if piece}
						<span
							class="pointer-events-none absolute inset-[6%] rounded-full border-4 border-ink/60"
							aria-hidden="true"
						></span>
					{:else}
						<span class="pointer-events-none size-1/4 rounded-full bg-ink/50" aria-hidden="true"
						></span>
					{/if}
				{/if}

				{#if isCardTarget}
					<span
						class="target pointer-events-none absolute inset-[4%] rounded-full border-4 border-dashed border-tie-red"
						aria-hidden="true"
					></span>
				{/if}

				{#if colOf(square) === 0}
					<span
						class="pointer-events-none absolute start-0.5 top-0 text-[0.6rem] leading-none font-bold text-ink/70"
						aria-hidden="true">{8 - rowOf(square)}</span
					>
				{/if}
				{#if rowOf(square) === 7}
					<span
						class="pointer-events-none absolute end-0.5 bottom-0 text-[0.6rem] leading-none font-bold text-ink/70"
						aria-hidden="true">{'abcdefgh'[colOf(square)]}</span
					>
				{/if}
			</button>
		{/each}
	</div>

	{#if game.promotion}
		<div class="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 p-3">
			<div class="sticker pop-in flex flex-col items-center gap-2 p-3" style:--tilt="-1deg">
				<p class="font-bold">{m.chess_promotion_title()}</p>
				<div class="flex gap-2">
					{#each PROMOTIONS as type (type)}
						<button
							type="button"
							class="btn-chunky p-2"
							aria-label={PIECE_NAMES[type]()}
							onclick={() => game.choosePromotion(type)}
						>
							<ChessPiece {type} color="w" class="size-9" />
						</button>
					{/each}
				</div>
				<button
					type="button"
					class="text-sm font-semibold underline"
					onclick={() => game.cancelPromotion()}
				>
					{m.chess_promotion_cancel()}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.target {
		animation: spin 6s linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.target {
			animation: none;
		}
	}
</style>
