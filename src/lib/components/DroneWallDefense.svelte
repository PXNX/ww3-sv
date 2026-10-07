<!--
	Small cartoon icons for the Drone Wall build menu: the five defenses and the Soviet helmet that
	pays for them. Original shapes with thick ink outlines; the squad's patch is a generic round badge.
-->
<script lang="ts">
	import type { DefenseKind } from '#lib/game/dronewall/config.js';

	let {
		kind,
		class: className = 'size-8'
	}: {
		kind: DefenseKind | 'helmet';
		class?: string;
	} = $props();
</script>

<svg
	viewBox="0 0 32 32"
	class={className}
	fill="none"
	stroke="var(--color-ink)"
	stroke-width="2"
	stroke-linejoin="round"
	stroke-linecap="round"
	aria-hidden="true"
>
	{#if kind === 'helmet'}
		<path d="M5 20a11 10 0 0 1 22 0z" fill="#6f7d3c" />
		<rect x="2.5" y="19" width="27" height="4.5" rx="2.2" fill="#55612e" />
		<path
			d="M16 10.8l1 2.83 2.99.07-2.37 1.83.8 2.87L16 16.7l-2.42 1.7.8-2.87L12 13.7l2.99-.07z"
			fill="var(--color-tie-red)"
			stroke-width="1.2"
		/>
		<path d="M8.5 15a8 7 0 0 1 3-3.5" stroke="var(--color-paper)" stroke-width="1.6" />
	{:else if kind === 'squad'}
		<ellipse cx="16" cy="26" rx="13" ry="4.5" fill="#cdbb7e" />
		<ellipse cx="16" cy="19" rx="9" ry="9.5" fill="var(--color-flag-blue)" />
		<path d="M7 15a9 7 0 0 1 18 0z" fill="#4d5a38" />
		<circle cx="12.5" cy="17" r="1.6" fill="var(--color-paper)" stroke-width="1.2" />
		<circle cx="19.5" cy="17" r="1.6" fill="var(--color-paper)" stroke-width="1.2" />
		<circle cx="16" cy="23" r="3.6" fill="var(--color-paper)" stroke-width="1.5" />
		<path d="M14.4 24l1.6-2 1.6 2" stroke="var(--color-tie-red)" stroke-width="1.5" />
	{:else if kind === 'mortar'}
		<ellipse cx="16" cy="26" rx="13" ry="4.5" fill="#cdbb7e" />
		<ellipse cx="16" cy="24" rx="8" ry="3" fill="#4a4f57" />
		<g transform="rotate(-35 16 20)">
			<rect x="12" y="6" width="8" height="17" fill="#2f343b" />
			<rect x="10.5" y="4.5" width="11" height="4" fill="#555c66" />
		</g>
		<circle cx="6" cy="19" r="4" fill="var(--color-flag-blue)" />
	{:else if kind === 'nest'}
		<ellipse cx="16" cy="27" rx="13" ry="3.5" fill="#cdbb7e" />
		<rect x="6" y="19" width="20" height="8" fill="#9a7b4f" />
		<ellipse cx="6" cy="9" rx="5" ry="1.8" fill="var(--color-paper)" stroke-width="1.5" />
		<ellipse cx="26" cy="9" rx="5" ry="1.8" fill="var(--color-paper)" stroke-width="1.5" />
		<path d="M16 13L7 10M16 13l9-3" stroke-width="1.6" />
		<ellipse cx="16" cy="13" rx="6" ry="4" fill="#3b4048" />
		<circle cx="16" cy="13" r="1.5" fill="#6ef07a" stroke-width="0" />
	{:else if kind === 'patriot'}
		<ellipse cx="16" cy="27" rx="13" ry="3.8" fill="#cdbb7e" />
		<rect x="3" y="20" width="26" height="7" rx="2.5" fill="#55612e" />
		<circle cx="8" cy="27" r="2.4" fill="#2f343b" stroke-width="1.5" />
		<circle cx="24" cy="27" r="2.4" fill="#2f343b" stroke-width="1.5" />
		<g transform="rotate(-50 14 19)">
			<rect x="10" y="9" width="18" height="3" fill="#e8e4d0" stroke-width="1.5" />
			<rect x="10" y="12.5" width="18" height="3" fill="#e8e4d0" stroke-width="1.5" />
			<rect x="10" y="16" width="18" height="3" fill="#e8e4d0" stroke-width="1.5" />
			<rect x="10" y="19.5" width="18" height="3" fill="#e8e4d0" stroke-width="1.5" />
			<path d="M24 9v13.5" stroke="var(--color-tie-red)" stroke-width="2.4" />
		</g>
		<circle cx="6" cy="19" r="3.6" fill="var(--color-flag-blue)" />
	{:else}
		<rect x="3" y="13" width="26" height="12" rx="5" fill="#6f5b3d" />
		<path d="M7 20l4-3 5 3 5-3 4 3" stroke-opacity="0.45" />
		<ellipse cx="8" cy="11" rx="5.5" ry="3.3" fill="#cdbb7e" />
		<ellipse cx="18" cy="10.5" rx="5.5" ry="3.3" fill="#cdbb7e" />
		<ellipse cx="26" cy="12" rx="4" ry="3" fill="#cdbb7e" />
		<circle cx="9" cy="28" r="2.6" fill="var(--color-tie-red)" stroke-width="1.5" />
		<circle cx="23" cy="28" r="2.6" fill="var(--color-tie-red)" stroke-width="1.5" />
	{/if}
</svg>
