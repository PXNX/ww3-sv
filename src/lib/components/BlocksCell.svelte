<!--
	One Block Puzzle cell. Each piece kind has its own flat fill and a small ink motif, so kinds
	can be told apart without relying on color: oil barrels (squares), grey warships (L-shapes),
	sea mines (Z- and S-shapes), and tankers (lines).
-->
<script lang="ts" module>
	import type { PieceKind } from '$lib/game/blocks/pieces';

	export type CellLook = 'filled' | 'empty' | 'ghost' | 'blocked';

	const KIND_CLASS: Record<PieceKind, string> = {
		square: 'bg-mustard',
		l: 'bg-sky',
		z: 'bg-tie-red',
		s: 'bg-tie-red',
		line: 'bg-flag-blue'
	};

	/** The same fills as hex values, for drawing the board on a canvas (share card) */
	export const KIND_HEX: Record<PieceKind, string> = {
		square: '#ddb93c',
		l: '#aeb4be',
		z: '#e5484d',
		s: '#e5484d',
		line: '#4fa8d8'
	};

	/** Ink motif per kind, shared as SVG assets rather than drawn inline */
	const KIND_MOTIF: Record<PieceKind, string> = {
		square: '/assets/sprites/blocks/barrel.svg',
		l: '/assets/sprites/blocks/warship-bow.svg',
		z: '/assets/sprites/mine.svg',
		s: '/assets/sprites/mine.svg',
		line: '/assets/sprites/blocks/porthole.svg'
	};

	const BLOCKED_MOTIF = '/assets/sprites/blocks/blocked.svg';
</script>

<script lang="ts">
	let {
		kind,
		look: lookProp,
		class: className = ''
	}: {
		kind: PieceKind | null;
		/** Defaults to filled or empty, depending on kind */
		look?: CellLook;
		class?: string;
	} = $props();

	const look = $derived(lookProp ?? (kind ? 'filled' : 'empty'));
	const fill = $derived(
		look === 'blocked'
			? 'bg-paper blocks-hatch'
			: look === 'empty' || !kind
				? 'bg-[#8e9c6e]'
				: KIND_CLASS[kind]
	);
</script>

<span
	class="relative block aspect-square rounded-[5px_3px_6px_4px] border-2 {fill} {look === 'empty'
		? 'border-[#5f6b45]'
		: 'border-ink'} {look === 'ghost' ? 'border-dashed opacity-75' : ''} {className}"
	aria-hidden="true"
>
	{#if kind && look !== 'empty'}
		<img
			src={look === 'blocked' ? BLOCKED_MOTIF : KIND_MOTIF[kind]}
			alt=""
			draggable="false"
			class="absolute inset-0 size-full"
		/>
	{/if}
</span>

<style>
	.blocks-hatch {
		background-image: repeating-linear-gradient(
			45deg,
			var(--color-tie-red) 0 2px,
			transparent 2px 6px
		);
	}
</style>
