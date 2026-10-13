<!--
	The character that reacts on a result sheet: the game's host leader (the first entry of its
	`leaders` in the mode registry) in front of their flag, tilted one way for a win and the other
	for a loss. Renders nothing for a game that features no country. Replaces the old random mascot pose.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { modeById, type ModeId } from '#lib/modes/registry.js';
	import { CAMEO_PLACEHOLDER } from '#lib/theme/cameos.js';
	import { leaderById, leaderReaction } from '#lib/theme/leaders.js';

	let {
		mode,
		outcome,
		class: className = ''
	}: { mode: ModeId; outcome: 'won' | 'lost'; class?: string } = $props();

	const host = $derived(modeById(mode).leaders[0]);
	const leader = $derived(host ? leaderById(host) : undefined);

	let failed = $state(false);
	// The mascot picks one of several upset poses; roll it once per sheet, not on every render
	const seed = Math.random();
	const portrait = $derived(
		failed || !host ? CAMEO_PLACEHOLDER : leaderReaction(host, outcome, () => seed)
	);
</script>

{#if leader}
	<div class="pop-in relative shrink-0 {outcome === 'won' ? 'rotate-3' : '-rotate-3'} {className}">
		<img
			src={portrait}
			alt={failed ? m.cameo_placeholder_alt() : m.cameo_portrait_alt({ name: leader.name() })}
			class="aspect-square w-full rounded-lg border-3 border-ink object-cover shadow-[3px_3px_0_var(--color-ink)] {outcome ===
			'lost'
				? 'saturate-50'
				: ''}"
			style:background="url({leader.flag}) center / 100% 100%"
			draggable="false"
			onerror={() => (failed = true)}
		/>
	</div>
{/if}
