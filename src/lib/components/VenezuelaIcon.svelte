<!--
	Small pictures for El Presidente's how-to-play legend and level cards: the hero, an oil barrel,
	a rig-guard goon, a helicopter, the flag and a barbed barricade, in the same chunky cartoon
	style as the playfield. All original and generic.
-->
<script lang="ts">
	let {
		kind,
		class: className = 'size-10'
	}: {
		kind: 'hero' | 'barrel' | 'goon' | 'heli' | 'flag' | 'spikes';
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
		{:else}
			<path d="M3 35 L10 17 L17 35 Z" fill="#8d949c" />
			<path d="M15 35 L22 17 L29 35 Z" fill="#8d949c" />
			<path d="M26 35 L33 17 L38 35 Z" fill="#8d949c" />
			<path d="M2 28 H38" fill="none" stroke-width="1.8" />
		{/if}
	</g>
</svg>
