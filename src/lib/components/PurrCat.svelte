<!--
	One cat of Purr Pentagram, drawn in SVG around its own origin (the board moves it to its seat):
	the cat itself, the petting ring that glows with the purr, floating hearts while it purrs, and,
	once it has been petted happy, its name tag and a gauge showing how deep its purr is.

	Every cat has a quirk that is only there to be looked at, so the five are easy to tell apart:
	a fat one, one in a top hat, a crazy one with spiral eyes, a bookish one with glasses and one
	wearing a crown. None of it says anything about the cat's personality.

	What the cat is doing comes from its state: hiding under the rug, off chasing the dot, flinching,
	hissing, staring, dozing or flicking its tail. Every pose is a plain transform, so with reduced
	motion the same poses show without any movement.
-->
<script lang="ts">
	import { CAT_RADIUS, UNSETTLED_MOOD } from '#lib/game/purrpentagram/config.js';
	import type { CatState } from '#lib/game/purrpentagram/state.js';
	import { COAT_COLORS } from '#lib/theme/purrCoats.js';

	let {
		cat,
		calm,
		eyes = 0,
		anchored = false,
		offset = { x: 0, y: 0 }
	}: {
		cat: CatState;
		/** Reduced motion: poses change, nothing animates */
		calm: boolean;
		/** How brightly the eyes glow in the finale (0 to 1) */
		eyes?: number;
		/** Chosen with the keyboard as the start of the star */
		anchored?: boolean;
		/** Where the cat has wandered off to, relative to its seat (the ring stays put) */
		offset?: { x: number; y: number };
	} = $props();

	const colors = $derived(COAT_COLORS[cat.profile.coat]);
	const motion = $derived(cat.motion?.kind ?? null);
	const upset = $derived(cat.mood < UNSETTLED_MOOD);
	const asleep = $derived(motion === 'doze');
	const purr = $derived(cat.purr);
	const quirk = $derived(cat.profile.quirk);
	const fat = $derived(quirk === 'fat');
	const crazy = $derived(quirk === 'crazy');
	/** Eye colour: yellow, turning to a glowing pink in the finale */
	const eyeColor = $derived(
		eyes > 0.05 ? `rgb(255 ${Math.round(220 - eyes * 130)} 235)` : '#f6e05e'
	);
	/** A staring cat opens its eyes wide; the crazy one has one big eye and one small */
	const eyeSize = $derived(motion === 'stare' ? 9.5 : 7.5);
</script>

