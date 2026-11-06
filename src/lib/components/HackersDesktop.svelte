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
	import {
		EMAILS,
		networkSystem,
		type CameraMode,
		type CastId,
		type ProgramKind
	} from '#lib/game/hackers/lore.js';
	import { networkName } from '#lib/stores/hackersGame.svelte.js';
	import { leaderById } from '#lib/theme/leaders.js';
	import { mailBody, mailSubject } from './hackersMail';
	import IconMail from '~icons/lucide/mail';
	import IconNetwork from '~icons/lucide/network';
	import IconPlay from '~icons/lucide/play';
	import IconStar from '~icons/lucide/star';
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
		m.hackers_desk_folder_9,
		m.hackers_desk_folder_10,
		m.hackers_desk_folder_11,
		m.hackers_desk_folder_12,
		m.hackers_desk_folder_13,
		m.hackers_desk_folder_14,
		m.hackers_desk_folder_15
	];

	type Tab = 'files' | 'programs' | 'mail' | 'cameras' | 'network';
	let tab = $state<Tab>('files');
	/** The mail open in the inbox */
	let openMail = $state<number | null>(null);

	const castName = (id: CastId): string =>
		id === 'leader' ? m.hackers_cast_leader() : leaderById(id).name();
	const castPortrait = (id: CastId): string | null =>
		id === 'leader' ? null : leaderById(id).portrait;

	const AWAY: Record<CastId, () => string> = {
		putin: m.hackers_away_putin,
		trump: m.hackers_away_trump,
		kim: m.hackers_away_kim,
		maduro: m.hackers_away_maduro,
		zuckerberg: m.hackers_away_zuckerberg,
		musk: m.hackers_away_musk,
		altman: m.hackers_away_altman,
		huang: m.hackers_away_huang,
		leader: m.hackers_away_leader
	};
	const PROGRAM_NAME: Record<ProgramKind, () => string> = {
		coffee: m.hackers_prog_coffee,
		broom: m.hackers_prog_broom,
		tool: m.hackers_prog_tool,
		miner: m.hackers_prog_miner,
		karaoke: m.hackers_prog_karaoke,
		selfie: m.hackers_prog_selfie
	};
	const PROGRAM_INFO: Record<ProgramKind, () => string> = {
		coffee: m.hackers_prog_coffee_info,
		broom: m.hackers_prog_broom_info,
		tool: m.hackers_prog_tool_info,
		miner: m.hackers_prog_miner_info,
		karaoke: m.hackers_prog_karaoke_info,
		selfie: m.hackers_prog_selfie_info
	};
	const CAMERA_CAPTION: Record<CameraMode, () => string> = {
		dome: m.hackers_cam_dome,
		tycoon: m.hackers_cam_tycoon,
		chipfab: m.hackers_cam_chipfab,
		maple: m.hackers_cam_maple,
		petrobras: m.hackers_cam_petrobras,
		whack: m.hackers_cam_whack,
		convoy: m.hackers_cam_convoy,
		chess: m.hackers_cam_chess,
		flamingo: m.hackers_cam_flamingo,
		centrifuge: m.hackers_cam_centrifuge,
		raid: m.hackers_cam_raid,
		fury: m.hackers_cam_fury
	};
	const stamp = (index: number): string => {
		const total =
			3 * 3600 + 17 * 60 + index * 431 + Math.floor((game.desktop?.timeLeftMs ?? 0) / 1000);
		const pad = (value: number) => String(value % 60).padStart(2, '0');
		return `${String(Math.floor(total / 3600) % 24).padStart(2, '0')}:${pad(Math.floor(total / 60))}:${pad(total)}`;
	};
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
			class="flex shrink-0 items-center gap-2 rounded border border-(--hk-green) bg-(--hk-green)/10 px-2 py-1"
			role="status"
		>
			{#if castPortrait(desktop.owner)}
				<img
					src={castPortrait(desktop.owner)}
					alt=""
					class="size-10 shrink-0 rounded border border-(--hk-green-dim) object-cover [filter:grayscale(1)_sepia(1)_hue-rotate(70deg)_saturate(3)]"
				/>
			{:else}
				<IconStar class="size-8 shrink-0" aria-hidden="true" />
			{/if}
			<div class="min-w-0 flex-1">
				<p class="text-sm font-bold tracking-[0.2em]">{m.hackers_desk_granted()}</p>
				<p class="truncate text-[11px] opacity-80">
					{m.hackers_desk_logged_in({ system: game.desktopSystem })}
				</p>
				<p class="text-[11px] italic opacity-70">
					{castName(desktop.owner)}: “{AWAY[desktop.owner]()}”
				</p>
			</div>
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

		<div class="flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto" role="tablist">
			{#each [['files', m.hackers_tab_files(), desktop.folders.length], ['programs', m.hackers_tab_programs(), desktop.programs.filter((p) => !p.used).length], ['mail', m.hackers_tab_mail(), desktop.mail.filter((x) => !x.read).length], ['cameras', m.hackers_tab_cameras(), desktop.cameras.length], ...(desktop.link ? [['network', m.hackers_tab_network(), desktop.linkTaken ? 0 : 1]] : [])] as [Tab, string, number][] as [id, name, count] (id)}
				<button
					type="button"
					role="tab"
					class="hk-chip"
					aria-selected={tab === id}
					onclick={() => {
						tab = id;
						openMail = null;
					}}
				>
					{name}{#if count > 0}<span class="ms-1 opacity-60">{count}</span>{/if}
				</button>
			{/each}
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
			{#if tab === 'programs'}
				<ul class="flex flex-col gap-1.5">
					{#each desktop.programs as program, index (index)}
						<li class="hk-row text-xs {program.used ? 'opacity-45' : ''}">
							<IconAppWindow class="size-5 shrink-0" aria-hidden="true" />
							<span class="min-w-0 flex-1">
								<span class="block font-bold">
									{program.kind === 'tool'
										? m.hackers_desk_app({ tool: TOOL_NAMES[program.app]() })
										: PROGRAM_NAME[program.kind]()}
								</span>
								<span class="block opacity-70">{PROGRAM_INFO[program.kind]()}</span>
							</span>
							<button
								type="button"
								class="hk-btn hk-btn-sm shrink-0"
								disabled={program.used}
								aria-label={m.hackers_prog_run()}
								onclick={() => game.runProgram(index)}
							>
								{#if program.used}✓{:else}<IconPlay class="size-4" aria-hidden="true" />{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else if tab === 'mail'}
				{#if openMail !== null && desktop.mail[openMail]}
					{@const mail = desktop.mail[openMail]}
					{@const email = EMAILS[mail.id]}
					<button type="button" class="hk-chip mb-2" onclick={() => (openMail = null)}>
						<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
						&nbsp;{m.hackers_tab_mail()}
					</button>
					<article class="hk-row flex-col items-stretch gap-1 text-xs">
						<p><span class="opacity-60">{m.hackers_mail_from()}</span> {castName(email.from)}</p>
						<p>
							<span class="opacity-60">{m.hackers_mail_to()}</span>
							{email.to === 'all' ? m.hackers_mail_everyone() : castName(email.to)}
						</p>
						<p class="font-bold">{mailSubject(mail.id)}</p>
						<p class="hk-rule pt-1 leading-relaxed whitespace-pre-line">{mailBody(mail.id)}</p>
						{#if mail.clue}
							<p class="text-(--hk-amber)">
								{m.hackers_mail_ps({ slot: mail.clue.slot + 1, glyph: GLYPHS[mail.clue.symbol] })}
							</p>
						{/if}
					</article>
				{:else}
					<ul class="flex flex-col gap-1.5">
						{#each desktop.mail as mail, index (mail.id)}
							{@const email = EMAILS[mail.id]}
							<li>
								<button
									type="button"
									class="hk-row w-full text-start text-xs {mail.read ? 'opacity-60' : 'font-bold'}"
									onclick={() => {
										game.readMail(index);
										openMail = index;
									}}
								>
									{#if castPortrait(email.from)}
										<img
											src={castPortrait(email.from)}
											alt=""
											class="size-7 shrink-0 rounded-full border border-(--hk-green-dim) object-cover [filter:grayscale(1)_sepia(1)_hue-rotate(70deg)_saturate(3)]"
										/>
									{:else}
										<IconMail class="size-5 shrink-0" aria-hidden="true" />
									{/if}
									<span class="min-w-0 flex-1">
										<span class="block truncate">{castName(email.from)}</span>
										<span class="block truncate opacity-80">{mailSubject(mail.id)}</span>
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{:else if tab === 'cameras'}
				<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each desktop.cameras as camera, index (camera)}
						<li class="hk-cam">
							<img src="/cards/{camera}.webp" alt="" loading="lazy" />
							<span class="hk-cam-rec" aria-hidden="true">● REC</span>
							<span class="hk-cam-stamp" aria-hidden="true">CAM {index + 1} · {stamp(index)}</span>
							<p class="hk-cam-caption">{CAMERA_CAPTION[camera]()}</p>
						</li>
					{/each}
				</ul>
			{:else if tab === 'network' && desktop.link}
				{@const system = networkSystem(desktop.link)}
				<div class="hk-row flex-col items-stretch gap-2 text-xs">
					<p class="flex items-center gap-2 font-bold">
						<IconNetwork class="size-5" aria-hidden="true" />
						{m.hackers_net_title()}
					</p>
					<p class="leading-relaxed">
						{m.hackers_net_body({
							system: networkName(desktop.link),
							owner: system ? castName(system.owner) : ''
						})}
					</p>
					<button
						type="button"
						class="hk-btn hk-btn-solid"
						disabled={desktop.linkTaken}
						onclick={() => game.takeLink()}
					>
						{desktop.linkTaken ? m.hackers_net_taken() : m.hackers_net_take()}
					</button>
				</div>
			{:else if folder && game.desktopFolder !== null}
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
