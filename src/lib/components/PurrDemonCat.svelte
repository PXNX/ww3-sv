<!--
	The horned cat that rises in the middle of the pentagram when the ritual is complete: black fur,
	curling red horns, burning eyes, a fanged grin, a pointed tail, an inverted star on its brow and
	flames around its paws. Drawn in SVG around the middle of the star (the board places it); how far
	it has risen and how deep it is breathing come from the finale clock, so with reduced motion it is
	simply there, without anything moving.
-->
<script lang="ts">
	let {
		appear,
		breath,
		calm
	}: {
		/** How far the cat has risen (0 to 1) */
		appear: number;
		/** The slow breathing pulse of the finale (0 to 1) */
		breath: number;
		calm: boolean;
	} = $props();

	/** Eases out, so it shoots up and settles */
	const rise = $derived(1 - Math.pow(1 - appear, 3));
	const size = $derived((0.3 + 0.7 * rise) * (0.84 + 0.02 * breath));

	/** The inverted star on the brow: every second corner of a pentagon with a point facing down */
	const BROW = Array.from({ length: 5 }, (_, corner) => {
		const angle = Math.PI / 2 + (corner * 4 * Math.PI) / 5;
		return `${(11 * Math.cos(angle)).toFixed(1)},${(11 * Math.sin(angle)).toFixed(1)}`;
	}).join(' ');

	const FLAMES = [
		{ x: -92, h: 46, delay: 0 },
		{ x: -52, h: 64, delay: 0.25 },
		{ x: 0, h: 78, delay: 0.1 },
		{ x: 52, h: 60, delay: 0.4 },
		{ x: 92, h: 44, delay: 0.15 }
	];
</script>

