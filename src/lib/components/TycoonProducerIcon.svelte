<!-- The lucide icon that stands for each producer of the oil tycoon -->
<script lang="ts">
	import type { ProducerId } from '#lib/game/tycoon/config.js';
	import IconDrill from '~icons/lucide/drill';
	import IconFactory from '~icons/lucide/factory';
	import IconGhost from '~icons/lucide/ghost';
	import IconBriefcase from '~icons/lucide/briefcase';
	import IconLandmark from '~icons/lucide/landmark';
	import IconHandshake from '~icons/lucide/handshake';
	import IconShip from '~icons/lucide/ship';
	import IconSnowflake from '~icons/lucide/snowflake';
	import IconStamp from '~icons/lucide/stamp';
	import IconWaves from '~icons/lucide/waves';

	let { id, class: className = '' }: { id: ProducerId; class?: string } = $props();
</script>

{#if id === 'pumpjack'}
	<IconDrill class={className} aria-hidden="true" />
{:else if id === 'tanker'}
	<IconShip class={className} aria-hidden="true" />
{:else if id === 'refinery'}
	<IconFactory class={className} aria-hidden="true" />
{:else if id === 'lobbyist'}
	<IconBriefcase class={className} aria-hidden="true" />
{:else if id === 'shadowfleet'}
	<IconGhost class={className} aria-hidden="true" />
{:else if id === 'paperwork'}
	<IconStamp class={className} aria-hidden="true" />
{:else if id === 'summit'}
	<IconLandmark class={className} aria-hidden="true" />
{:else if id === 'offshore'}
	<IconWaves class={className} aria-hidden="true" />
{:else if id === 'cartel'}
	<IconHandshake class={className} aria-hidden="true" />
{:else}
	<IconSnowflake class={className} aria-hidden="true" />
{/if}
