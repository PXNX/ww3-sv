<!--
	The calm one of Centrifuge Spin: an original marker-drawn "nothing ever happens" chud in the
	style of the meme: flat-top hair, thick scowling brows, rectangular glasses, a big nose and a
	heavy frown in a plain white T-shirt. The scowl does not change while the world burns. After a
	lost heart he grabs his head like the guy at the roulette table. Pure decoration, so the alt text
	is the only thing a screen reader gets.
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
	<g stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
		<!-- T-shirt, neck and a wavy scribble on the collar -->
		<path d="M14 130 Q16 110 44 106 L76 106 Q104 110 106 130 Z" fill="#fff" />
		<path d="M46 92 L47 108 M74 92 L73 108" fill="none" />
		<path d="M47 108 Q60 122 73 108" fill="#f4e4d2" />
		<path
			d="M44 121 Q47 116 50 121 T56 121 T62 121 T68 121 T74 121"
			fill="none"
			stroke-width="1.8"
		/>

		<!-- Ears and the wide, square-jawed head -->
		<ellipse cx="21" cy="66" rx="6" ry="10" fill="#f4e4d2" />
		<ellipse cx="99" cy="66" rx="6" ry="10" fill="#f4e4d2" />
		<path d="M24 40 L26 72 Q30 98 46 107 Q60 113 74 107 Q90 98 94 72 L96 40 Z" fill="#f4e4d2" />

		<!-- Flat-top hair -->
		<path
			d="M24 44 L26 24 Q60 12 94 24 L96 44 Q92 34 76 32 Q60 30 44 32 Q28 34 24 44 Z"
			fill="#111"
		/>

		<!-- Eye bags, nose and the deep lines beside the mouth -->
		<path d="M32 72 Q42 76 52 72 M68 72 Q78 76 88 72" fill="none" stroke-width="2" />
		<path d="M60 62 L55 82 Q60 87 67 82" fill="none" stroke-width="2.5" />
		<path d="M45 80 Q42 90 48 97 M75 80 Q78 90 72 97" fill="none" stroke-width="2" />

		{#if startled}
			<!-- Brows shot up, wide eyes behind the glasses, an open mouth and a sweat drop -->
			<path d="M31 47 Q42 40 54 47 M66 47 Q78 40 89 47" fill="none" stroke-width="5" />
			<circle cx="42" cy="62" r="6" fill="#fff" stroke-width="2.5" />
			<circle cx="78" cy="62" r="6" fill="#fff" stroke-width="2.5" />
			<circle cx="43" cy="63" r="2.4" fill="#111" stroke="none" />
			<circle cx="77" cy="63" r="2.4" fill="#111" stroke="none" />
			<ellipse cx="60" cy="98" rx="7" ry="8" fill="#8a3b3b" />
			<path d="M102 46 Q108 56 102 62 Q96 56 102 46 Z" fill="#aeb4be" stroke-width="2.5" />
		{:else}
			<!-- Thick brows slanting down into a scowl, with the wrinkles between them -->
			<path d="M31 45 L54 54 M89 45 L66 54" fill="none" stroke-width="6" />
			<path d="M57 42 L56 35 M63 42 L64 35" fill="none" stroke-width="2" />
			<circle cx="43" cy="62" r="2.6" fill="#111" stroke="none" />
			<circle cx="77" cy="62" r="2.6" fill="#111" stroke="none" />
			<!-- The heavy frown -->
			<path
				d="M46 98 Q52 90 60 92 Q68 90 74 98 Q67 106 60 106 Q53 106 46 98 Z"
				fill="#e8a5a0"
				stroke-width="2.5"
			/>
			<path d="M46 98 Q60 93 74 98" fill="none" stroke-width="2.5" />
		{/if}

		<!-- Rectangular glasses -->
		<g fill="none" stroke-width="2.8">
			<path d="M29 55 H55 V69 H29 Z M65 55 H91 V69 H65 Z M55 58 H65 M29 58 L21 60 M91 58 L99 60" />
		</g>

		{#if startled}
			<!-- Both hands on the head -->
			<g fill="#f4e4d2" stroke-width="3">
				<ellipse cx="16" cy="34" rx="10" ry="13" transform="rotate(-25 16 34)" />
				<ellipse cx="104" cy="34" rx="10" ry="13" transform="rotate(25 104 34)" />
			</g>
			<path
				d="M8 26 L12 34 M14 22 L17 31 M22 22 L22 31 M112 26 L108 34 M106 22 L103 31 M98 22 L98 31"
				fill="none"
				stroke-width="2.5"
			/>
		{/if}
	</g>
</svg>
