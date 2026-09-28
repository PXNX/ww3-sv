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
		<svg viewBox="0 0 10 10" class="absolute inset-0 size-full" fill="none" stroke="#111111">
			{#if look === 'blocked'}
				<path d="M3 3l4 4M7 3l-4 4" stroke-width="1.6" stroke-linecap="round" />
			{:else if kind === 'square'}
				<!-- Barrel hoops -->
				<path d="M2 3.5h6M2 6.5h6" stroke-width="1.1" />
			{:else if kind === 'line'}
				<!-- Tanker porthole -->
				<circle cx="5" cy="5" r="1.6" stroke-width="1.1" fill="#ffffff" />
			{:else if kind === 'l'}
				<!-- Warship bow -->
				<path d="M2.5 6.5h5l-1 1.5h-3z" stroke-width="1" fill="#ffffff" />
			{:else}
				<!-- Sea mine with spikes -->
				<circle cx="5" cy="5" r="1.8" stroke-width="1" fill="#111111" />
				<path d="M5 1.8v1.4M5 6.8v1.4M1.8 5h1.4M6.8 5h1.4" stroke-width="1" />
			{/if}
		</svg>
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
