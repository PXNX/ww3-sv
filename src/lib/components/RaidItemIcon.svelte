<!--
	Small cartoon icon of a raid weapon, helmet, vest or boots, in the playfield's style. With a rarity it
	sits on a tile in that rarity's colour.
-->
<script lang="ts">
	import {
		RARITY_COLOR,
		type ArmorSlot,
		type Rarity,
		type WeaponKind
	} from '#lib/game/raid/config.js';

	let {
		kind,
		rarity,
		class: className = 'size-10'
	}: {
		kind: WeaponKind | ArmorSlot;
		rarity?: Rarity;
		class?: string;
	} = $props();
</script>

<svg viewBox="0 0 48 48" class={className} aria-hidden="true">
	{#if rarity}
		<rect
			x="2"
			y="2"
			width="44"
			height="44"
			rx="9"
			fill={RARITY_COLOR[rarity]}
			stroke="#111"
			stroke-width="3"
		/>
	{/if}
	<g stroke="#111" stroke-width="2.5" stroke-linejoin="round">
		{#if kind === 'rifle'}
			<rect x="7" y="20" width="30" height="7" rx="2" fill="#3b3f2f" />
			<rect x="36" y="22" width="7" height="3" fill="#3b3f2f" />
			<path d="M13 27 l-3 9 h5 l3-9z" fill="#6b4520" />
			<rect x="22" y="27" width="4" height="8" rx="1" fill="#3b3f2f" />
		{:else if kind === 'marksman'}
			<rect x="4" y="22" width="40" height="5" rx="2" fill="#2a2f3a" />
			<rect x="16" y="15" width="14" height="5" rx="2" fill="#4a5363" />
			<path d="M8 27 l-3 9 h6 l3-9z" fill="#6b4520" />
		{:else if kind === 'shotgun'}
			<rect x="6" y="19" width="34" height="5" rx="2" fill="#3b3b3b" />
			<rect x="6" y="24" width="30" height="5" rx="2" fill="#3b3b3b" />
			<path d="M8 29 l-3 8 h7 l3-8z" fill="#6b4520" />
			<rect x="22" y="28" width="9" height="4" rx="1" fill="#6b4520" />
		{:else if kind === 'smg'}
			<rect x="10" y="18" width="26" height="9" rx="2" fill="#2b2b2b" />
			<rect x="35" y="21" width="6" height="3" fill="#2b2b2b" />
			<rect x="20" y="27" width="5" height="12" rx="1" fill="#2b2b2b" />
			<rect x="12" y="27" width="5" height="6" rx="1" fill="#2b2b2b" />
		{:else if kind === 'launcher'}
			<rect x="4" y="17" width="38" height="12" rx="5" fill="#55603a" />
			<circle cx="42" cy="23" r="4" fill="#e5484d" />
			<rect x="16" y="29" width="5" height="9" rx="1" fill="#55603a" />
		{:else if kind === 'flamethrower'}
			<rect x="14" y="19" width="26" height="8" rx="3" fill="#8a2f1f" />
			<circle cx="12" cy="28" r="7" fill="#c43c2c" />
			<path d="M40 23 q6 -5 4 -10 q5 6 0 12z" fill="#ff8a2b" />
			<rect x="24" y="27" width="4" height="9" rx="1" fill="#3b3b3b" />
		{:else if kind === 'dronenest'}
			<rect x="9" y="22" width="30" height="18" rx="3" fill="#55603a" />
			<path d="M9 31 h30" fill="none" />
			<path d="M16 14 l6 5 l6 -5" fill="none" />
			<circle cx="16" cy="13" r="3" fill="#d8dde2" />
			<circle cx="28" cy="13" r="3" fill="#d8dde2" />
			<rect x="19" y="16" width="6" height="5" rx="1" fill="#3d3d3d" />
		{:else if kind === 'boots'}
			<path d="M8 12 h10 v18 h8 v8 h-18z" fill="#5a4630" />
			<path d="M24 12 h10 v18 h8 v8 h-18z" fill="#6b5338" />
		{:else if kind === 'helmet'}
			<path d="M8 32 a16 16 0 0 1 32 0z" fill="#556b2f" />
			<rect x="5" y="31" width="38" height="5" rx="2" fill="#3e4f22" />
		{:else}
			<path d="M13 8 h6 l5 5 l5-5 h6 l4 8 v24 h-30 v-24z" fill="#556b2f" />
			<path d="M24 13 v27" fill="none" />
			<rect x="15" y="26" width="7" height="6" rx="1" fill="#3e4f22" />
			<rect x="27" y="26" width="7" height="6" rx="1" fill="#3e4f22" />
		{/if}
	</g>
</svg>
