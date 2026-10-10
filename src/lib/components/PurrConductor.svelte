<!--
	A tiny horned cat conducting the finale: it waves its baton in time with the music (held still
	with reduced motion). Decorative only.
-->
<script lang="ts">
	let { calm, class: className = '' }: { calm: boolean; class?: string } = $props();
</script>

<svg viewBox="0 0 120 120" class={className} class:calm aria-hidden="true">
	<!-- Tail -->
	<path
		d="M84 98 C 112 98, 114 66, 98 56"
		fill="none"
		stroke="#1d1d26"
		stroke-width="9"
		stroke-linecap="round"
	/>
	<!-- Body in a little tailcoat -->
	<ellipse cx="60" cy="84" rx="26" ry="28" fill="#1d1d26" />
	<path d="M60 62 L52 84 L60 108 L68 84 Z" fill="#f3efe6" />
	<path d="M54 66 l6 6 l6 -6 l-3 8 l-6 0 z" fill="#8b0a1a" />
	<!-- Head -->
	<circle cx="60" cy="42" r="24" fill="#2b2b33" />
	<polygon points="40,28 38,8 54,20" fill="#2b2b33" />
	<polygon points="80,28 82,8 66,20" fill="#2b2b33" />
	<!-- Horns -->
	<path d="M44 24 C 36 14, 38 4, 30 0 C 42 -2, 50 10, 52 20 Z" fill="#c0143c" />
	<path d="M76 24 C 84 14, 82 4, 90 0 C 78 -2, 70 10, 68 20 Z" fill="#c0143c" />
	<!-- Glowing eyes and a small grin -->
	<ellipse cx="51" cy="42" rx="5" ry="6" fill="#ff7ae0" />
	<ellipse cx="69" cy="42" rx="5" ry="6" fill="#ff7ae0" />
	<ellipse cx="51" cy="42" rx="1.6" ry="5" fill="#2a0030" />
	<ellipse cx="69" cy="42" rx="1.6" ry="5" fill="#2a0030" />
	<path
		d="M52 54 q8 7 16 0"
		fill="none"
		stroke="#f3efe6"
		stroke-width="2.5"
		stroke-linecap="round"
	/>
	<!-- The conducting arm and baton -->
	<g class="arm">
		<path d="M82 80 L100 58" stroke="#1d1d26" stroke-width="8" stroke-linecap="round" />
		<path d="M100 58 L112 30" stroke="#f3efe6" stroke-width="3" stroke-linecap="round" />
		<circle cx="112" cy="30" r="3.5" fill="#ffd45e" />
	</g>
</svg>

<style>
	.arm {
		transform-origin: 82px 80px;
		animation: conduct 1.5s ease-in-out infinite;
	}

	@keyframes conduct {
		0%,
		100% {
			transform: rotate(-14deg);
		}
		50% {
			transform: rotate(16deg);
		}
	}

	.calm .arm {
		animation: none;
	}
</style>
