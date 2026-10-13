<!--
	The character that reacts on a result sheet: the game's host leader (the first entry of its
	`leaders` in the mode registry) in front of their flag, with a badge for whether the player won
	or lost. Replaces the old random mascot pose.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { modeById, type ModeId } from '#lib/modes/registry.js';
	import { CAMEO_PLACEHOLDER, CAMEOS, cameoFlag, reactionPortrait } from '#lib/theme/cameos.js';
	import IconPartyPopper from '~icons/fluent-emoji/party-popper';
	import IconSweat from '~icons/fluent-emoji/anxious-face-with-sweat';

	let {
		mode,
		outcome,
		class: className = ''
	}: { mode: ModeId; outcome: 'won' | 'lost'; class?: string } = $props();

	const host = $derived(modeById(mode).leaders[0]);
	const name = $derived(CAMEOS.find((cameo) => cameo.id === host)?.name() ?? '');

	let failed = $state(false);
	const portrait = $derived(failed ? CAMEO_PLACEHOLDER : reactionPortrait(host, outcome));
	const Badge = $derived(outcome === 'won' ? IconPartyPopper : IconSweat);
</script>

<div class="pop-in relative shrink-0 {outcome === 'won' ? 'rotate-3' : '-rotate-3'} {className}">
	<img
		src={portrait}
		alt={failed ? m.cameo_placeholder_alt() : m.cameo_portrait_alt({ name })}
		class="aspect-square w-full rounded-lg border-3 border-ink object-cover shadow-[3px_3px_0_var(--color-ink)] {outcome ===
		'lost'
			? 'saturate-50'
			: ''}"
		style:background="url({cameoFlag(host)}) center / 100% 100%"
		draggable="false"
		onerror={() => (failed = true)}
	/>
	<Badge class="absolute -end-2 -bottom-2 size-9 drop-shadow-sm" aria-hidden="true" />
</div>
