<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { MASCOT_PLACEHOLDER, mascotImage, type MascotPose } from '$lib/theme/character';

	let { pose = 'idle', class: className = '' }: { pose?: MascotPose; class?: string } = $props();

	let failed = $state(false);
	const src = $derived(failed ? MASCOT_PLACEHOLDER : mascotImage(pose));
	const isPlaceholder = $derived(src === MASCOT_PLACEHOLDER);
</script>

<img
	{src}
	alt={isPlaceholder ? m.mascot_placeholder_alt() : ''}
	class={className}
	draggable="false"
	onerror={() => (failed = true)}
/>
