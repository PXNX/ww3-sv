<!--
	A small dismissible nudge to reload when a new version has been deployed. An installed app can
	stay open (or be resumed) for days and would otherwise keep showing the old game list. SvelteKit
	flags a new deployment when the app regains focus and on a poll interval (see vite.config.ts).
	Only shown on the start screen, because reloading mid-game would lose the run.
-->
<script lang="ts">
	import { updated } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import IconRefresh from '~icons/lucide/refresh-cw';
	import IconX from '~icons/lucide/x';

	let dismissed = $state(false);
</script>

{#if updated.current && !dismissed}
	<div
		class="sticker pop-in flex items-center justify-between gap-3 px-3 py-2 text-sm"
		style:--tilt="1deg"
		role="status"
	>
		<p class="font-semibold">{m.update_app_hint()}</p>
		<div class="flex shrink-0 items-center gap-2">
			<button type="button" class="btn-chunky px-3 py-1 text-sm" onclick={() => location.reload()}>
				<IconRefresh class="size-4" aria-hidden="true" />
				{m.update_app_button()}
			</button>
			<button
				type="button"
				class="btn-chunky px-2 py-1 text-sm"
				aria-label={m.update_app_dismiss()}
				onclick={() => (dismissed = true)}
			>
				<IconX class="size-4" aria-hidden="true" />
			</button>
		</div>
	</div>
{/if}
