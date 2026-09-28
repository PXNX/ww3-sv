<!--
	The Shahed Shootdown commander: an original, fictional muscular cartoon commander (not any real
	person) with three states. Shows the owner-supplied sprite once it is listed as supplied, and a
	generic flat silhouette drawn here until then.
-->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { shootdownAsset, type ShootdownAssetId } from '$lib/game/shootdown/assets';
	import type { CommanderPose } from '$lib/game/shootdown/shootdownStep';

	let { pose = 'pointing', class: className = '' }: { pose?: CommanderPose; class?: string } =
		$props();

	const ASSETS: Record<CommanderPose, ShootdownAssetId> = {
		pointing: 'commanderPointing',
		worried: 'commanderWorried',
		smug: 'commanderSmug'
	};

	const LABELS: Record<CommanderPose, () => string> = {
		pointing: m.shootdown_commander_pointing,
		worried: m.shootdown_commander_worried,
		smug: m.shootdown_commander_smug
	};

	let failed = $state<string | null>(null);
	const src = $derived(shootdownAsset(ASSETS[pose]));
	const label = $derived(LABELS[pose]());
</script>

{#snippet arm(d: string)}
	<!-- Thick outlined arm: a wide ink stroke under a narrower skin stroke -->
	<path {d} fill="none" stroke="#111111" stroke-width="15" stroke-linecap="round" />
	<path {d} fill="none" stroke="#f6c9a0" stroke-width="9" stroke-linecap="round" />
{/snippet}

{#if src && failed !== src}
	<img {src} alt={label} class={className} draggable="false" onerror={() => (failed = src)} />
{:else}
	<svg viewBox="0 0 90 110" role="img" aria-label={label} class={className}>
		<g stroke="#111111" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
			<!-- Legs and boots -->
			<path d="M32 78 L30 100 H42 L45 82 L48 100 H60 L58 78 Z" fill="#5f6d45" />
			<rect x="27" y="98" width="16" height="7" rx="2" fill="#111111" />
			<rect x="47" y="98" width="16" height="7" rx="2" fill="#111111" />

			<!-- Broad shoulders tapering to the belt -->
			<path d="M18 46 Q45 36 72 46 L62 80 H28 Z" fill="#7c8c5c" />
			<rect x="27" y="74" width="36" height="6" fill="#111111" />

			<!-- Arms, drawn per pose -->
			{#if pose === 'pointing'}
				{@render arm('M68 50 L80 30 L84 10')}
				{@render arm('M22 50 L14 64 L28 72')}
				<path d="M84 10 L85 3" stroke-width="5" />
			{:else if pose === 'worried'}
				{@render arm('M68 50 L80 36 L60 20')}
				{@render arm('M22 50 L16 66 L20 78')}
			{:else}
				{@render arm('M22 52 L20 62 L62 62')}
				{@render arm('M68 52 L70 60 L28 60')}
			{/if}

			<!-- Thick neck and square-jawed head -->
			<rect x="37" y="30" width="16" height="12" fill="#f6c9a0" />
			<rect x="31" y="10" width="28" height="28" rx="9" fill="#f6c9a0" />
			<!-- Plain cap without any insignia -->
			<path d="M29 18 Q45 2 61 18 Z" fill="#7c8c5c" />
			<path d="M27 18 H66" stroke-width="4" />

			<!-- Face -->
			{#if pose === 'worried'}
				<circle cx="39" cy="24" r="4.5" fill="#ffffff" stroke-width="2" />
				<circle cx="51" cy="24" r="4.5" fill="#ffffff" stroke-width="2" />
				<circle cx="39" cy="24" r="1.4" fill="#111111" stroke="none" />
				<circle cx="51" cy="24" r="1.4" fill="#111111" stroke="none" />
				<ellipse cx="45" cy="33" rx="3" ry="2" fill="#111111" stroke="none" />
			{:else if pose === 'smug'}
				<path d="M35 24 H42 M48 24 H55" stroke-width="2.5" />
				<path d="M39 32 Q46 36 52 30" fill="none" stroke-width="2.5" />
			{:else}
				<circle cx="39" cy="24" r="1.8" fill="#111111" stroke="none" />
				<circle cx="51" cy="24" r="1.8" fill="#111111" stroke="none" />
				<path d="M39 32 H51" stroke-width="2.5" />
			{/if}
		</g>
	</svg>
{/if}
