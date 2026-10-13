<!--
	The dial, drawn as the roulette wheel from the "nothing ever happens" meme: the safe band in the
	middle is the NOTHING pocket, both red ends are SOMETHING, and a ball rides on the tip of the
	needle as it swings with the drift. Behind the needle a golden turret spins (still, with
	reduced motion). The gauge is drawn in a fixed viewBox and scales with its container.
-->
<script lang="ts">
	import { BAND } from '#lib/game/centrifuge/config.js';

	let {
		value,
		spinning = true,
		reducedMotion = false,
		label,
		nothingLabel,
		somethingLabel,
		class: className = ''
	}: {
		/** Needle position, -1 to 1 */
		value: number;
		spinning?: boolean;
		reducedMotion?: boolean;
		label: string;
		/** Pocket text for the safe band */
		nothingLabel: string;
		/** Pocket text for the two red ends */
		somethingLabel: string;
		class?: string;
	} = $props();

	const CENTER = 100;
	const RADIUS = 70;
	/** Degrees of needle travel from the middle to either end of the dial */
	const SWEEP = 120;

	function point(angle: number, radius: number) {
		const radians = (angle * Math.PI) / 180;
		return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) };
	}

	/** An arc along the dial from one dial value to another (both -1..1) */
	function arc(from: number, to: number, radius = RADIUS): string {
		const start = point(from * SWEEP, radius);
		const end = point(to * SWEEP, radius);
		return `M${start.x.toFixed(2)} ${start.y.toFixed(2)} A${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
	}

	/** Pocket dividers across the track where one pocket ends and the next begins */
	const dividers = [-1, -BAND, BAND, 1].map((at) => {
		const outer = point(at * SWEEP, RADIUS + 8);
		const inner = point(at * SWEEP, RADIUS - 8);
		return { x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
	});

	const angle = $derived(Math.max(-1, Math.min(1, value)) * SWEEP);
</script>

<svg viewBox="0 0 200 200" role="img" aria-label={label} class={className}>
	<defs>
		<!-- Baselines for the pocket texts, on the rim just outside the track so the ball never covers them -->
		<path id="cf-pocket-left" d={arc(-1, -BAND, RADIUS + 9.5)} />
		<path id="cf-pocket-mid" d={arc(-BAND, BAND, RADIUS + 9.5)} />
		<path id="cf-pocket-right" d={arc(BAND, 1, RADIUS + 9.5)} />
	</defs>
	<circle cx={CENTER} cy={CENTER} r="96" fill="#fff" stroke="#111" stroke-width="5" />
	<circle cx={CENTER} cy={CENTER} r="88" fill="#e8e1bc" stroke="#111" stroke-width="2" />

	<!-- The track: SOMETHING in red at both ends, the NOTHING pocket in the middle -->
	<path d={arc(-1, -BAND)} fill="none" stroke="#e5484d" stroke-width="16" />
	<path d={arc(BAND, 1)} fill="none" stroke="#e5484d" stroke-width="16" />
	<path d={arc(-BAND, BAND)} fill="none" stroke="#a9bd7f" stroke-width="16" />
	<path d={arc(-1, 1, RADIUS + 8)} fill="none" stroke="#111" stroke-width="2.5" />
	<path d={arc(-1, 1, RADIUS - 8)} fill="none" stroke="#111" stroke-width="2.5" />
	{#each dividers as divider, index (index)}
		<line {...divider} stroke="#111" stroke-width="2.5" stroke-linecap="round" />
	{/each}
	<g
		font-family="Impact, 'Arial Narrow', sans-serif"
		font-size="8"
		font-weight="700"
		letter-spacing="0.6"
		text-anchor="middle"
		aria-hidden="true"
	>
		<text fill="#c0262b">
			<textPath href="#cf-pocket-left" startOffset="50%">{somethingLabel}</textPath>
		</text>
		<text fill="#111">
			<textPath href="#cf-pocket-mid" startOffset="50%">{nothingLabel}</textPath>
		</text>
		<text fill="#c0262b">
			<textPath href="#cf-pocket-right" startOffset="50%">{somethingLabel}</textPath>
		</text>
	</g>

	<!-- The golden turret in the middle of the wheel -->
	<g class="rotor" class:spin={spinning && !reducedMotion}>
		<circle cx={CENTER} cy={CENTER} r="26" fill="#8a5a3a" stroke="#111" stroke-width="3" />
		{#each [0, 120, 240] as turn (turn)}
			<g transform="rotate({turn} 100 100)">
				<line
					x1="100"
					y1="100"
					x2="100"
					y2="66"
					stroke="#111"
					stroke-width="7"
					stroke-linecap="round"
				/>
				<line
					x1="100"
					y1="100"
					x2="100"
					y2="66"
					stroke="#ddb93c"
					stroke-width="3"
					stroke-linecap="round"
				/>
				<circle cx="100" cy="64" r="6" fill="#ddb93c" stroke="#111" stroke-width="2.5" />
			</g>
		{/each}
	</g>

	<!-- The needle, with the ball riding on its tip -->
	<g transform="rotate({angle} 100 100)">
		<path
			d="M98.5 104 L100 38 L101.5 104 Z"
			fill="#111"
			stroke="#111"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<circle cx={CENTER} cy={CENTER - RADIUS} r="9" fill="#fff" stroke="#111" stroke-width="3" />
		<circle cx="97" cy="27.5" r="2.5" fill="#cfd4dc" stroke="none" />
		<circle cx={CENTER} cy={CENTER} r="9" fill="#ddb93c" stroke="#111" stroke-width="3" />
	</g>
</svg>

<style>
	.rotor {
		transform-box: view-box;
		transform-origin: 100px 100px;
	}

	.spin {
		animation: rotor-turn 1.6s linear infinite;
	}

	@keyframes rotor-turn {
		to {
			transform: rotate(360deg);
		}
	}
</style>