{#if appear > 0}
	<g
		class="demon"
		class:calm
		aria-hidden="true"
		opacity={rise}
		transform="translate(500 {548 + (1 - rise) * 90}) scale({size})"
		pointer-events="none"
	>
		<!-- A red glow behind it -->
		<ellipse cx="0" cy="-20" rx="190" ry="210" fill="url(#burst)" opacity="0.55" />

		<!-- Flames at its paws -->
		{#each FLAMES as flame (flame.x)}
			<path
				class="flame"
				style:animation-delay="{flame.delay}s"
				d="M{flame.x - 20} 128 C {flame.x - 26} 96, {flame.x - 4} 92, {flame.x - 6} {128 -
					flame.h} C {flame.x + 10} {112 - flame.h * 0.5}, {flame.x + 30} 104, {flame.x + 20} 128 Z"
				fill="#ff6a1a"
				opacity="0.9"
			/>
			<path
				class="flame"
				style:animation-delay="{flame.delay}s"
				d="M{flame.x - 10} 128 C {flame.x - 12} 108, {flame.x} 106, {flame.x - 1} {128 -
					flame.h * 0.6} C {flame.x + 8} {118 - flame.h * 0.3}, {flame.x + 16} 112, {flame.x +
					10} 128 Z"
				fill="#ffd45e"
			/>
		{/each}

		<!-- The tail: a long curl with an arrow at its tip -->
		<g class="tail">
			<path
				d="M58 92 C 128 106, 152 40, 126 -2 C 118 -16, 130 -30, 148 -24"
				fill="none"
				stroke="#120a14"
				stroke-width="15"
				stroke-linecap="round"
			/>
			<polygon points="140,-40 168,-22 142,-8" fill="#b01428" stroke="#2a050a" stroke-width="2.5" />
		</g>

		<ellipse cx="0" cy="42" rx="66" ry="76" fill="#120a14" stroke="#4a0f1c" stroke-width="3" />
		<ellipse cx="0" cy="58" rx="34" ry="46" fill="#2a0c18" opacity="0.7" />
		<ellipse cx="-30" cy="112" rx="21" ry="11" fill="#120a14" stroke="#4a0f1c" stroke-width="2.5" />
		<ellipse cx="30" cy="112" rx="21" ry="11" fill="#120a14" stroke="#4a0f1c" stroke-width="2.5" />

		<g class="head">
			<!-- Horns, curling out and up from behind the ears -->
			<path
				d="M-34 -108 C -70 -140, -58 -196, -18 -222 C -36 -184, -28 -154, -8 -128 Z"
				fill="#b01428"
				stroke="#2a050a"
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d="M34 -108 C 70 -140, 58 -196, 18 -222 C 36 -184, 28 -154, 8 -128 Z"
				fill="#b01428"
				stroke="#2a050a"
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<!-- Ears -->
			<polygon
				points="-50,-96 -66,-152 -18,-118"
				fill="#120a14"
				stroke="#4a0f1c"
				stroke-width="3"
			/>
			<polygon points="50,-96 66,-152 18,-118" fill="#120a14" stroke="#4a0f1c" stroke-width="3" />
			<polygon points="-46,-104 -56,-138 -28,-116" fill="#7a0f26" opacity="0.8" />
			<polygon points="46,-104 56,-138 28,-116" fill="#7a0f26" opacity="0.8" />

			<circle cx="0" cy="-66" r="58" fill="#120a14" stroke="#4a0f1c" stroke-width="3" />
			<!-- Spiky cheek fur -->
			<path
				d="M-56 -60 l-18 6 l14 6 l-16 10 l22 0 z M56 -60 l18 6 l-14 6 l16 10 l-22 0 z"
				fill="#120a14"
				stroke="#4a0f1c"
				stroke-width="2.5"
				stroke-linejoin="round"
			/>

			<!-- The inverted star on its brow -->
			<polygon
				points={BROW}
				transform="translate(0 -104)"
				fill="none"
				stroke="#ff2a3a"
				stroke-width="2.4"
				stroke-linejoin="round"
				opacity="0.9"
			/>

			<!-- Slanted brows and burning eyes -->
			<path
				d="M-46 -94 L -10 -80 M46 -94 L10 -80"
				stroke="#4a0f1c"
				stroke-width="6"
				stroke-linecap="round"
			/>
			<g filter="url(#eye-glow)">
				<ellipse
					class="eye"
					cx="-24"
					cy="-72"
					rx="16"
					ry="9"
					fill="#ff2a2a"
					transform="rotate(24 -24 -72)"
				/>
				<ellipse
					class="eye"
					cx="24"
					cy="-72"
					rx="16"
					ry="9"
					fill="#ff2a2a"
					transform="rotate(-24 24 -72)"
				/>
			</g>
			<ellipse cx="-24" cy="-72" rx="2.6" ry="8" fill="#050205" transform="rotate(24 -24 -72)" />
			<ellipse cx="24" cy="-72" rx="2.6" ry="8" fill="#050205" transform="rotate(-24 24 -72)" />

			<path d="M-7 -52 h14 l-7 8 z" fill="#8a1a2a" />
			<!-- A wide grin with fangs -->
			<path
				d="M-38 -46 Q 0 6 38 -46 Q 0 -26 -38 -46 Z"
				fill="#4a0510"
				stroke="#050205"
				stroke-width="2.5"
				stroke-linejoin="round"
			/>
			<path d="M-26 -38 l6 18 l7 -14 z M26 -38 l-6 18 l-7 -14 z" fill="#f6f0e6" />
			<path
				d="M-52 -50 l-30 -8 M-52 -42 l-30 6 M52 -50 l30 -8 M52 -42 l30 6"
				stroke="#8a5a6a"
				stroke-width="2"
				stroke-linecap="round"
				opacity="0.7"
			/>
		</g>
	</g>
{/if}

<style>
	.demon .flame {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: lick 480ms ease-in-out infinite alternate;
	}

	.demon .tail {
		transform-origin: 58px 92px;
		transform-box: view-box;
		animation: swish 2.2s ease-in-out infinite alternate;
	}

	.demon .eye {
		animation: smoulder 1.3s ease-in-out infinite alternate;
	}

	@keyframes lick {
		from {
			transform: scale(0.9, 0.82) skewX(-4deg);
		}
		to {
			transform: scale(1.08, 1.16) skewX(5deg);
		}
	}

	@keyframes swish {
		from {
			transform: rotate(-5deg);
		}
		to {
			transform: rotate(7deg);
		}
	}

	@keyframes smoulder {
		from {
			opacity: 0.75;
		}
		to {
			opacity: 1;
		}
	}

	.demon.calm .flame,
	.demon.calm .tail,
	.demon.calm .eye {
		animation: none;
	}
</style>
