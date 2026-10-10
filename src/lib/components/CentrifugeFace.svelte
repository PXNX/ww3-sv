<!--
	The calm face of Centrifuge Spin: an original meme-style cartoon with half-closed eyes and a tiny
	smile that does not change while the world burns. After a lost heart it looks startled for a
	moment. Pure decoration, so the alt text is the only thing a screen reader gets.
-->
<script lang="ts">
	let {
		startled = false,
		alt,
		class: className = ''
	}: {
		startled?: boolean;
		alt: string;
		class?: string;
	} = $props();
</script>

<svg viewBox="0 0 120 130" role="img" aria-label={alt} class={className}>
	<g stroke="#111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
		<!-- Shoulders and collar -->
		<path d="M24 130 Q26 108 60 106 Q94 108 96 130 Z" fill="#4fa8d8" />
		<path d="M50 104 L60 118 L70 104 Z" fill="#fff" stroke-width="3" />
		<!-- Ears, head and the one lonely hair -->
		<ellipse cx="17" cy="66" rx="7" ry="10" fill="#f6c9a0" />
		<ellipse cx="103" cy="66" rx="7" ry="10" fill="#f6c9a0" />
		<ellipse cx="60" cy="64" rx="43" ry="46" fill="#f6c9a0" />
		<path d="M58 19 Q50 6 62 8 Q70 9 64 20" fill="none" stroke-width="3" />
		<circle cx="38" cy="82" r="8" fill="#ee9e86" stroke="none" />
		<circle cx="82" cy="82" r="8" fill="#ee9e86" stroke="none" />

		{#if startled}
			<!-- Wide eyes, raised brows, a small round mouth and a sweat drop -->
			<path d="M30 40 Q42 30 52 38 M68 38 Q78 30 90 40" fill="none" />
			<circle cx="42" cy="56" r="12" fill="#fff" />
			<circle cx="78" cy="56" r="12" fill="#fff" />
			<circle cx="43" cy="57" r="4" fill="#111" stroke="none" />
			<circle cx="77" cy="57" r="4" fill="#111" stroke="none" />
			<ellipse cx="60" cy="94" rx="7" ry="9" fill="#8a3b3b" />
			<path d="M100 30 Q106 40 100 46 Q94 40 100 30 Z" fill="#aeb4be" stroke-width="2.5" />
		{:else}
			<!-- Heavy lids over small pupils, flat brows, the faintest smile -->
			<path d="M30 46 L54 46 M66 46 L90 46" fill="none" />
			<path d="M30 58 Q42 44 54 58 Z" fill="#fff" stroke-width="3" />
			<path d="M66 58 Q78 44 90 58 Z" fill="#fff" stroke-width="3" />
			<circle cx="43" cy="55" r="3.2" fill="#111" stroke="none" />
			<circle cx="77" cy="55" r="3.2" fill="#111" stroke="none" />
			<path d="M28 59 L56 59 M64 59 L92 59" fill="none" />
			<path d="M46 92 Q60 99 74 92" fill="none" />
		{/if}
		<path d="M58 70 Q60 76 64 71" fill="none" stroke-width="2.5" />
	</g>
</svg>
