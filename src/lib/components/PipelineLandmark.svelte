<!--
	Generic placeholder art for the pumping station (above the grid, pipe pointing down into it)
	and the export terminal (below the grid, pipe coming down from it). No names, no flags.
	While oil flows, the pump wheel turns, oil runs through the stub, and the terminal's tank
	collects it: its oil level follows the tanker that is filling up.
-->
<script lang="ts">
	let {
		kind,
		active,
		label,
		level = 0,
		reducedMotion = false
	}: {
		kind: 'station' | 'terminal';
		active: boolean;
		label: string;
		/** Terminal only: how full the tank is, from 0 to 1 */
		level?: number;
		reducedMotion?: boolean;
	} = $props();

	const pipeFill = $derived(active ? '#2b2f36' : '#ffffff');
	const moving = $derived(active && !reducedMotion);
	// The tank interior runs from y=84 (floor) up to about y=44 (where the roof curves in)
	const surface = $derived(84 - Math.min(Math.max(level, 0), 1) * 38);
</script>

<svg viewBox="0 0 100 100" class="size-full" role="img" aria-label={label}>
	<g stroke="#111111" stroke-width="5" stroke-linejoin="round">
		{#if kind === 'station'}
			<!-- Pipe stub leading down into the first tile -->
			<rect x="38" y="62" width="24" height="38" fill={pipeFill} />
			<!-- Pump house with a big pump wheel -->
			<path d="M10 66 V30 L50 8 L90 30 V66 Z" fill="#7c8c5c" />
			<circle cx="50" cy="42" r="16" fill="#e8e1bc" />
			<g class="spin" class:running={moving}>
				<path d="M50 26 V58 M34 42 H66" stroke-width="4" />
			</g>
			<circle cx="50" cy="42" r="5" fill="#111111" />
			{#if active}
				<line
					x1="50"
					y1="64"
					x2="50"
					y2="100"
					class="beads"
					class:moving
					stroke="#ddb93c"
					stroke-width="7"
					stroke-linecap="round"
					stroke-dasharray="0.1 16"
				/>
			{/if}
		{:else}
			<defs>
				<clipPath id="pipeline-tank-clip">
					<path d="M16 84 V44 Q50 28 84 44 V84 Z" />
				</clipPath>
			</defs>
			<rect x="38" y="0" width="24" height="36" fill={pipeFill} />
			<!-- Squat storage tank on a jetty -->
			<rect x="4" y="84" width="92" height="12" fill="#ddb93c" />
			<path d="M16 84 V44 Q50 28 84 44 V84 Z" fill="#ffffff" />
			<g clip-path="url(#pipeline-tank-clip)" stroke="none">
				<!-- Oil level with a rippling surface -->
				<rect x="0" y={surface + 3} width="100" height="90" fill="#2b2f36" />
				<g class="ripple" class:running={moving} style:translate="0 {surface}px">
					<path
						d="M-24 3 Q-18 -2 -12 3 T0 3 T12 3 T24 3 T36 3 T48 3 T60 3 T72 3 T84 3 T96 3 T108 3 V10 H-24 Z"
						fill="#2b2f36"
					/>
				</g>
			</g>
			<path d="M16 44 Q50 60 84 44" fill="none" />
			{#if active}
				<line
					x1="50"
					y1="2"
					x2="50"
					y2="36"
					class="beads"
					class:moving
					stroke="#ddb93c"
					stroke-width="7"
					stroke-linecap="round"
					stroke-dasharray="0.1 16"
				/>
				<!-- Oil falling from the pipe into the tank -->
				{#each [0, 1, 2] as drop (drop)}
					<circle
						cx={44 + drop * 6}
						cy="40"
						r="2.6"
						fill="#2b2f36"
						stroke-width="1.5"
						class="drop"
						class:running={moving}
						style:animation-delay="{drop * 160}ms"
					/>
				{/each}
			{/if}
		{/if}
	</g>
</svg>

<style>
	.spin {
		transform-origin: 50px 42px;
	}

	.spin.running {
		animation: spin 1800ms linear infinite;
	}

	.beads.moving {
		animation: beads 600ms linear infinite;
	}

	.ripple.running {
		animation: ripple 1400ms linear infinite;
	}

	.drop {
		opacity: 0;
	}

	.drop.running {
		animation: drop 560ms ease-in infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	@keyframes beads {
		to {
			stroke-dashoffset: -16.1;
		}
	}

	/* One wave length is 24 units, so the loop is seamless */
	@keyframes ripple {
		to {
			transform: translateX(24px);
		}
	}

	@keyframes drop {
		0% {
			transform: translateY(-4px);
			opacity: 0.9;
		}
		100% {
			transform: translateY(26px);
			opacity: 0;
		}
	}
</style>
