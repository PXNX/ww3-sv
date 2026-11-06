<!--
	Hermit Hackers bonus round: the cartoon bank's desktop after a finished contract. A row of folders
	with silly names; open one to see what is inside and pick it up (sticky notes give away a symbol
	of the vault combination, apps are a free tool level, coins are coins). The DogeLite vault, once
	found, is a combination lock played like the breach. A bar shows how long until the admin is back
	from lunch; logging off early starts the next contract straight away.
	Keys: 1 to 8 type a vault symbol, Backspace deletes, Enter tries the lock (handled by the page).
-->
<script lang="ts">
	import { GLYPHS } from '#lib/game/hackers/config.js';
	import { DESKTOP_TIME_MS, type DesktopItem } from '#lib/game/hackers/desktop.js';
	import type { Mark } from '#lib/game/hackers/mastermind.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { HackersGame } from '#lib/stores/hackersGame.svelte.js';
	import IconAppWindow from '~icons/lucide/app-window';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconCoins from '~icons/lucide/coins';
	import IconFolder from '~icons/lucide/folder';
	import IconFolderOpen from '~icons/lucide/folder-open';
	import IconLock from '~icons/lucide/lock';
	import IconLockOpen from '~icons/lucide/lock-open';
	import IconLogOut from '~icons/lucide/log-out';
	import IconStickyNote from '~icons/lucide/sticky-note';
	import IconVault from '~icons/lucide/vault';

	let { game }: { game: HackersGame } = $props();

	const FOLDER_NAMES: (() => string)[] = [
		m.hackers_desk_folder_0,
		m.hackers_desk_folder_1,
		m.hackers_desk_folder_2,
		m.hackers_desk_folder_3,
		m.hackers_desk_folder_4,
		m.hackers_desk_folder_5,
		m.hackers_desk_folder_6,
		m.hackers_desk_folder_7,
		m.hackers_desk_folder_8,
		m.hackers_desk_folder_9
	];
	const TOOL_NAMES = {
		breach: m.hackers_tool_breach,
		keylog: m.hackers_tool_keylog,
		relays: m.hackers_tool_relays
	} as const;
	const MARK_CLASS: Record<Mark, string> = {
		hit: 'bg-[#39ff6a] text-[#021208]',
		near: 'bg-[#e8b923] text-[#021208]',
		miss: 'bg-[#0b2a14] text-[#39ff6a]/50'
	};

	const desktop = $derived(game.desktop);
	const folder = $derived(
		desktop && game.desktopFolder !== null ? desktop.folders[game.desktopFolder] : null
	);
	const share = $derived(desktop ? desktop.timeLeftMs / DESKTOP_TIME_MS : 0);
	const seconds = $derived(desktop ? Math.ceil(desktop.timeLeftMs / 1000) : 0);
	const codeLength = $derived(desktop?.code.length ?? 0);

	function label(item: DesktopItem): string {
		switch (item.kind) {
			case 'note':
				return m.hackers_desk_note({ slot: item.slot + 1, glyph: GLYPHS[item.symbol] });
			case 'app':
				return m.hackers_desk_app({ tool: TOOL_NAMES[item.app]() });
			case 'coins':
				return m.hackers_desk_coins({ amount: item.amount });
			case 'vault':
				return m.hackers_desk_vault();
		}
	}

	function action(item: DesktopItem): string {
		return item.kind === 'app'
			? m.hackers_desk_download()
			: item.kind === 'note'
				? m.hackers_desk_read()
				: m.hackers_desk_take();
	}
</script>

