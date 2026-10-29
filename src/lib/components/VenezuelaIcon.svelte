<!--
	Small pictures for El Presidente's how-to-play legend and level cards: the hero, an oil barrel,
	a rig-guard goon, a helicopter, the flag and a barbed barricade, plus the mystery block, the four
	boosters, the spring pad and the hover barge, in the same chunky cartoon style as the playfield.
	All original and generic.
-->
<script lang="ts">
	let {
		kind,
		class: className = 'size-10'
	}: {
		kind:
			| 'hero'
			| 'barrel'
			| 'goon'
			| 'heli'
			| 'flag'
			| 'spikes'
			| 'block'
			| 'arepa'
			| 'turbo'
			| 'boots'
			| 'star'
			| 'spring'
			| 'barge';
		class?: string;
	} = $props();
</script>

<svg viewBox="0 0 40 40" class={className} aria-hidden="true">
	<g stroke="#111111" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
		{#if kind === 'hero'}
			<ellipse cx="14" cy="36" rx="4" ry="2.6" fill="#3b2a20" />
			<ellipse cx="25" cy="36" rx="4" ry="2.6" fill="#3b2a20" />
			<rect x="10" y="19" width="20" height="16" rx="6" fill="#ddb93c" />
			<path d="M11 19 L18 19 L30 31 L24 34 Z" fill="#e5484d" stroke-width="1.8" />
			<circle cx="14" cy="26" r="2" fill="#f5c83a" stroke-width="1.4" />
			<ellipse cx="21" cy="12" rx="10.5" ry="10" fill="#f6c9a0" />
			<path d="M11 10 Q15 0 26 2 Q31 4 31 10 Q22 6 11 10 Z" fill="#1c1410" stroke-width="1.8" />
			<ellipse cx="22" cy="12.5" rx="2.4" ry="2.7" fill="#ffffff" stroke-width="1.4" />
			<ellipse cx="28" cy="12.5" rx="2.4" ry="2.7" fill="#ffffff" stroke-width="1.4" />
			<circle cx="22.6" cy="12.8" r="0.9" fill="#111111" stroke="none" />
			<circle cx="28.6" cy="12.8" r="0.9" fill="#111111" stroke="none" />
			<path
				d="M15 20 Q21 15.5 27 19 Q33 15.5 36 13 Q35 23 27 22.5 Q20 24 15 20 Z"
				fill="#1c1410"
				stroke-width="1.6"
			/>
		{:else if kind === 'barrel'}
			<rect x="10" y="6" width="20" height="30" rx="4" fill="#2b3a55" />
			<rect x="10" y="12" width="20" height="4" fill="#4a5f86" stroke-width="1.6" />
			<rect x="10" y="26" width="20" height="4" fill="#4a5f86" stroke-width="1.6" />
			<path d="M20 15 Q26 22 20 26 Q14 22 20 15 Z" fill="#f5c83a" stroke-width="1.6" />
		{:else if kind === 'goon'}
			<ellipse cx="12" cy="36" rx="6" ry="3" fill="#222222" />
			<ellipse cx="28" cy="36" rx="6" ry="3" fill="#222222" />
			<ellipse cx="20" cy="26" rx="14" ry="11" fill="#34455e" />
			<rect x="7" y="25" width="26" height="4" fill="#c7d94a" stroke-width="1.6" />
			<path d="M9 17 Q9 4 20 4 Q31 4 31 17 Z" fill="#f5c83a" />
			<rect x="6" y="16" width="28" height="4" rx="2" fill="#f5c83a" />
			<rect x="10" y="20" width="20" height="5" rx="2" fill="#111111" />
			<path d="M15 31 Q20 28 25 31" fill="none" />
		{:else if kind === 'heli'}
			<path d="M24 20 L38 17 L38 23 L24 25 Z" fill="#9a3036" />
			<path d="M7 33 H31 M12 29 L11 33 M26 29 L27 33" fill="none" />
			<ellipse cx="18" cy="23" rx="14" ry="9" fill="#e5484d" />
			<path d="M8 21 Q10 14 18 15 Q21 18 20 23 Z" fill="#bfe6ff" stroke-width="1.6" />
			<circle cx="26" cy="26" r="2.5" fill="#ffffff" stroke-width="1.4" />
			<path d="M18 14 V9 M4 8 H32" fill="none" stroke-width="2.6" />
		{:else if kind === 'flag'}
			<rect x="9" y="33" width="14" height="5" rx="1.5" fill="#6a7c9b" />
			<path d="M16 33 V4" fill="none" stroke-width="3" />
			<circle cx="16" cy="3.5" r="2.5" fill="#f5c83a" stroke-width="1.6" />
			<path d="M17 6 Q24 3 33 6 L33 22 Q24 19 17 22 Z" fill="#e5484d" />
			<path d="M25 9 Q29 14 25 17 Q21 14 25 9 Z" fill="#f5c83a" stroke-width="1.4" />
		{:else if kind === 'block'}
			<rect x="5" y="5" width="30" height="30" rx="4" fill="#f5c83a" />
			<circle cx="9.5" cy="9.5" r="1.4" fill="#111111" stroke="none" />
			<circle cx="30.5" cy="9.5" r="1.4" fill="#111111" stroke="none" />
			<circle cx="9.5" cy="30.5" r="1.4" fill="#111111" stroke="none" />
			<circle cx="30.5" cy="30.5" r="1.4" fill="#111111" stroke="none" />
			<path d="M14 15 A6 6 0 1 1 22 20.5 Q20 22 20 25" fill="none" stroke-width="5.5" />
			<path d="M14 15 A6 6 0 1 1 22 20.5 Q20 22 20 25" fill="none" stroke="#ffffff" stroke-width="2.6" />
			<circle cx="20" cy="30" r="2.2" fill="#ffffff" stroke-width="1.6" />
		{:else if kind === 'arepa'}
			<ellipse cx="20" cy="21" rx="16" ry="14" fill="#e6b866" />
			<path
				d="M20 29 C8 20 12 11 20 16 C28 11 32 20 20 29 Z"
				fill="#e5484d"
				stroke-width="1.8"
			/>
		{:else if kind === 'turbo'}
			<path d="M13 9 Q9 5 14 2 M22 9 Q18 5 23 2" fill="none" stroke-width="1.8" />
			<path d="M31 20 A6 6 0 0 1 31 31" fill="none" stroke-width="3" />
			<rect x="7" y="10" width="24" height="25" rx="5" fill="#ffffff" />
			<ellipse cx="19" cy="10.5" rx="12" ry="3" fill="#6b3b1e" stroke-width="1.6" />
			<path d="M21 17 L14 27 L19.5 27 L16 34 L26 23 L20.5 23 Z" fill="#f5c83a" stroke-width="1.6" />
		{:else if kind === 'boots'}
			<path d="M9 4 H23 V22 L34 25 V31 H9 Z" fill="#e5484d" />
			<path d="M11 31 L29 33 L11 35 L29 37 L11 39" fill="none" stroke-width="3.6" />
			<path d="M11 31 L29 33 L11 35 L29 37 L11 39" fill="none" stroke="#d5dbe3" stroke-width="1.4" />
			<path d="M9 12 H23" fill="none" stroke="#f5c83a" stroke-width="2" />
		{:else if kind === 'star'}
			<path
				d="M4 16 Q11 6 20 14 Q29 6 36 16 Q34 30 24 25 Q20 23 16 25 Q6 30 4 16 Z"
				fill="#ffd23f"
				stroke-width="2"
			/>
			<path d="M32 4 L33.2 7.6 L37 8.5 L33.2 9.6 L32 13 L30.8 9.6 L27 8.5 L30.8 7.6 Z" fill="#ffffff" stroke-width="1.2" />
		{:else if kind === 'spring'}
			<rect x="7" y="31" width="26" height="5" rx="2" fill="#6a7c9b" />
			<path d="M13 31 L27 27 L13 23 L27 19 L13 15 L20 13" fill="none" stroke-width="5" />
			<path d="M13 31 L27 27 L13 23 L27 19 L13 15 L20 13" fill="none" stroke="#d5dbe3" stroke-width="2" />
			<rect x="8" y="7" width="24" height="6" rx="2.5" fill="#e5484d" />
		{:else if kind === 'barge'}
			<path d="M10 24 Q12 31 14 36 Q16 31 18 24 Z" fill="#ffb347" stroke-width="1.8" />
			<path d="M24 24 Q26 31 28 36 Q30 31 32 24 Z" fill="#ffb347" stroke-width="1.8" />
			<rect x="8" y="20" width="10" height="5" rx="1.5" fill="#34455e" stroke-width="1.6" />
			<rect x="24" y="20" width="10" height="5" rx="1.5" fill="#34455e" stroke-width="1.6" />
			<rect x="3" y="12" width="34" height="10" rx="4" fill="#6a7c9b" />
			<path d="M9 17 H13 M17 17 H21 M25 17 H29" fill="none" stroke="#f5c83a" stroke-width="2.4" />
		{:else}
			<path d="M3 35 L10 17 L17 35 Z" fill="#8d949c" />
			<path d="M15 35 L22 17 L29 35 Z" fill="#8d949c" />
			<path d="M26 35 L33 17 L38 35 Z" fill="#8d949c" />
			<path d="M2 28 H38" fill="none" stroke-width="1.8" />
		{/if}
	</g>
</svg>
