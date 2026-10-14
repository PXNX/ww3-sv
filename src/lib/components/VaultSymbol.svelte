<!--
	The twelve treasures of Gold & Cheese Vault as flat, thick-outlined cartoon art: three gold
	pieces, three cheeses, three watches and three chocolates. All drawn here as inline SVG, no
	real brands.
-->
<script lang="ts">
	import type { SymbolId } from '#lib/game/vault/symbols.js';

	let { symbol, class: className = '' }: { symbol: SymbolId; class?: string } = $props();
</script>

<svg
	viewBox="0 0 64 64"
	class={className}
	aria-hidden="true"
	fill="none"
	stroke="#111"
	stroke-width="3"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if symbol === 'gold-bar'}
		<path d="M18 21 H46 L55 34 H9 Z" fill="#ffe58a" />
		<path d="M9 34 H55 L59 49 H5 Z" fill="#f5c83a" />
		<path d="M15 40 H25" stroke-width="2.5" opacity="0.6" />
		<path d="M30 21 L26 34" stroke-width="2" opacity="0.4" />
		<path d="M50 8 V16 M46 12 H54" stroke-width="2.5" />
	{:else if symbol === 'gold-coin'}
		<circle cx="32" cy="33" r="24" fill="#f5c83a" />
		<circle cx="32" cy="33" r="16.5" fill="#ffe58a" stroke-width="2.5" />
		<path
			d="M32 23 L35 30 L42.5 30.5 L36.8 35.5 L38.6 43 L32 39 L25.4 43 L27.2 35.5 L21.5 30.5 L29 30 Z"
			fill="#f5c83a"
			stroke-width="2.5"
		/>
	{:else if symbol === 'gold-nuggets'}
		<path d="M6 50 L10 36 L22 32 L32 40 L30 52 Z" fill="#f5c83a" />
		<path d="M30 52 L32 38 L44 30 L56 36 L58 50 Z" fill="#e0a920" />
		<path d="M18 34 L22 18 L34 12 L44 22 L40 34 L32 40 L22 32 Z" fill="#ffe58a" />
		<path d="M26 22 L32 18" stroke-width="2.5" opacity="0.6" />
		<path d="M47 40 L51 44" stroke-width="2.5" opacity="0.6" />
	{:else if symbol === 'cheese-wheel'}
		<path d="M7 28 V42 A25 12 0 0 0 57 42 V28" fill="#eda82c" />
		<ellipse cx="32" cy="28" rx="25" ry="12" fill="#ffe07a" />
		<ellipse cx="22" cy="26" rx="4" ry="2.2" fill="#e8a92a" stroke-width="2.5" />
		<ellipse cx="40" cy="30" rx="5" ry="2.6" fill="#e8a92a" stroke-width="2.5" />
		<ellipse cx="33" cy="24" rx="2.4" ry="1.4" fill="#e8a92a" stroke-width="2" />
		<ellipse cx="14" cy="45" rx="3" ry="4.5" fill="#d9951c" stroke-width="2.5" />
		<ellipse cx="46" cy="47" rx="3.5" ry="5" fill="#d9951c" stroke-width="2.5" />
	{:else if symbol === 'cheese-wedge'}
		<path d="M6 46 L52 20 L58 34 L58 50 L6 50 Z" fill="#f6c945" />
		<path d="M6 46 L52 20 L58 34 L58 46 Z" fill="#ffe07a" />
		<path d="M6 46 H58" />
		<ellipse cx="22" cy="41" rx="3.6" ry="3" fill="#e8a92a" stroke-width="2.5" />
		<ellipse cx="40" cy="39" rx="3" ry="2.6" fill="#e8a92a" stroke-width="2.5" />
		<ellipse cx="48" cy="29" rx="2.4" ry="2" fill="#e8a92a" stroke-width="2" />
	{:else if symbol === 'cheese-block'}
		<path d="M8 22 L18 12 H56 L46 22 Z" fill="#ffe07a" />
		<path d="M46 22 L56 12 V42 L46 52 Z" fill="#e3a21f" />
		<rect x="8" y="22" width="38" height="30" rx="2" fill="#f6c945" />
		<ellipse cx="20" cy="33" rx="4.5" ry="4" fill="#e8a92a" stroke-width="2.5" />
		<ellipse cx="34" cy="43" rx="3.4" ry="3" fill="#e8a92a" stroke-width="2.5" />
		<ellipse cx="36" cy="30" rx="2.4" ry="2" fill="#e8a92a" stroke-width="2" />
		<ellipse cx="17" cy="45" rx="2.2" ry="1.8" fill="#e8a92a" stroke-width="2" />
	{:else if symbol === 'watch-pocket'}
		<path d="M32 17 V12" />
		<circle cx="32" cy="9" r="4.5" fill="#d8dce2" />
		<path d="M46 14 Q58 6 60 16" stroke-width="2.5" />
		<circle cx="32" cy="38" r="21" fill="#d8dce2" />
		<circle cx="32" cy="38" r="15.5" fill="#fffdf2" stroke-width="2.5" />
		<path d="M32 38 V27 M32 38 L40 42" stroke-width="3" />
		<path d="M32 24 V26 M32 50 V52 M18.5 38 H20.5 M43.5 38 H45.5" stroke-width="2" />
	{:else if symbol === 'watch-wrist'}
		<path d="M22 6 H42 L40 20 H24 Z" fill="#8a5a3a" />
		<path d="M24 44 H40 L42 58 H22 Z" fill="#8a5a3a" />
		<circle cx="32" cy="32" r="16" fill="#d8dce2" />
		<circle cx="32" cy="32" r="11.5" fill="#fffdf2" stroke-width="2.5" />
		<path d="M32 32 V24 M32 32 L38 35" stroke-width="3" />
		<path d="M48 30 H52 V34 H48" stroke-width="2.5" fill="#d8dce2" />
	{:else if symbol === 'watch-alarm'}
		<path d="M12 18 Q20 6 28 14 Z" fill="#e5484d" />
		<path d="M52 18 Q44 6 36 14 Z" fill="#e5484d" />
		<path d="M32 12 V16" />
		<path d="M18 52 L13 60 M46 52 L51 60" />
		<circle cx="32" cy="35" r="21" fill="#e5484d" />
		<circle cx="32" cy="35" r="15" fill="#fffdf2" stroke-width="2.5" />
		<path d="M32 35 V26 M32 35 L39 38" stroke-width="3" />
	{:else if symbol === 'choc-bar'}
		<rect x="10" y="8" width="44" height="50" rx="4" fill="#7b4a2b" />
		<path d="M10 24.7 H54 M10 41.3 H54 M32 8 V58" stroke-width="2.5" />
		<path d="M14 14 H24 M38 30 H48 M14 46 H24" stroke="#b27a4f" stroke-width="2.5" />
		<path d="M54 8 L44 8 L54 20 Z" fill="#f5c83a" stroke-width="2.5" />
	{:else if symbol === 'choc-truffle'}
		<path d="M14 40 L18 54 H46 L50 40 Z" fill="#e8e1bc" />
		<path d="M24 41 L26 54 M32 41 V54 M40 41 L38 54" stroke-width="2" />
		<circle cx="32" cy="30" r="19" fill="#6a3b20" />
		<path d="M20 26 Q24 17 33 15" stroke="#b27a4f" stroke-width="3" />
		<circle cx="38" cy="26" r="1.2" fill="#b27a4f" stroke="none" />
		<circle cx="28" cy="35" r="1.2" fill="#b27a4f" stroke="none" />
		<circle cx="42" cy="36" r="1.2" fill="#b27a4f" stroke="none" />
	{:else if symbol === 'choc-bonbon'}
		<path d="M18 32 L5 21 L7 43 Z" fill="#f5c83a" />
		<path d="M46 32 L59 21 L57 43 Z" fill="#f5c83a" />
		<ellipse cx="32" cy="32" rx="19" ry="14" fill="#e5484d" />
		<path d="M22 28 Q27 21 34 21" stroke="#fff" stroke-width="3" opacity="0.7" />
		<path d="M24 38 L40 26" stroke="#f5c83a" stroke-width="3.5" />
	{/if}
</svg>
