<!--
	A bottom sheet over the island, in the manner of a mobile base builder: a dimmed backdrop, a
	rounded panel that slides up, a round close button. Escape or a tap on the backdrop closes it.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import IconX from '~icons/lucide/x';

	let {
		open,
		title,
		onclose,
		narrow = false,
		children
	}: {
		open: boolean;
		title: string;
		onclose: () => void;
		/** A slim panel for a single item, such as an upgrade page */
		narrow?: boolean;
		children: Snippet;
	} = $props();
</script>

<svelte:window onkeydown={(event) => open && event.key === 'Escape' && onclose()} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-ink/55"
			aria-label={m.beachhead_tutorial_close()}
			onclick={onclose}
			tabindex="-1"
		></button>
		<div
			class="sheet-in relative flex max-h-[85dvh] w-full {narrow
				? 'max-w-sm'
				: 'max-w-3xl'} flex-col gap-2 overflow-y-auto rounded-t-[22px] border-3 border-ink bg-paper p-3 shadow-[0_-4px_0_var(--color-ink)] sm:rounded-[22px]"
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<div class="flex items-center justify-between gap-2">
				<h3 class="text-xl font-bold">{title}</h3>
				<button
					type="button"
					class="btn-chunky size-9 shrink-0 rounded-full p-0"
					aria-label={m.beachhead_tutorial_close()}
					onclick={onclose}
				>
					<IconX class="mx-auto size-5" aria-hidden="true" />
				</button>
			</div>
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.sheet-in {
		animation: sheet-up 180ms ease-out;
	}

	@keyframes sheet-up {
		from {
			transform: translateY(1.5rem);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet-in {
			animation: none;
		}
	}
</style>
