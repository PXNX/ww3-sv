<!--
	Original cartoon ships for Tanker Parking, drawn as inline SVG on a 100-unit cell. The art is
	drawn lying down with the bow on the right; vertical ships rotate the same drawing upwards.
	The three kinds differ in shape, not just color: the tanker has round fuel tanks and a hazard
	stripe, the patrol boat a radar mast and a deck gun, the freighter a stack of containers.
-->
<script lang="ts" module>
	export type ShipKind = 'tanker' | 'patrol' | 'freighter';

	/** Hull colors for the ships that are not the tanker, from the design tokens */
	export const HULL_TONES = [
		'var(--color-flag-blue)',
		'var(--color-khaki)',
		'var(--color-mustard)',
		'var(--color-banner-slate)',
		'var(--color-skin)'
	] as const;

	/** Container colors on the freighter's deck */
	const BOXES = ['var(--color-tie-red)', 'var(--color-explosion-yellow)', 'var(--color-flag-blue)'];

	export function kindFor(length: number, isTanker: boolean): ShipKind {
		return isTanker ? 'tanker' : length >= 3 ? 'freighter' : 'patrol';
	}
</script>

<script lang="ts">
	let {
		kind,
		axis,
		length,
		tone = 0,
		class: className = ''
	}: {
		kind: ShipKind;
		axis: 'h' | 'v';
		length: number;
		/** Picks the hull color of patrol boats and freighters */
		tone?: number;
		class?: string;
	} = $props();

	const long = $derived(length * 100);
	const hull = $derived(
		kind === 'tanker' ? 'var(--color-tie-red)' : HULL_TONES[tone % HULL_TONES.length]
	);
	// A hull with a flat stern on the left and a rounded point on the right
	const hullPath = $derived(
		`M 12 20 H ${long - 40} Q ${long - 4} 50 ${long - 40} 80 H 12 Q 4 50 12 20 Z`
	);
	const viewBox = $derived(axis === 'h' ? `0 0 ${long} 100` : `0 0 100 ${long}`);
	const transform = $derived(axis === 'h' ? undefined : `translate(0 ${long}) rotate(-90)`);
</script>

<svg {viewBox} class={className} aria-hidden="true" focusable="false">
	<g {transform} stroke="var(--color-ink)" stroke-width="4" stroke-linejoin="round">
		<path d={hullPath} fill={hull} />
		{#if kind === 'tanker'}
			<!-- Hazard stripe along the deck, two round fuel tanks and the bridge at the stern -->
			<rect x="30" y="68" width={long - 100} height="8" fill="var(--color-explosion-yellow)" />
			<circle cx="92" cy="46" r="17" fill="var(--color-paper)" />
			<circle cx="136" cy="46" r="17" fill="var(--color-paper)" />
			<path d="M 92 38 q 6 8 0 14 q -6 -6 0 -14 Z" fill="var(--color-tie-red)" stroke-width="2" />
			<rect x="20" y="32" width="22" height="30" rx="3" fill="var(--color-sand)" />
			<rect x="26" y="38" width="10" height="7" fill="var(--color-sky)" stroke-width="2" />
		{:else if kind === 'patrol'}
			<rect x="26" y="34" width="36" height="28" rx="4" fill="var(--color-sand)" />
			<rect x="32" y="40" width="10" height="8" fill="var(--color-sky)" stroke-width="2" />
			<path d="M 44 34 V 18" fill="none" />
			<path d="M 38 18 H 50" fill="none" />
			<circle cx={long - 66} cy="50" r="9" fill="var(--color-ink)" />
			<path d="M {long - 66} 50 H {long - 44}" fill="none" stroke-width="5" />
		{:else}
			<rect x="18" y="32" width="26" height="36" rx="3" fill="var(--color-sand)" />
			<rect x="24" y="38" width="12" height="8" fill="var(--color-sky)" stroke-width="2" />
			{#each BOXES as color, step (step)}
				<rect x={54 + step * 62} y="30" width="54" height="40" fill={color} />
				<path
					d="M {54 + step * 62 + 18} 30 V 70 M {54 + step * 62 + 36} 30 V 70"
					stroke-width="2"
				/>
			{/each}
		{/if}
	</g>
</svg>
