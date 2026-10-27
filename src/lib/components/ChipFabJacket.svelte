<!--
	Jensen Huang of Novideo as a HUD reaction: a satirical tech-boss cartoon in a black leather jacket with
	three poses (cheers, neutral, sulks). All three images are in the page at once, so changing the
	pose never waits for a download; only the current one is shown.
-->
<script lang="ts">
	import { JACKET_POSES, jacketFile, type JacketPose } from '#lib/game/chipfab/jacket.js';
	import { m } from '#lib/paraglide/messages.js';
	import { cameoAsset } from '#lib/theme/cameos.js';

	let { pose, class: className = '' }: { pose: JacketPose; class?: string } = $props();

	const alt: Record<JacketPose, () => string> = {
		cheers: m.chipfab_jacket_alt_cheers,
		neutral: m.chipfab_jacket_alt_neutral,
		sulks: m.chipfab_jacket_alt_sulks
	};
</script>

<div class="relative {className}">
	{#each JACKET_POSES as option (option)}
		<img
			src={cameoAsset(jacketFile(option))}
			alt={option === pose ? alt[option]() : ''}
			aria-hidden={option === pose ? undefined : 'true'}
			class="size-full rounded-[10px_6px_9px_7px] border-2 border-ink object-cover"
			class:hidden={option !== pose}
			draggable="false"
		/>
	{/each}
</div>