{#if desktop}
	<div class="flex min-h-0 flex-1 flex-col gap-2" aria-label={m.hackers_desk_title()}>
		<div
			class="shrink-0 rounded border border-(--hk-green) bg-(--hk-green)/10 px-2 py-1 text-center"
			role="status"
		>
			<p class="text-sm font-bold tracking-[0.2em]">{m.hackers_desk_granted()}</p>
			<p class="text-[11px] opacity-80">
				{m.hackers_desk_logged_in({ system: game.desktopSystem })}
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2 text-xs">
			<span class="font-bold">{m.hackers_desk_title()}</span>
			<span class="ms-auto tabular-nums {share < 0.3 ? 'hk-warn' : 'opacity-80'}">
				{m.hackers_desk_admin({ seconds })}
			</span>
		</div>
		<div class="hk-meter shrink-0 {share < 0.3 ? 'text-(--hk-red)' : 'text-(--hk-amber)'}">
			<span style:width="{share * 100}%"></span>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
			{#if folder && game.desktopFolder !== null}
				{@const folderIndex = game.desktopFolder}
				<button type="button" class="hk-chip mb-2" onclick={() => game.closeFolder()}>
					<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
					&nbsp;{FOLDER_NAMES[folder.name]()}
				</button>
				<ul class="flex flex-col gap-1.5">
					{#each folder.items as item, index (index)}
						{@const taken = folder.taken.includes(index)}
						<li class="hk-row text-xs {taken ? 'opacity-45' : ''}">
							<span class="shrink-0" aria-hidden="true">
								{#if item.kind === 'note'}
									<IconStickyNote class="size-5" />
								{:else if item.kind === 'app'}
									<IconAppWindow class="size-5" />
								{:else if item.kind === 'coins'}
									<IconCoins class="size-5 text-(--hk-amber)" />
								{:else}
									<IconVault class="size-5 text-(--hk-amber)" />
								{/if}
							</span>
							<span class="min-w-0 flex-1">{label(item)}</span>
							{#if item.kind !== 'vault'}
								<button
									type="button"
									class="hk-btn hk-btn-sm shrink-0"
									disabled={taken}
									onclick={() => game.takeItem(folderIndex, index)}
								>
									{taken ? '✓' : action(item)}
								</button>
							{/if}
						</li>
					{:else}
						<li class="text-xs opacity-60">{m.hackers_desk_empty()}</li>
					{/each}
				</ul>
			{:else}
				<ul class="grid grid-cols-3 gap-2 sm:grid-cols-4">
					{#each desktop.folders as entry, index (index)}
						<li>
							<button
								type="button"
								class="flex w-full flex-col items-center gap-1 rounded border border-transparent p-2 text-center text-[11px] leading-tight hover:border-(--hk-green-dim) focus-visible:border-(--hk-green)"
								onclick={() => game.openFolder(index)}
							>
								{#if entry.opened}
									<IconFolderOpen class="size-8 opacity-70" aria-hidden="true" />
								{:else}
									<IconFolder class="size-8" aria-hidden="true" />
								{/if}
								<span>{FOLDER_NAMES[entry.name]()}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if desktop.vaultFound}
			<div class="hk-rule flex shrink-0 flex-col gap-2 pt-2">
				<div class="flex items-center gap-2 text-xs font-bold">
					{#if desktop.cracked === true}
						<IconLockOpen class="size-4 text-(--hk-green)" aria-hidden="true" />
						{m.hackers_desk_vault_open({ amount: desktop.reward })}
					{:else if desktop.cracked === false}
						<IconLock class="size-4 text-(--hk-red)" aria-hidden="true" />
						{m.hackers_desk_vault_locked()}
					{:else}
						<IconVault class="size-4 text-(--hk-amber)" aria-hidden="true" />
						{m.hackers_desk_vault_try({
							count: desktop.maxAttempts - desktop.guesses.length
						})}
					{/if}
				</div>
				<div class="flex flex-wrap items-center gap-3">
					{#each desktop.guesses as guess, row (row)}
						<span class="flex gap-0.5">
							{#each guess.symbols as symbol, i (i)}
								<span
									class="flex size-6 items-center justify-center rounded text-xs font-bold {MARK_CLASS[
										guess.marks[i]
									]}">{GLYPHS[symbol]}</span
								>
							{/each}
						</span>
					{/each}
				</div>
				{#if desktop.cracked === null}
					<div class="flex items-center gap-1.5">
						{#each { length: codeLength }, i (i)}
							{@const typed = game.vaultInput[i]}
							{@const known = desktop.known[i]}
							<span
								class="flex size-9 items-center justify-center rounded border-2 border-dashed border-(--hk-green) font-bold"
								title={known !== null ? m.hackers_desk_known({ glyph: GLYPHS[known] }) : undefined}
							>
								{#if typed !== undefined}
									{GLYPHS[typed]}
								{:else if known !== null}
									<span class="opacity-40">{GLYPHS[known]}</span>
								{:else}
									_
								{/if}
							</span>
						{/each}
						<button
							type="button"
							class="hk-btn hk-btn-sm ms-auto"
							disabled={game.vaultInput.length === 0}
							onclick={() => game.popVault()}
						>
							{m.hackers_breach_delete()}
						</button>
						<button
							type="button"
							class="hk-btn hk-btn-sm hk-btn-solid"
							disabled={game.vaultInput.length !== codeLength}
							onclick={() => game.tryVault()}
						>
							{m.hackers_desk_open_vault()}
						</button>
					</div>
					<div class="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
						{#each GLYPHS.slice(0, desktop.symbols) as glyph, i (glyph)}
							<button
								type="button"
								class="hk-btn h-11 min-w-0 px-0 text-lg"
								disabled={game.vaultInput.length >= codeLength}
								onclick={() => game.pushVault(i)}
							>
								{glyph}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<button type="button" class="hk-btn shrink-0" onclick={() => game.leaveDesktop()}>
			<IconLogOut class="size-4" aria-hidden="true" />
			{m.hackers_desk_logoff()}
		</button>
	</div>
{/if}
