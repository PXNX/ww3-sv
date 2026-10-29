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
	import IconWrench from '~icons/lucide/wrench';
	import IconRoute from '~icons/lucide/route';
	import IconBuilding from '~icons/lucide/building';
	import IconCog from '~icons/lucide/cog';
	import IconZap from '~icons/lucide/zap';
	import IconAnchor from '~icons/lucide/anchor';
	import IconWarehouse from '~icons/lucide/warehouse';
	import IconContainer from '~icons/lucide/container';
	import IconLayers from '~icons/lucide/layers';
	import IconConstruction from '~icons/lucide/construction';
	import IconMap from '~icons/lucide/map';
	import IconCompass from '~icons/lucide/compass';
	import IconRocket from '~icons/lucide/rocket';
	import IconSatellite from '~icons/lucide/satellite';
	import IconStar from '~icons/lucide/star';
	import IconSun from '~icons/lucide/sun';
	import IconMoon from '~icons/lucide/moon';
	import IconEarth from '~icons/lucide/earth';
	import IconGlobe from '~icons/lucide/globe';
	import IconSparkles from '~icons/lucide/sparkles';
	import IconBolt from '~icons/lucide/bolt';
	import IconDroplets from '~icons/lucide/droplets';
	import IconInfinity from '~icons/lucide/infinity';

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
{:else if id === 'arctic'}
	<IconSnowflake class={className} aria-hidden="true" />
{:else if id === 'driller'}
	<IconWrench class={className} aria-hidden="true" />
{:else if id === 'pipeline'}
	<IconRoute class={className} aria-hidden="true" />
{:else if id === 'wellhead'}
	<IconBuilding class={className} aria-hidden="true" />
{:else if id === 'valve'}
	<IconCog class={className} aria-hidden="true" />
{:else if id === 'drillbit'}
	<IconZap class={className} aria-hidden="true" />
{:else if id === 'rig'}
	<IconAnchor class={className} aria-hidden="true" />
{:else if id === 'platform'}
	<IconWarehouse class={className} aria-hidden="true" />
{:else if id === 'platform2'}
	<IconContainer class={className} aria-hidden="true" />
{:else if id === 'platform3'}
	<IconLayers class={className} aria-hidden="true" />
{:else if id === 'platform4'}
	<IconConstruction class={className} aria-hidden="true" />
{:else if id === 'platform5'}
	<IconMap class={className} aria-hidden="true" />
{:else if id === 'platform6'}
	<IconCompass class={className} aria-hidden="true" />
{:else if id === 'platform7'}
	<IconRocket class={className} aria-hidden="true" />
{:else if id === 'platform8'}
	<IconSatellite class={className} aria-hidden="true" />
{:else if id === 'platform9'}
	<IconStar class={className} aria-hidden="true" />
{:else if id === 'platform10'}
	<IconSun class={className} aria-hidden="true" />
{:else if id === 'platform11'}
	<IconMoon class={className} aria-hidden="true" />
{:else if id === 'platform12'}
	<IconEarth class={className} aria-hidden="true" />
{:else if id === 'platform13'}
	<IconGlobe class={className} aria-hidden="true" />
{:else if id === 'platform14'}
	<IconSparkles class={className} aria-hidden="true" />
{:else if id === 'platform15'}
	<IconBolt class={className} aria-hidden="true" />
{:else if id === 'platform16'}
	<IconDroplets class={className} aria-hidden="true" />
{:else if id === 'platform17'}
	<IconWrench class={className} aria-hidden="true" />
{:else if id === 'platform18'}
	<IconCog class={className} aria-hidden="true" />
{:else if id === 'platform19'}
	<IconZap class={className} aria-hidden="true" />
{:else if id === 'platform20'}
	<IconSnowflake class={className} aria-hidden="true" />
{:else if id === 'platform21'}
	<IconAnchor class={className} aria-hidden="true" />
{:else if id === 'platform22'}
	<IconRoute class={className} aria-hidden="true" />
{:else if id === 'platform23'}
	<IconBuilding class={className} aria-hidden="true" />
{:else if id === 'superplatform'}
	<IconStar class={className} aria-hidden="true" />
{:else if id === 'megaplatform'}
	<IconRocket class={className} aria-hidden="true" />
{:else if id === 'gigaplatform'}
	<IconSatellite class={className} aria-hidden="true" />
{:else if id === 'teraplatform'}
	<IconSun class={className} aria-hidden="true" />
{:else if id === 'exaplatform'}
	<IconMoon class={className} aria-hidden="true" />
{:else if id === 'zetaplatform'}
	<IconEarth class={className} aria-hidden="true" />
{:else if id === 'yottaplatform'}
	<IconGlobe class={className} aria-hidden="true" />
{:else if id === 'ultraplatform'}
	<IconSparkles class={className} aria-hidden="true" />
{:else if id === 'infinityplatform'}
	<IconInfinity class={className} aria-hidden="true" />
{:else if id === 'eternityplatform'}
	<IconSparkles class={className} aria-hidden="true" />
{:else}
	<IconSnowflake class={className} aria-hidden="true" />
{/if}
