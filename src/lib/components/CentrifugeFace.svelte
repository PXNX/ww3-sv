<!--
	The calm one of Centrifuge Spin: an original "nothing ever happens" chud cartoon in a suit and bow
	tie, with thick glasses, stubble, half-closed eyes and a flat mouth that does not change while
	the world burns. After a lost heart he grabs his head like the guy at the roulette table. Pure
	decoration, so the alt text is the only thing a screen reader gets.
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

	/** Stubble dots along the jaw, clear of the mouth */
	const STUBBLE: [number, number][] = [
		[30, 90],
		[34, 98],
		[41, 104],
		[50, 107],
		[60, 109],
		[70, 107],
		[79, 104],
		[86, 98],
		[90, 90]
	];
</script>

<svg viewBox="0 0 120 130" role="img" aria-label={alt} class={className}>
	<g stroke="#111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
		<!-- Suit, shirt and bow tie -->
		<path d="M24 130 Q26 108 60 106 Q94 108 96 130 Z" fill="#2b2b35" />
		<path d="M48 105 L60 122 L72 105 Z" fill="#fff" stroke-width="3" />
		<path d="M60 110 L45 103 L45 117 Z M60 110 L75 103 L75 117 Z" fill="#111" stroke-width="2.5" />
		<!-- Ears, head and the one lonely hair -->
		<ellipse cx="17" cy="66" rx="7" ry="10" fill="#f6c9a0" />
		<ellipse cx="103" cy="66" rx="7" ry="10" fill="#f6c9a0" />
		<ellipse cx="60" cy="64" rx="43" ry="46" fill="#f6c9a0" />
		<path d="M58 19 Q50 6 62 8 Q70 9 64 20" fill="none" stroke-width="3" />
		<circle cx="38" cy="82" r="8" fill="#ee9e86" stroke="none" />
		<circle cx="82" cy="82" r="8" fill="#ee9e86" stroke="none" />
		{#each STUBBLE as [x, y] (`${x}-${y}`)}
			<circle cx={x} cy={y} r="1.3" fill="#111" stroke="none" />
		{/each}

		{#if startled}
			<!-- Wide eyes, raised brows, a small round mouth, a sweat drop and both hands on the head -->
			<path d="M30 38 Q42 28 52 36 M68 36 Q78 28 90 38" fill="none" />
			<circle cx="42" cy="57" r="12" fill="#fff" />
			<circle cx="78" cy="57" r="12" fill="#fff" />
			<circle cx="43" cy="58" r="4" fill="#111" stroke="none" />
			<circle cx="77" cy="58" r="4" fill="#111" stroke="none" />
			<ellipse cx="60" cy="94" rx="7" ry="9" fill="#8a3b3b" />
			<path d="M100 44 Q106 54 100 60 Q94 54 100 44 Z" fill="#aeb4be" stroke-width="2.5" />
			<g fill="#f6c9a0" stroke-width="3">
				<ellipse cx="18" cy="30" rx="10" ry="13" transform="rotate(-25 18 30)" />
				<ellipse cx="102" cy="30" rx="10" ry="13" transform="rotate(25 102 30)" />
			</g>
			<path
				d="M10 22 L14 30 M16 18 L19 27 M24 18 L24 27 M110 22 L106 30 M104 18 L101 27 M96 18 L96 27"
				fill="none"
				stroke-width="2.5"
			/>
		{:else}
			<!-- Heavy lids over small pupils, flat brows, a flat mouth -->
			<path d="M30 46 L54 46 M66 46 L90 46" fill="none" />
			<path d="M30 58 Q42 44 54 58 Z" fill="#fff" stroke-width="3" />
			<path d="M66 58 Q78 44 90 58 Z" fill="#fff" stroke-width="3" />
			<circle cx="43" cy="55" r="3.2" fill="#111" stroke="none" />
			<circle cx="77" cy="55" r="3.2" fill="#111" stroke="none" />
			<path d="M28 59 L56 59 M64 59 L92 59" fill="none" />
			<path d="M48 94 L72 94" fill="none" />
		{/if}

		<!-- Thick round glasses -->
		<g fill="none" stroke-width="3">
			<circle cx="42" cy="56" r="15" />
			<circle cx="78" cy="56" r="15" />
			<path d="M57 54 Q60 51 63 54 M27 54 L19 58 M93 54 L101 58" />
		</g>
		<path d="M58 70 Q60 76 64 71" fill="none" stroke-width="2.5" />
	</g>
</svg>
