<!--
	The dial, drawn as the roulette wheel from the "nothing ever happens" meme: a wooden bowl with a
	ring of pockets that are all grey NOTHING except the red SOMETHING at both ends of the needle's
	travel. The safe band is the wide NOTHING pocket at the top; the needle carries the ball and
	swings with the drift. In the middle a golden turret spins (still, with reduced motion). The
	gauge is drawn in a fixed viewBox and scales with its container.
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
		/** Pocket text for the grey pockets */
		nothingLabel: string;
		/** Pocket text for the two red pockets */
		somethingLabel: string;
		class?: string;
	} = $props();

	const CENTER = 100;
	/** Degrees of needle travel from the middle to either end of the dial */
	const SWEEP = 120;
	/** The ring of pockets, and the ring the ball rolls on (inside the pocket texts) */
	const POCKET_INNER = 54;
	const POCKET_OUTER = 86;
	const BALL_RADIUS = 62;
	/** Where the pocket texts sit: upright pockets read outward from here, flipped ones inward */
	const TEXT_BASE = 77.5;
	const TEXT_BASE_FLIPPED = 83.5;

	/** Angles are in degrees, clockwise from the top of the wheel */
	function point(angle: number, radius: number) {
		const radians = (angle * Math.PI) / 180;
		return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) };
	}

	const coord = (at: { x: number; y: number }) => `${at.x.toFixed(2)} ${at.y.toFixed(2)}`;

	/** The wedge between two angles and two radii */
	function wedge(from: number, to: number, inner: number, outer: number): string {
		return `M${coord(point(from, outer))} A${outer} ${outer} 0 0 1 ${coord(point(to, outer))} L${coord(point(to, inner))} A${inner} ${inner} 0 0 0 ${coord(point(from, inner))} Z`;
	}

	/** An arc the pocket text follows: clockwise for upright text, counter-clockwise for flipped */
	function textArc(from: number, to: number, radius: number, flipped: boolean): string {
		const start = coord(point(flipped ? to : from, radius));
		const end = coord(point(flipped ? from : to, radius));
		return `M${start} A${radius} ${radius} 0 0 ${flipped ? 0 : 1} ${end}`;
	}

	const bandAngle = BAND * SWEEP;
	const GREY_LIGHT = '#bcbcc4';
	const GREY_DARK = '#a2a2ad';
	const RED = '#e5484d';

	/** Around the wheel: SOMETHING at both ends of the needle's travel, NOTHING everywhere else */
	const pockets = [
		{ from: -SWEEP, to: -bandAngle, fill: RED, something: true },
		{ from: -bandAngle, to: bandAngle, fill: GREY_LIGHT, something: false },
		{ from: bandAngle, to: SWEEP, fill: RED, something: true },
		{ from: SWEEP, to: 160, fill: GREY_DARK, something: false },
		{ from: 160, to: 200, fill: GREY_LIGHT, something: false },
		{ from: 200, to: 360 - SWEEP, fill: GREY_DARK, something: false }
	].map((pocket, index) => {
		const middle = (pocket.from + pocket.to) / 2;
		const flipped = middle > 90 && middle < 270;
		return {
			...pocket,
			id: `cf-pocket-${index}`,
			flipped,
			shape: wedge(pocket.from, pocket.to, POCKET_INNER, POCKET_OUTER),
			textPath: textArc(pocket.from, pocket.to, flipped ? TEXT_BASE_FLIPPED : TEXT_BASE, flipped)
		};
	});

	/** Dividers between the pockets */
	const dividers = pockets.map(({ from }) => {
		const outer = point(from, POCKET_OUTER);
		const inner = point(from, POCKET_INNER);
		return { x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
	});

	const angle = $derived(Math.max(-1, Math.min(1, value)) * SWEEP);
</script>

<svg viewBox="0 0 200 200" role="img" aria-label={label} class={className}>
	<defs>
		{#each pockets as pocket (pocket.id)}
			<path id={pocket.id} d={pocket.textPath} />
		{/each}
	</defs>

	<!-- The wooden bowl with its golden rim -->
	<circle cx={CENTER} cy={CENTER} r="96" fill="#7a4a2c" stroke="#111" stroke-width="5" />
	<circle cx={CENTER} cy={CENTER} r="90" fill="none" stroke="#ddb93c" stroke-width="4" />
	<circle cx={CENTER} cy={CENTER} r="87.5" fill="#2b1a10" stroke="#111" stroke-width="1.5" />

	<!-- The pockets -->
	{#each pockets as pocket (pocket.id)}
		<path d={pocket.shape} fill={pocket.fill} stroke="none" />
	{/each}
	{#each dividers as divider, index (index)}
		<line {...divider} stroke="#ddb93c" stroke-width="2.5" stroke-linecap="round" />
	{/each}
	<circle cx={CENTER} cy={CENTER} r={POCKET_OUTER} fill="none" stroke="#111" stroke-width="2" />
	<circle
		cx={CENTER}
		cy={CENTER}
		r={POCKET_INNER}
		fill="#5b3a24"
		stroke="#111"
		stroke-width="2.5"
	/>
	<g
		font-family="Impact, 'Arial Narrow', sans-serif"
		font-size="8"
		font-weight="700"
		letter-spacing="0.6"
		text-anchor="middle"
		aria-hidden="true"
	>
		{#each pockets as pocket (pocket.id)}
			<text fill={pocket.something ? '#fff' : '#111'}>
				<textPath href="#{pocket.id}" startOffset="50%">
					{pocket.something ? somethingLabel : nothingLabel}
				</textPath>
			</text>
		{/each}
	</g>

	<!-- The golden turret in the middle of the wheel -->
	<g class="rotor" class:spin={spinning && !reducedMotion}>
		<circle cx={CENTER} cy={CENTER} r="24" fill="#8a5a3a" stroke="#111" stroke-width="3" />
		{#each [0, 120, 240] as turn (turn)}
			<g transform="rotate({turn} 100 100)">
				<line
					x1="100"
					y1="100"
					x2="100"
					y2="68"
					stroke="#111"
					stroke-width="7"
					stroke-linecap="round"
				/>
				<line
					x1="100"
					y1="100"
					x2="100"
					y2="68"
					stroke="#ddb93c"
					stroke-width="3"
					stroke-linecap="round"
				/>
				<circle cx="100" cy="66" r="5.5" fill="#ddb93c" stroke="#111" stroke-width="2.5" />
			</g>
		{/each}
	</g>

	<!-- The needle, with the ball rolling in the pockets at its tip -->
	<g transform="rotate({angle} 100 100)">
		<path
			d="M98.5 104 L100 44 L101.5 104 Z"
			fill="#ddb93c"
			stroke="#111"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<circle
			cx={CENTER}
			cy={CENTER - BALL_RADIUS}
			r="7.5"
			fill="#fff"
			stroke="#111"
			stroke-width="2.5"
		/>
		<circle cx="97.5" cy="35.5" r="2" fill="#cfd4dc" stroke="none" />
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