<g class="cat" class:calm data-motion={motion}>
	<!-- The petting ring: it glows with the purr and turns red while the cat is too upset to be joined -->
	<circle
		class="ring"
		r={CAT_RADIUS}
		fill="rgb(40 12 60 / 0.35)"
		stroke={upset ? '#ff5a6e' : '#d9a8ff'}
		stroke-width={3 + purr * 5}
		stroke-opacity={upset ? 0.9 : 0.3 + purr * 0.7}
		stroke-dasharray={upset ? '10 8' : undefined}
		filter={purr > 0.15 ? 'url(#purr-glow)' : undefined}
	/>
	{#if anchored}
		<circle
			r={CAT_RADIUS + 10}
			fill="none"
			stroke="#ffd45e"
			stroke-width="5"
			stroke-dasharray="14 10"
		/>
	{/if}

	<g class="away" style:transform="translate({offset.x}px, {offset.y}px)">
		<g class="figure">
			<!-- Tail first, so the body sits on top of it -->
			{#key cat.flicks}
				<path
					class="tail"
					d={fat ? 'M48 46 C 88 54, 98 8, 74 -14' : 'M34 44 C 74 50, 84 6, 62 -16'}
					fill="none"
					stroke={colors.fur}
					stroke-width="13"
					stroke-linecap="round"
				/>
			{/key}
			<ellipse cx="0" cy="14" rx={fat ? 55 : 40} ry={fat ? 50 : 44} fill={colors.fur} />
			{#if fat}
				<!-- The big round belly -->
				<ellipse cx="0" cy="26" rx="38" ry="34" fill="#ffffff" opacity="0.3" />
			{:else}
				<ellipse cx="0" cy="26" rx="22" ry="28" fill={colors.shade} opacity="0.28" />
			{/if}
			<!-- Front paws -->
			<ellipse cx={fat ? -28 : -16} cy="56" rx="13" ry="8" fill={colors.fur} />
			<ellipse cx={fat ? 28 : 16} cy="56" rx="13" ry="8" fill={colors.fur} />
			{#if cat.profile.coat === 'tabby'}
				<path
					d="M-38 4 l12 5 M-39 20 l13 3 M38 4 l-12 5 M39 20 l-13 3"
					stroke={colors.shade}
					stroke-width="5"
					stroke-linecap="round"
				/>
			{/if}

			<g class="head">
				<!-- Ears -->
				<g class="ears">
					<polygon points="-30,-52 -26,-86 -6,-62" fill={colors.fur} />
					<polygon points="30,-52 26,-86 6,-62" fill={colors.fur} />
					<polygon points="-26,-58 -24,-76 -13,-62" fill="#e9a0b4" opacity="0.7" />
					<polygon points="26,-58 24,-76 13,-62" fill="#e9a0b4" opacity="0.7" />
				</g>
				<circle cx="0" cy="-36" r="31" fill={colors.fur} />
				{#if fat}
					<!-- Chubby cheeks -->
					<circle cx="-24" cy="-26" r="14" fill={colors.fur} />
					<circle cx="24" cy="-26" r="14" fill={colors.fur} />
				{:else if crazy}
					<!-- Wild tufts of fur -->
					<path
						d="M-16 -62 l-6 -16 l11 9 l3 -17 l7 15 l8 -14 l1 16 l9 -7 l-4 15 z"
						fill={colors.fur}
					/>
				{/if}
				{#if cat.profile.coat === 'tabby'}
					<path
						d="M-8 -64 v10 M0 -66 v12 M8 -64 v10"
						stroke={colors.shade}
						stroke-width="4"
						stroke-linecap="round"
					/>
				{/if}

				<!-- Eyes: open, wide when staring, shut when dozing, and lit up in the finale -->
				{#if asleep}
					<path
						d="M-20 -38 q7 6 14 0 M6 -38 q7 6 14 0"
						fill="none"
						stroke={colors.shade}
						stroke-width="3.5"
						stroke-linecap="round"
					/>
				{:else}
					<g class="eyes" filter={eyes > 0.05 ? 'url(#eye-glow)' : undefined}>
						<ellipse
							class="eye"
							cx="-13"
							cy="-38"
							rx={crazy ? 10 : eyeSize}
							ry={crazy ? 10 : eyeSize + 0.5}
							fill={eyeColor}
						/>
						<ellipse
							class="eye"
							cx="13"
							cy="-38"
							rx={crazy ? 6 : eyeSize}
							ry={crazy ? 6 : eyeSize + 0.5}
							fill={eyeColor}
						/>
						{#if crazy}
							<!-- Spinning spiral eyes -->
							<path
								class="spiral"
								d="M-14 -38 a1.5 1.5 0 1 1 3 0 a3.5 3.5 0 1 1 -7 0 a5.5 5.5 0 1 1 11 0 a7.5 7.5 0 1 1 -15 0"
								fill="none"
								stroke="#111"
								stroke-width="1.8"
								stroke-linecap="round"
							/>
							<path
								class="spiral"
								d="M12 -38 a1 1 0 1 1 2 0 a2.5 2.5 0 1 1 -5 0 a4 4 0 1 1 8 0"
								fill="none"
								stroke="#111"
								stroke-width="1.8"
								stroke-linecap="round"
							/>
						{:else}
							<ellipse cx="-13" cy="-38" rx={motion === 'hiss' ? 1.5 : 2.6} ry="7" fill="#111" />
							<ellipse cx="13" cy="-38" rx={motion === 'hiss' ? 1.5 : 2.6} ry="7" fill="#111" />
						{/if}
					</g>
				{/if}
				<path d="M-4 -26 h8 l-4 5 z" fill="#e58aa0" />
				{#if motion === 'hiss'}
					<path d="M-10 -19 q10 -9 20 0 q-10 11 -20 0 z" fill="#7a0f26" />
				{:else if crazy}
					<!-- A lopsided grin with the tongue out -->
					<path
						d="M-12 -20 q10 8 22 -2"
						fill="none"
						stroke={colors.shade}
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					<path
						d="M-2 -16 q3 14 9 4 q1 -3 -1 -5 z"
						fill="#ff6f93"
						stroke="#a03050"
						stroke-width="1.5"
					/>
				{:else}
					<path
						d="M0 -21 q-5 6 -10 3 M0 -21 q5 6 10 3"
						fill="none"
						stroke={colors.shade}
						stroke-width="2.5"
						stroke-linecap="round"
					/>
				{/if}
				<path
					d="M-24 -26 l-22 -4 M-24 -22 l-22 4 M24 -26 l22 -4 M24 -22 l22 4"
					stroke={cat.profile.coat === 'white' ? '#9a9486' : '#e8e8e8'}
					stroke-width="1.8"
					stroke-linecap="round"
					opacity="0.8"
				/>

				<!-- What the cat wears -->
				{#if quirk === 'glasses'}
					<g
						fill="rgb(190 225 255 / 0.25)"
						stroke="#2a2a2a"
						stroke-width="3"
						stroke-linecap="round"
					>
						<circle cx="-13" cy="-38" r="11.5" />
						<circle cx="13" cy="-38" r="11.5" />
						<path d="M-1.5 -39 h3 M-24.5 -40 l-7 -3 M24.5 -40 l7 -3" fill="none" />
					</g>
				{:else if quirk === 'tophat'}
					<g class="hat" transform="rotate(-9 0 -64)">
						<ellipse
							cx="0"
							cy="-64"
							rx="33"
							ry="7"
							fill="#5b2a86"
							stroke="#241036"
							stroke-width="2"
						/>
						<rect
							x="-20"
							y="-106"
							width="40"
							height="42"
							rx="3"
							fill="#6a2c91"
							stroke="#241036"
							stroke-width="2"
						/>
						<rect
							x="-20"
							y="-78"
							width="40"
							height="9"
							fill="#ffd45e"
							stroke="#a07a10"
							stroke-width="1.5"
						/>
						<ellipse
							cx="0"
							cy="-106"
							rx="20"
							ry="5"
							fill="#7c3aa6"
							stroke="#241036"
							stroke-width="2"
						/>
					</g>
				{:else if quirk === 'crown'}
					<g class="hat">
						<polygon
							points="-21,-62 -24,-92 -11,-77 0,-96 11,-77 24,-92 21,-62"
							fill="#ffd45e"
							stroke="#a07a10"
							stroke-width="2.5"
							stroke-linejoin="round"
						/>
						<circle cx="-11" cy="-68" r="3.5" fill="#d0263c" />
						<circle cx="0" cy="-70" r="3.5" fill="#3a8be0" />
						<circle cx="11" cy="-68" r="3.5" fill="#d0263c" />
					</g>
				{/if}
			</g>
		</g>

		{#if asleep}
			<text class="zzz" x="50" y="-60" fill="#cfd8ff" font-size="26" font-weight="700">z</text>
		{/if}
		{#if upset}
			<text
				class="bang"
				x="52"
				y="-66"
				text-anchor="middle"
				fill="#ff5a6e"
				font-size="34"
				font-weight="700">!</text
			>
		{/if}
		{#if purr > 0.3}
			<g class="hearts" aria-hidden="true">
				{#each [-34, 0, 34] as x, i (x)}
					{#if purr > 0.3 + i * 0.2}
						<text
							class="heart"
							{x}
							y={-112 - i * 3}
							text-anchor="middle"
							fill="#c0143c"
							stroke="#4a0510"
							stroke-width="1.5"
							font-size="22"
							style:animation-delay="{i * 0.35}s">♥</text
						>
					{/if}
				{/each}
			</g>
		{/if}

		{#if cat.nameShown}
			<g class="tag">
				<rect
					x="-58"
					y="62"
					width="116"
					height="30"
					rx="8"
					fill="#f3e3b5"
					stroke="#4a2c14"
					stroke-width="3"
				/>
				<circle cx="-46" cy="77" r="3.5" fill="#4a2c14" />
				<text
					x="4"
					y="83"
					text-anchor="middle"
					fill="#3b2414"
					font-size="19"
					font-weight="700"
					style:font-family="var(--font-riddle)">{cat.profile.name}</text
				>
			</g>
		{/if}
		{#if cat.pitchShown}
			<g class="gauge" aria-hidden="true">
				{#each [0, 1, 2, 3, 4] as rank (rank)}
					<rect
						x={-30 + rank * 13}
						y={118 - (rank + 1) * 4}
						width="9"
						height={(rank + 1) * 4 + 2}
						rx="2"
						fill={rank === cat.profile.purrRank ? '#ffd45e' : '#5b4a78'}
						stroke="#1b0f2a"
						stroke-width="1.5"
					/>
				{/each}
			</g>
		{/if}
	</g>
</g>

<style>
	.away {
		transition: transform 650ms ease-in-out;
	}

	.figure {
		transform-origin: 0 40px;
		transform-box: view-box;
		transition: transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	/* Hiding under the rug: small, low and half there */
	.cat[data-motion='hide'] .figure {
		transform: translateY(44px) scale(0.6);
		opacity: 0.45;
	}

	.cat[data-motion='hiss'] .figure {
		transform: scale(1.1);
	}

	.cat[data-motion='hiss'] .ears {
		transform: translateY(8px) scaleY(0.6);
		transform-origin: 0 -60px;
	}

	.cat[data-motion='flinch'] .figure {
		animation: flinch 700ms ease-out;
	}

	.cat[data-motion='chase'] .figure {
		transform: scale(0.92) rotate(-6deg);
	}

	.tail {
		transform-origin: 34px 44px;
		transform-box: view-box;
	}

	.cat[data-motion='flick'] .tail {
		animation: flick 600ms ease-in-out;
	}

	.cat[data-motion='doze'] .figure {
		transform: translateY(6px) scale(0.97);
	}

	.eye {
		animation: blink 6s infinite;
		transform-origin: center;
		transform-box: fill-box;
	}

	.spiral {
		animation: spin 1.6s linear infinite;
		transform-origin: center;
		transform-box: fill-box;
	}

	.zzz {
		animation: float 2.4s ease-in-out infinite;
	}

	.bang {
		animation: bounce 900ms ease-in-out infinite;
	}

	.heart {
		animation: rise 1.6s ease-out infinite;
	}

	.tag {
		animation: pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
		transform-origin: 0 77px;
	}

	@keyframes flinch {
		0% {
			transform: translateY(0) scale(1);
		}
		25% {
			transform: translateY(-16px) scale(1.06, 0.94);
		}
		100% {
			transform: translateY(0) scale(1);
		}
	}

	@keyframes flick {
		0%,
		100% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(28deg);
		}
		60% {
			transform: rotate(-22deg);
		}
	}

	@keyframes blink {
		0%,
		94%,
		100% {
			transform: scaleY(1);
		}
		97% {
			transform: scaleY(0.1);
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.6;
		}
		50% {
			transform: translateY(-8px);
			opacity: 1;
		}
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}

	@keyframes rise {
		0% {
			transform: translateY(10px);
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		100% {
			transform: translateY(-14px);
			opacity: 0;
		}
	}

	@keyframes pop {
		0% {
			transform: scale(0.3);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Reduced motion: every pose still shows, nothing moves on its own */
	.calm .figure,
	.calm .away {
		transition: none;
	}

	.calm .figure,
	.calm .tail,
	.calm .eye,
	.calm .spiral,
	.calm .zzz,
	.calm .bang,
	.calm .heart,
	.calm .tag {
		animation: none;
	}

	.calm .heart {
		opacity: 0.9;
	}
</style>
