<!--
	One cat of Purr Pentagram, drawn in SVG around its own origin (the board moves it to its seat):
	the cat itself, the petting ring that glows with the purr, and under it the name tag, the three
	hearts of its happiness and, once it has been petted happy, a gauge of how deep its purr is. The
	tag is a "?" until the cat has warmed up enough to show its name: that is how the player learns
	that there is a name to be found.

	Every cat has a quirk that is there to be looked at, so the five are easy to tell apart (and the
	riddle can name it): a fat one, one in a top hat, a crazy one with spiral eyes, a bookish one with
	glasses and one wearing a crown. One cat is also possessed: it hovers, its eyes burn red and a dark
	aura flickers around it. None of it says anything about the cat's personality.

	What the cat is doing comes from its state: hiding under the rug, running after the dot,
	flinching, hissing, staring, dozing, purring. The layers move on their own so the animations do
	not fight: "away" (where the cat has wandered to), "hover" (the possessed cat floating), "figure"
	(the pose of the reaction) and "life" (breathing, running, shivering). With reduced motion the
	same poses show without any movement.
-->
<script lang="ts">
	import { CAT_RADIUS, UNSETTLED_MOOD } from '#lib/game/purrpentagram/config.js';
	import { MAX_HEARTS, catHearts } from '#lib/game/purrpentagram/scoring.js';
	import type { CatState } from '#lib/game/purrpentagram/state.js';
	import { COAT_COLORS } from '#lib/theme/purrCoats.js';

	let {
		cat,
		calm,
		eyes = 0,
		anchored = false,
		step = null,
		offset = { x: 0, y: 0 }
	}: {
		cat: CatState;
		/** Reduced motion: poses change, nothing animates */
		calm: boolean;
		/** How brightly the eyes glow in the finale (0 to 1) */
		eyes?: number;
		/** Chosen with the keyboard as the start of the star */
		anchored?: boolean;
		/** Where the cat has been joined into the star (1 to 5), once it has been */
		step?: number | null;
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
	const possessed = $derived(cat.profile.possessed);
	const hearts = $derived(catHearts(cat.happiness));
	/** Eye colour: yellow, burning red when possessed, turning to a glowing pink in the finale */
	const eyeColor = $derived(
		eyes > 0.05 ? `rgb(255 ${Math.round(220 - eyes * 130)} 235)` : possessed ? '#ff2a3a' : '#f6e05e'
	);
	/** A staring cat opens its eyes wide; the crazy one has one big eye and one small */
	const eyeSize = $derived(motion === 'stare' ? 9.5 : 7.5);
	/** Which way a running cat leans */
	const lean = $derived(offset.x >= 0 ? 7 : -7);
</script>

<g
	class="cat"
	class:calm
	class:purring={purr > 0.1}
	data-motion={motion}
	style:--lean="{lean}deg"
	style:--shake="{(1.6 + purr * 3.6).toFixed(2)}px"
>
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
		{#if possessed}
			<ellipse class="shadow" cx="0" cy="70" rx="38" ry="8" fill="#000" opacity="0.4" />
		{/if}
		<g class="hover" class:floating={possessed}>
			{#if possessed}
				<!-- The dark aura of the spirit that has taken the cat -->
				<g class="aura" aria-hidden="true">
					<ellipse cx="0" cy="8" rx="66" ry="92" fill="#7a1fd6" opacity="0.22" />
					<path
						d="M-52 44 q-18 -34 2 -62 q-2 28 16 40 z M50 40 q16 -30 -2 -56 q-1 26 -16 38 z M-8 -88 q-12 -22 6 -40 q0 20 12 30 z"
						fill="#b24bff"
						opacity="0.55"
					/>
				</g>
			{/if}
			<g class="figure">
				<g class="life">
					<!-- Tail first, so the body sits on top of it -->
					<path
						class="tail"
						style:transform-origin={fat ? '48px 46px' : '34px 44px'}
						d={fat ? 'M48 46 C 88 54, 98 8, 74 -14' : 'M34 44 C 74 50, 84 6, 62 -16'}
						fill="none"
						stroke={colors.fur}
						stroke-width="13"
						stroke-linecap="round"
					/>
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

						<!-- Eyes: open, wide when staring, shut when dozing, red when possessed, lit up in the finale -->
						{#if asleep}
							<path
								d="M-20 -38 q7 6 14 0 M6 -38 q7 6 14 0"
								fill="none"
								stroke={colors.shade}
								stroke-width="3.5"
								stroke-linecap="round"
							/>
						{:else}
							<g class="eyes" filter={eyes > 0.05 || possessed ? 'url(#eye-glow)' : undefined}>
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
									<ellipse
										cx="-13"
										cy="-38"
										rx={motion === 'hiss' ? 1.5 : 2.6}
										ry="7"
										fill="#111"
									/>
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
		{:else}
			<!-- Not warmed up yet: the name is still a secret -->
			<g aria-hidden="true" opacity="0.6">
				<rect
					x="-22"
					y="64"
					width="44"
					height="26"
					rx="8"
					fill="#f3e3b5"
					fill-opacity="0.15"
					stroke="#f3e3b5"
					stroke-width="2.5"
					stroke-dasharray="6 5"
				/>
				<text
					x="0"
					y="84"
					text-anchor="middle"
					fill="#f3e3b5"
					font-size="19"
					font-weight="700"
					style:font-family="var(--font-riddle)">?</text
				>
			</g>
		{/if}

		<!-- How happy the cat is: the first heart brings out its name, the second its pitch -->
		<g aria-hidden="true">
			{#each Array.from({ length: MAX_HEARTS }, (_, slot) => slot) as slot (slot)}
				<text
					x={-40 + slot * 40}
					y="146"
					text-anchor="middle"
					font-size="42"
					fill={slot < hearts ? '#d0143c' : 'rgb(255 255 255 / 0.1)'}
					stroke={slot < hearts ? '#4a0510' : '#e9d3ff'}
					stroke-opacity={slot < hearts ? 1 : 0.55}
					stroke-width="1.6">♥</text
				>
			{/each}
		</g>
		{#if cat.pitchShown}
			<g class="gauge" aria-hidden="true">
				{#each [0, 1, 2, 3, 4] as rank (rank)}
					<rect
						x={68 + rank * 11}
						y={146 - (rank + 1) * 5 - 2}
						width="8"
						height={(rank + 1) * 5 + 2}
						rx="2"
						fill={rank === cat.profile.purrRank ? '#ffd45e' : '#5b4a78'}
						stroke="#1b0f2a"
						stroke-width="1.5"
					/>
				{/each}
			</g>
		{/if}

		{#if step !== null}
			<!-- Where this cat came in the star, so the finished part of the riddle can be followed -->
			<g aria-hidden="true">
				<circle cx="-62" cy="-64" r="19" fill="#ffd45e" stroke="#4a2c14" stroke-width="3.5" />
				<text x="-62" y="-56" text-anchor="middle" fill="#3b2414" font-size="24" font-weight="700"
					>{step}</text
				>
			</g>
		{/if}
	</g>
</g>

<style>
	/* Where the cat has wandered off to: each new target is chased smoothly, so a cat that follows
	   the laser dot glides after it instead of jumping */
	.away {
		transition: transform 450ms ease-out;
	}

	.figure {
		transform-origin: 0 40px;
		transform-box: view-box;
		transition:
			transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 380ms ease;
	}

	/* The cat is always a little alive: it breathes, and its tail sways */
	.life {
		transform-origin: 0 60px;
		transform-box: view-box;
		animation: breathe 3.4s ease-in-out infinite;
	}

	.tail {
		transform-box: view-box;
		animation: sway 2.4s ease-in-out infinite alternate;
	}

	.head {
		transform-origin: 0 -10px;
		transform-box: view-box;
		transition: transform 500ms ease-in-out;
	}

	.shadow {
		transform-box: fill-box;
		transform-origin: center;
		animation: shadow 2.8s ease-in-out infinite;
	}

	.hover.floating {
		animation: hover 2.8s ease-in-out infinite;
	}

	.aura {
		transform-origin: 0 10px;
		transform-box: view-box;
		animation: aura 1.1s ease-in-out infinite alternate;
	}

	/* A purring cat trembles all over, the more the louder it purrs */
	.cat.purring .life {
		animation: purr 75ms linear infinite alternate;
	}

	.cat.purring .head {
		animation: purr-head 150ms ease-in-out infinite alternate;
	}

	/* Hiding under the rug: small, low and half there, shivering */
	.cat[data-motion='hide'] .figure {
		transform: translateY(44px) scale(0.6);
		opacity: 0.45;
	}

	.cat[data-motion='hide'] .life {
		animation: shiver 110ms linear infinite alternate;
	}

	/* Hissing: back arched, puffed up, tail bristling */
	.cat[data-motion='hiss'] .figure {
		transform: scale(1.12, 1.06);
	}

	.cat[data-motion='hiss'] .life {
		animation: puff 140ms ease-in-out infinite alternate;
	}

	.cat[data-motion='hiss'] .ears {
		transform: translateY(8px) scaleY(0.6);
		transform-origin: 0 -60px;
	}

	.cat[data-motion='hiss'] .tail {
		stroke-width: 22px;
		animation: none;
		transform: rotate(-18deg);
	}

	.cat[data-motion='flinch'] .figure {
		animation: flinch 700ms ease-out;
	}

	/* Running after the dot: leaning into the run, bouncing, tail whipping about */
	.cat[data-motion='chase'] .figure {
		transform: scale(0.92) rotate(var(--lean));
	}

	.cat[data-motion='chase'] .life {
		animation: run 260ms ease-in-out infinite alternate;
	}

	.cat[data-motion='chase'] .tail {
		animation-duration: 260ms;
	}

	/* Staring: crouched forward, fixed on the dot */
	.cat[data-motion='stare'] .life {
		animation: lean 1.4s ease-in-out infinite alternate;
	}

	/* Dozing: head drooping, breathing slow and deep */
	.cat[data-motion='doze'] .figure {
		transform: translateY(6px) scale(0.97);
	}

	.cat[data-motion='doze'] .head {
		transform: translateY(8px) rotate(11deg);
	}

	.cat[data-motion='doze'].purring .head {
		animation: none;
	}

	.cat[data-motion='doze'] .life {
		animation: breathe 4.6s ease-in-out infinite;
	}

	.cat[data-motion='doze'] .tail {
		animation-duration: 6s;
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

	.tag {
		animation: pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
		transform-origin: 0 77px;
	}

	@keyframes breathe {
		0%,
		100% {
			transform: scale(1, 1);
		}
		50% {
			transform: scale(1.012, 1.03);
		}
	}

	@keyframes sway {
		from {
			transform: rotate(-6deg);
		}
		to {
			transform: rotate(7deg);
		}
	}

	@keyframes purr {
		from {
			transform: translate(calc(var(--shake) * -1), 0) rotate(-0.7deg);
		}
		to {
			transform: translate(var(--shake), calc(var(--shake) * 0.35)) rotate(0.7deg);
		}
	}

	@keyframes purr-head {
		from {
			transform: translateY(calc(var(--shake) * -0.3)) rotate(-1.2deg);
		}
		to {
			transform: translateY(calc(var(--shake) * 0.3)) rotate(1.2deg);
		}
	}

	@keyframes shiver {
		from {
			transform: translateX(-2.5px);
		}
		to {
			transform: translateX(2.5px);
		}
	}

	@keyframes puff {
		from {
			transform: scale(1, 1);
		}
		to {
			transform: scale(1.04, 0.97);
		}
	}

	@keyframes run {
		from {
			transform: translateY(0) scale(1.03, 0.96);
		}
		to {
			transform: translateY(-16px) scale(0.97, 1.04);
		}
	}

	@keyframes lean {
		from {
			transform: translateY(0) scale(1);
		}
		to {
			transform: translateY(-5px) scale(1.04);
		}
	}

	@keyframes hover {
		0%,
		100% {
			transform: translateY(-4px);
		}
		50% {
			transform: translateY(-16px);
		}
	}

	@keyframes shadow {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.4;
		}
		50% {
			transform: scale(0.8);
			opacity: 0.25;
		}
	}

	@keyframes aura {
		from {
			transform: scale(0.96);
			opacity: 0.75;
		}
		to {
			transform: scale(1.06);
			opacity: 1;
		}
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
	.cat.calm .away,
	.cat.calm .figure,
	.cat.calm .head {
		transition: none;
	}

	.cat.calm .figure,
	.cat.calm .life,
	.cat.calm .head,
	.cat.calm .tail,
	.cat.calm .shadow,
	.cat.calm .hover,
	.cat.calm .aura,
	.cat.calm .eye,
	.cat.calm .spiral,
	.cat.calm .zzz,
	.cat.calm .bang,
	.cat.calm .tag {
		animation: none;
	}
</style>
