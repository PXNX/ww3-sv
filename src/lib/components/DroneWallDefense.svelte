<!--
	Small cartoon icons for the Drone Wall build menu: the twelve defenses, the two powers and the
	Soviet helmet that pays for them. Original shapes with thick ink outlines; the squad's patch is a
	generic round badge. An elite defense (tier 1 to 3) is drawn darker with a gold ring and a rank
	badge of one to three stars in the corner.
-->
<script lang="ts">
	import type { DefenseKind, PowerKind } from '#lib/game/dronewall/config.js';

	let {
		kind,
		elite = 0,
		class: className = 'size-8'
	}: {
		kind: DefenseKind | PowerKind | 'helmet';
		/** 0 or undefined for a normal defense, 1 to 3 for the elite tier */
		elite?: number;
		class?: string;
	} = $props();

	const uid = $props.id();
	const tier = $derived(Math.max(0, Math.min(3, Math.floor(elite ?? 0))));

	/** The points of a five-pointed star centred on (cx, cy) */
	function star(cx: number, cy: number, outer: number, inner: number): string {
		return Array.from({ length: 10 }, (_, i) => {
			const radius = i % 2 === 0 ? outer : inner;
			const angle = -Math.PI / 2 + (i * Math.PI) / 5;
			return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
		}).join(' ');
	}
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
	{#if tier > 0}
		<defs>
			<filter id="dw-tint-{uid}" color-interpolation-filters="sRGB">
				<feColorMatrix type="matrix" values="0.62 0 0 0 0  0 0.62 0 0 0  0 0 0.68 0 0  0 0 0 1 0" />
			</filter>
		</defs>
	{/if}
	<g filter={tier > 0 ? `url(#dw-tint-${uid})` : undefined}>
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
		{:else if kind === 'azov'}
			<ellipse cx="16" cy="27" rx="13" ry="4" fill="#cdbb7e" />
			<path d="M23 15l5.5-7" stroke-width="4.4" />
			<path d="M23 15l5.5-7" stroke="#9a7b4f" stroke-width="2.2" />
			<ellipse cx="14" cy="19" rx="9" ry="9.5" fill="var(--color-flag-blue)" />
			<path d="M5 15a9 7 0 0 1 18 0z" fill="#4d5a38" />
			<circle cx="10.5" cy="17" r="1.6" fill="var(--color-paper)" stroke-width="1.2" />
			<circle cx="17.5" cy="17" r="1.6" fill="var(--color-paper)" stroke-width="1.2" />
			<rect
				x="5"
				y="22"
				width="18"
				height="3"
				fill="var(--color-explosion-yellow)"
				stroke-width="1.5"
			/>
		{:else if kind === 'leopard'}
			<ellipse cx="16" cy="28" rx="14" ry="3" fill="#cdbb7e" />
			<rect x="2.5" y="19" width="27" height="8" rx="4" fill="#2f343b" />
			<circle cx="8" cy="23" r="1.6" fill="#6b727c" stroke-width="0" />
			<circle cx="13" cy="23" r="1.6" fill="#6b727c" stroke-width="0" />
			<circle cx="19" cy="23" r="1.6" fill="#6b727c" stroke-width="0" />
			<circle cx="24" cy="23" r="1.6" fill="#6b727c" stroke-width="0" />
			<rect x="5" y="14" width="22" height="8" rx="2.5" fill="#5f6a4a" />
			<rect x="19" y="10.5" width="12" height="3.4" fill="#3b4048" />
			<ellipse cx="14" cy="11" rx="8" ry="5.2" fill="#6c7858" />
			<circle cx="11.5" cy="8.3" r="2.8" fill="var(--color-flag-blue)" stroke-width="1.5" />
		{:else if kind === 'himars'}
			<ellipse cx="16" cy="28" rx="14" ry="3.4" fill="#cdbb7e" />
			<rect x="2.5" y="20" width="27" height="7" rx="2.5" fill="#5f6a3e" />
			<rect x="20" y="14" width="9" height="9" rx="2" fill="#6c7a47" />
			<rect x="23" y="16" width="4.5" height="3.4" rx="1" fill="#9fc4d6" stroke-width="1.2" />
			<circle cx="7.5" cy="27" r="2.6" fill="#2f343b" stroke-width="1.5" />
			<circle cx="15" cy="27" r="2.6" fill="#2f343b" stroke-width="1.5" />
			<circle cx="24" cy="27" r="2.6" fill="#2f343b" stroke-width="1.5" />
			<g transform="rotate(-36 9 19)">
				<rect x="4" y="12.5" width="21" height="10" rx="1.6" fill="#566033" />
				<rect x="5.6" y="13.8" width="5.4" height="3.4" rx="1.4" fill="#e8e4d0" stroke-width="1" />
				<rect x="12" y="13.8" width="5.4" height="3.4" rx="1.4" fill="#e8e4d0" stroke-width="1" />
				<rect
					x="18.4"
					y="13.8"
					width="5"
					height="3.4"
					rx="1.4"
					fill="var(--color-tie-red)"
					stroke-width="1"
				/>
				<rect x="5.6" y="18" width="5.4" height="3.4" rx="1.4" fill="#e8e4d0" stroke-width="1" />
				<rect x="12" y="18" width="5.4" height="3.4" rx="1.4" fill="#e8e4d0" stroke-width="1" />
				<rect
					x="18.4"
					y="18"
					width="5"
					height="3.4"
					rx="1.4"
					fill="var(--color-tie-red)"
					stroke-width="1"
				/>
			</g>
		{:else if kind === 'sniper'}
			<path d="M10 20.5L30 10" stroke-width="4.6" />
			<path d="M10 20.5L30 10" stroke="#3b4048" stroke-width="2.4" />
			<rect
				x="17"
				y="11.6"
				width="6"
				height="3"
				rx="1"
				fill="#2f343b"
				stroke-width="1.4"
				transform="rotate(-28 20 13)"
			/>
			<ellipse cx="11" cy="21.5" rx="8.5" ry="5.5" fill="#5f7a3a" />
			<ellipse cx="7" cy="19.5" rx="2.6" ry="1.8" fill="#7a9a4a" stroke-width="1.2" />
			<circle cx="15.5" cy="15.5" r="5.2" fill="var(--color-flag-blue)" />
			<path d="M10.3 14.6a5.2 4.4 0 0 1 10.4 0z" fill="#4d5a38" />
			<circle cx="17.6" cy="16.6" r="1.5" fill="var(--color-paper)" stroke-width="1.1" />
			<ellipse cx="6" cy="27" rx="6" ry="3.6" fill="#cdbb7e" />
			<ellipse cx="16" cy="28" rx="6" ry="3.4" fill="#cdbb7e" />
			<ellipse cx="26" cy="27" rx="5.6" ry="3.6" fill="#cdbb7e" />
		{:else if kind === 'jammer'}
			<ellipse cx="16" cy="9" rx="10" ry="6" stroke="#46d9e8" stroke-width="1.8" />
			<ellipse
				cx="16"
				cy="9"
				rx="14.2"
				ry="8.4"
				stroke="#6ef07a"
				stroke-width="1.5"
				opacity="0.8"
			/>
			<ellipse cx="16" cy="28" rx="13" ry="3.6" fill="#cdbb7e" />
			<rect x="5" y="21" width="22" height="7" rx="2.2" fill="#6f7d6a" />
			<path d="M16 21V10" stroke-width="3.8" />
			<path d="M16 21V10" stroke="#9aa0a8" stroke-width="1.6" />
			<path d="M7.5 21L5 12M24.5 21L27 14" stroke-width="1.6" />
			<rect x="9.5" y="7" width="13" height="3.6" rx="1.8" fill="#d9d6c3" />
			<circle cx="8.5" cy="24.5" r="1.3" fill="#6ef07a" stroke-width="0" />
			<path d="M13 24.5h9" stroke-opacity="0.4" stroke-width="1.4" />
		{:else if kind === 'gepard'}
			<ellipse cx="16" cy="29" rx="14" ry="2.6" fill="#cdbb7e" />
			<rect x="2.5" y="21.5" width="27" height="6.5" rx="3.2" fill="#2f343b" />
			<circle cx="8" cy="24.8" r="1.4" fill="#6b727c" stroke-width="0" />
			<circle cx="13.5" cy="24.8" r="1.4" fill="#6b727c" stroke-width="0" />
			<circle cx="19" cy="24.8" r="1.4" fill="#6b727c" stroke-width="0" />
			<circle cx="24.5" cy="24.8" r="1.4" fill="#6b727c" stroke-width="0" />
			<rect x="4.5" y="16.5" width="23" height="6.2" rx="2" fill="#6c7358" />
			<path d="M8 11.5V6.5" stroke-width="1.8" />
			<ellipse cx="8" cy="6" rx="4" ry="1.8" fill="#d9d6c3" stroke-width="1.6" />
			<g transform="rotate(-24 14 14)">
				<rect x="15" y="9.8" width="16" height="2.5" fill="#3b4048" stroke-width="1.5" />
				<rect x="15" y="14.4" width="16" height="2.5" fill="#3b4048" stroke-width="1.5" />
				<rect x="28" y="9" width="3" height="4.1" fill="#555c66" stroke-width="1.3" />
				<rect x="28" y="13.6" width="3" height="4.1" fill="#555c66" stroke-width="1.3" />
			</g>
			<ellipse cx="14" cy="15" rx="8" ry="5.2" fill="#7a8360" />
			<circle cx="11.8" cy="12.6" r="2.4" fill="var(--color-flag-blue)" stroke-width="1.4" />
		{:else if kind === 'pion'}
			<ellipse cx="16" cy="29" rx="14" ry="2.6" fill="#cdbb7e" />
			<rect x="1.5" y="22" width="29" height="5.8" rx="2.9" fill="#2f343b" />
			<circle cx="7" cy="25" r="1.3" fill="#6b727c" stroke-width="0" />
			<circle cx="12.5" cy="25" r="1.3" fill="#6b727c" stroke-width="0" />
			<circle cx="18" cy="25" r="1.3" fill="#6b727c" stroke-width="0" />
			<circle cx="23.5" cy="25" r="1.3" fill="#6b727c" stroke-width="0" />
			<rect x="3" y="17" width="26" height="6" rx="2" fill="#6c7358" />
			<rect x="3" y="11.5" width="10" height="6.5" rx="1.5" fill="#59604d" />
			<rect x="5" y="13" width="5" height="2.8" fill="#9fc4d6" stroke-width="1.1" />
			<g transform="rotate(-26 12 16)">
				<rect x="8" y="14.2" width="12" height="4.6" rx="1.2" fill="#4a4f57" stroke-width="1.6" />
				<rect x="17" y="14.8" width="11" height="3.4" fill="#3b4048" stroke-width="1.6" />
				<rect x="26" y="13.7" width="4.4" height="5.6" fill="#555c66" stroke-width="1.5" />
			</g>
		{:else if kind === 'airstrike'}
			<path d="M18 11L8 2H5l4.5 9z" fill="#7d8b9b" />
			<path d="M18 15L8 24H5l4.5-9z" fill="#7d8b9b" />
			<path
				d="M5.5 11.4L2.4 7H1l1.8 5zM5.5 14.6L2.4 19H1l1.8-5z"
				fill="#7d8b9b"
				stroke-width="1.5"
			/>
			<ellipse cx="14.5" cy="13" rx="12" ry="3.3" fill="#9aa7b6" />
			<path d="M24 10.6L31.5 13L24 15.4z" fill="#9aa7b6" />
			<ellipse cx="19.5" cy="13" rx="3.6" ry="1.8" fill="#9fe0ff" stroke-width="1.5" />
			<circle cx="11.5" cy="6.6" r="1.7" fill="var(--color-flag-blue)" stroke-width="1" />
			<circle cx="11.5" cy="19.4" r="1.7" fill="var(--color-flag-blue)" stroke-width="1" />
			<ellipse cx="19" cy="27" rx="5" ry="2.5" fill="#4b5320" stroke-width="1.8" />
			<path d="M14.5 27l-3.2-2.4M14.5 27l-3.2 2.4" stroke-width="1.6" />
			<path d="M19 24.6v4.8" stroke="var(--color-explosion-yellow)" stroke-width="1.8" />
		{:else if kind === 'stormshadow'}
			<g transform="rotate(-38 16 16)">
				<ellipse cx="3.6" cy="16" rx="4.2" ry="2.3" fill="#ff9a2e" stroke-width="1.5" />
				<path d="M13 13.4L8.5 5.6H6.2l3.2 7.8z" fill="#8d99a8" stroke-width="1.7" />
				<path d="M13 18.6L8.5 26.4H6.2l3.2-7.8z" fill="#8d99a8" stroke-width="1.7" />
				<path
					d="M7 13.6L5.4 10H3.8l1.4 4zM7 18.4L5.4 22H3.8l1.4-4z"
					fill="#8d99a8"
					stroke-width="1.4"
				/>
				<rect x="5" y="13" width="20" height="6" rx="3" fill="#d8dce2" />
				<path d="M25 13L31.6 16L25 19z" fill="#3a3f48" stroke-width="1.8" />
				<rect
					x="13"
					y="13.6"
					width="2.6"
					height="4.8"
					fill="var(--color-flag-blue)"
					stroke-width="0"
				/>
				<rect
					x="15.6"
					y="13.6"
					width="2.6"
					height="4.8"
					fill="var(--color-explosion-yellow)"
					stroke-width="0"
				/>
			</g>
		{:else}
			<rect x="3" y="13" width="26" height="12" rx="5" fill="#6f5b3d" />
			<path d="M7 20l4-3 5 3 5-3 4 3" stroke-opacity="0.45" />
			<ellipse cx="8" cy="11" rx="5.5" ry="3.3" fill="#cdbb7e" />
			<ellipse cx="18" cy="10.5" rx="5.5" ry="3.3" fill="#cdbb7e" />
			<ellipse cx="26" cy="12" rx="4" ry="3" fill="#cdbb7e" />
			<circle cx="9" cy="28" r="2.6" fill="var(--color-tie-red)" stroke-width="1.5" />
			<circle cx="23" cy="28" r="2.6" fill="var(--color-tie-red)" stroke-width="1.5" />
		{/if}
	</g>
	{#if tier > 0}
		<!-- The elite look: a gold ring round the icon and a rank plate with one to three stars -->
		<circle cx="16" cy="16" r="15" stroke="#f0b82a" stroke-width="1.4" stroke-dasharray="3 2" />
		<rect
			x="15.5"
			y="0.5"
			width="16"
			height="8.5"
			rx="4.2"
			fill="#17181c"
			stroke="#f0b82a"
			stroke-width="1.4"
		/>
		{#each [0, 1, 2] as i (i)}
			<polygon
				points={star(19.9 + i * 4.8, 4.9, 2.4, 1.05)}
				fill={i < tier ? '#f0b82a' : '#4a4d55'}
				stroke-width="0.6"
			/>
		{/each}
	{/if}
</svg>
