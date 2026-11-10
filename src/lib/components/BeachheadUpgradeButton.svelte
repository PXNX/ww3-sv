<!--
	The one upgrade button of Beachhead: green with an arrow when the upgrade can be paid for, grey
	with a lock instead of the arrow when the resources (or shards) are short, so a glance tells which
	upgrades are in reach. Anything else the caller wants on it, such as the time, goes in as children.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import IconArrowBigUp from '~icons/lucide/arrow-big-up';
	import IconLock from '~icons/lucide/lock';

	let {
		label,
		short,
		disabled = false,
		size = 'md',
		onclick,
		children
	}: {
		label: string;
		/** Not enough resources for it: grey, with a lock */
		short: boolean;
		/** Cannot be started for another reason, such as no free builder */
		disabled?: boolean;
		size?: 'sm' | 'md' | 'lg';
		onclick: () => void;
		children?: Snippet;
	} = $props();

	const icon = $derived(size === 'sm' ? 'size-4' : size === 'lg' ? 'size-7' : 'size-5');
</script>

<button
	type="button"
	class="btn-chunky flex items-center justify-center gap-1.5 font-display font-bold tabular-nums {children
		? 'rounded-full px-3 py-0'
		: 'rounded-full p-0'} {size === 'sm'
		? children
			? 'h-8 text-xs'
			: 'size-8'
		: size === 'lg'
			? children
				? 'h-12 text-base'
				: 'size-12'
			: children
				? 'h-10 text-sm'
				: 'size-10'} {short ? 'short' : 'go'}"
	aria-label={short ? `${label} — ${m.beachhead_upgrade_short()}` : label}
	title={short ? m.beachhead_upgrade_short() : label}
	disabled={short || disabled}
	{onclick}
>
	{#if short}
		<IconLock class={icon} aria-hidden="true" />
	{:else}
		<IconArrowBigUp class="{icon} fill-current" aria-hidden="true" />
	{/if}
	{@render children?.()}
</button>

<style>
	.go {
		background: #3fa65a;
		color: var(--color-paper);
	}

	.short {
		background: #a7a9ad;
		color: rgb(255 255 255 / 0.85);
		cursor: not-allowed;
	}

	/* The lock stays readable: a short upgrade is greyed, not faded away */
	.short:disabled {
		opacity: 1;
	}
</style>
