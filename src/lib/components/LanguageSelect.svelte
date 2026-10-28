<!--
	The language choice as one compact dropdown instead of a wall of six buttons. DaisyUI supplies
	the menu structure, the classes here make the trigger and the list read like the game's stickers
	instead of a browser control. The current language is always on the trigger, so the setting can
	be read without opening anything.

	A native <details> keeps the open/close and keyboard behaviour, but it has no idea about the
	rest of the page, so a pointer press outside and Escape close it here.
-->
<script lang="ts">
	import { LOCALE_NAMES } from '#lib/i18n.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, isLocale, locales, setLocale } from '#lib/paraglide/runtime.js';
	import IconCheck from '~icons/lucide/check';
	import IconChevronDown from '~icons/lucide/chevron-down';
	import IconLanguages from '~icons/lucide/languages';

	let open = $state(false);
	let root = $state<HTMLDetailsElement | null>(null);

	const current = $derived(getLocale());

	function choose(locale: string) {
		open = false;
		if (isLocale(locale)) setLocale(locale);
	}

	$effect(() => {
		if (!open) return;

		function onPointerDown(event: PointerEvent) {
			if (root && !root.contains(event.target as Node)) open = false;
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== 'Escape') return;
			open = false;
			root?.querySelector('summary')?.focus();
		}

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<details class="dropdown w-full" bind:open bind:this={root}>
	<summary
		class="btn-chunky w-full list-none justify-between px-3 py-2 text-base [&::-webkit-details-marker]:hidden"
	>
		<span class="flex min-w-0 items-center gap-2">
			<IconLanguages class="size-5 shrink-0 text-flag-blue" aria-hidden="true" />
			<span class="truncate" lang={current}>{LOCALE_NAMES[current]}</span>
		</span>
		<IconChevronDown
			class="size-4 shrink-0 transition-transform duration-200"
			class:rotate-180={open}
			aria-hidden="true"
		/>
	</summary>

	<ul
		class="dropdown-content menu z-30 mt-2 w-full gap-1 rounded-[14px_8px_12px_9px] border-3 border-ink bg-paper p-2 shadow-[4px_4px_0_var(--color-ink)]"
		aria-label={m.language_label()}
	>
		{#each locales as locale (locale)}
			{@const selected = current === locale}
			<li>
				<button
					type="button"
					class="flex w-full items-center justify-between gap-2 rounded-[10px_6px_9px_7px] px-3 py-2 text-start font-display text-base font-bold"
					class:bg-explosion-yellow={selected}
					lang={locale}
					aria-current={selected ? 'true' : undefined}
					onclick={() => choose(locale)}
				>
					<span class="truncate">{LOCALE_NAMES[locale]}</span>
					{#if selected}
						<IconCheck class="size-4 shrink-0" aria-hidden="true" />
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</details>
