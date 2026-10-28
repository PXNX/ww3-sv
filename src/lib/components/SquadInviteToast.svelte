<!--
	A squad invite that pops up wherever the player is, so a friend's call is not missed during
	another game. It stays quiet while a panel that lists invites itself is on screen (the start
	screen's friends panel, the raid lobby's squad strip). Meant to be mounted once in the root
	layout; it keeps the squad line open, and with it the player's presence, for the whole app.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { squad } from '#lib/stores/squad.svelte.js';
	import SquadInviteCard from './SquadInviteCard.svelte';

	const store = squad();

	onMount(() => {
		store.start();
		return () => store.stop();
	});

	const invite = $derived(
		store.availability === 'ready' && store.inviteSurfaces === 0
			? store.pendingInvites[0]
			: undefined
	);
	let notice = $state<string | null>(null);
</script>

{#if invite}
	<div
		class="pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3"
		aria-live="polite"
	>
		{#key invite.id}
			<div class="pointer-events-auto w-full max-w-sm" transition:fly={{ y: 40, duration: 200 }}>
				<SquadInviteCard {invite} onnotice={(text) => (notice = text)} />
				{#if notice}
					<p class="mt-1 text-center text-xs font-bold text-white drop-shadow">{notice}</p>
				{/if}
			</div>
		{/key}
	</div>
{/if}
