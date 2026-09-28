<!-- A small icon button that mutes or unmutes every sound effect, remembered across sessions. -->
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { soundManager } from '$lib/sound/soundManager.svelte';
	import IconVolume2 from '~icons/lucide/volume-2';
	import IconVolumeX from '~icons/lucide/volume-x';

	const sound = soundManager();
</script>

<button
	type="button"
	class="btn-chunky px-3 py-1 text-sm"
	aria-pressed={sound.muted}
	onclick={() => sound.toggleMuted()}
>
	{#if sound.muted}
		<IconVolumeX class="size-4" aria-hidden="true" />
	{:else}
		<IconVolume2 class="size-4" aria-hidden="true" />
	{/if}
	<span class="sr-only">{sound.muted ? m.sound_unmute() : m.sound_mute()}</span>
</button>
