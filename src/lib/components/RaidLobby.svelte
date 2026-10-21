<!--
	Raid lobby between raids: the raider's level, XP and gold, the three battlefields to pick from,
	the loadout (two weapons, helmet and vest) with gold upgrades, and the stash of gear found in
	earlier raids, where each piece can be equipped or salvaged for gold.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { MAP_IDS, RARITY_COLOR, STASH_SIZE, type MapId } from '#lib/game/raid/config.js';
	import {
		gearScore,
		helmetHp,
		salvageValue,
		upgradeCost,
		vestArmor,
		weaponDps,
		type GearItem
	} from '#lib/game/raid/items.js';
	import { raidMap } from '#lib/game/raid/maps.js';
	import { slotsFor, type LoadoutSlot } from '#lib/game/raid/profile.js';
	import type { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import {
		formatTime,
		itemName,
		MAP_DESCRIPTIONS,
		MAP_NAMES,
		RARITY_NAMES,
		WEAPON_TRAITS
	} from './raidText';
	import IconCoins from '~icons/lucide/coins';
	import IconPlay from '~icons/lucide/play';
	import IconRepeat from '~icons/lucide/repeat';

	let { game, onStart }: { game: RaidGame; onStart: () => void } = $props();

	const profile = $derived(game.profile);
	let selectedId = $state<string | null>(null);
	const selected = $derived(profile.stash.find((item) => item.id === selectedId) ?? null);

	const SLOT_LABELS: Record<LoadoutSlot, () => string> = {
		primary: m.raid_slot_primary,
		secondary: m.raid_slot_secondary,
		helmet: m.raid_armor_helmet,
		vest: m.raid_armor_vest
	};

	function iconKind(item: GearItem) {
		return item.type === 'weapon' ? item.kind : item.slot;
	}

	function statLine(item: GearItem): string {
		if (item.type === 'weapon')
			return m.raid_stat_dps({ value: Math.round(weaponDps(item, profile.level)) });
		if (item.slot === 'helmet') return m.raid_stat_hp({ value: helmetHp(item) });
		return m.raid_stat_armor({ value: vestArmor(item) });
	}

	function traitLine(item: GearItem): string | null {
		return item.type === 'weapon' ? WEAPON_TRAITS[item.kind]() : null;
	}

	/** Whether a stash item beats what is in the slot it would go into */
	function isBetter(item: GearItem): boolean {
		return slotsFor(item).some((slot) => {
			const current = profile.loadout[slot];
			return !current || gearScore(item) > gearScore(current);
		});
	}

	function equip(slot: LoadoutSlot) {
		if (!selected) return;
		game.equip(selected.id, slot);
		selectedId = null;
	}

	function salvageSelected() {
		if (!selected) return;
		game.salvageItem(selected.id);
		selectedId = null;
	}

	const xpShare = $derived(Math.min(1, profile.xp / game.xpNeeded));
	const mapColors = (id: MapId) => raidMap(id).palette;
</script>

<div class="grid w-full gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
	<div class="flex flex-col gap-3">
		<!-- Profile -->
		<section class="sticker flex items-center gap-3 p-3" style:--tilt="-0.5deg">
			<div
				class="flex size-14 shrink-0 flex-col items-center justify-center rounded-full border-3 border-ink bg-explosion-yellow font-display leading-none font-bold"
			>
				<span class="text-2xl tabular-nums">{profile.level}</span>
			</div>
			<div class="flex min-w-0 flex-1 flex-col gap-1 font-display">
				<span class="text-lg font-bold">{m.raid_lobby_level({ level: profile.level })}</span>
				<div class="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-sand">
					<div class="h-full bg-flag-blue" style:width="{xpShare * 100}%"></div>
				</div>
				<span class="text-xs font-bold tabular-nums opacity-80"
					>{m.raid_lobby_xp({ xp: profile.xp, next: game.xpNeeded })}</span
				>
			</div>
			<span class="flex items-center gap-1 font-display text-lg font-bold tabular-nums">
				<IconCoins class="size-5 text-mustard" aria-hidden="true" />
				<span class="sr-only">{m.raid_lobby_gold({ gold: profile.gold })}</span>
				<span aria-hidden="true">{profile.gold}</span>
			</span>
		</section>

		<!-- Battlefields -->
		<section class="flex flex-col gap-2">
			<h2 class="font-display text-lg font-bold">{m.raid_lobby_choose_map()}</h2>
			<div class="grid gap-2 sm:grid-cols-3">
				{#each MAP_IDS as id (id)}
					{@const map = raidMap(id)}
					{@const best = profile.bestTimeMs[id]}
					<button
						type="button"
						class="sticker sticker-interactive flex flex-col gap-1 p-2 text-start"
						class:ring-4={game.map === id}
						class:ring-tie-red={game.map === id}
						aria-pressed={game.map === id}
						onclick={() => game.selectMap(id)}
					>
						<span
							class="block h-10 w-full rounded-md border-2 border-ink"
							style:background="repeating-linear-gradient(135deg, {mapColors(id).ground} 0 14px, {mapColors(
								id
							).groundDark} 14px 20px)"
						></span>
						<span dir="auto" class="font-display text-base leading-tight font-bold"
							>{MAP_NAMES[id]()}</span
						>
						<span dir="auto" class="text-xs leading-snug">{MAP_DESCRIPTIONS[id]()}</span>
						<span class="flex flex-wrap gap-1 font-display text-[0.7rem] font-bold">
							<span class="rounded bg-tie-red px-1 text-paper"
								>{m.raid_map_danger({ value: map.difficulty })}</span
							>
							<span class="rounded bg-khaki px-1 text-paper"
								>{m.raid_map_reward({ value: map.reward })}</span
							>
						</span>
						{#if best}
							<span class="text-xs font-semibold"
								>{m.raid_map_best({ time: formatTime(best) })}</span
							>
						{/if}
					</button>
				{/each}
			</div>
			{#if game.best !== null}
				<p class="text-sm font-semibold">{m.raid_best({ score: game.best })}</p>
			{/if}
			<button
				type="button"
				class="btn-chunky self-start bg-tie-red text-xl text-paper"
				onclick={onStart}
			>
				<IconPlay class="size-5" aria-hidden="true" />
				{m.raid_start()}
			</button>
		</section>
	</div>

	<div class="flex flex-col gap-3">
		<!-- Loadout -->
		<section class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-2">
				<h2 class="font-display text-lg font-bold">{m.raid_lobby_loadout()}</h2>
				<button
					type="button"
					class="btn-chunky px-2 py-1 text-sm"
					onclick={() => game.swapLoadoutWeapons()}
				>
					<IconRepeat class="size-4" aria-hidden="true" />
					{m.raid_swap_weapons()}
				</button>
			</div>
			<ul class="grid gap-2 sm:grid-cols-2">
				{#each ['primary', 'secondary', 'helmet', 'vest'] as const as slot (slot)}
					{@const item = profile.loadout[slot]}
					{@const cost = item ? upgradeCost(item) : null}
					<li
						class="flex items-center gap-2 rounded-xl border-3 bg-paper p-2"
						style:border-color={item ? RARITY_COLOR[item.rarity] : 'var(--color-ink)'}
					>
						{#if item}
							<RaidItemIcon kind={iconKind(item)} rarity={item.rarity} class="size-12 shrink-0" />
							<div class="flex min-w-0 flex-1 flex-col leading-tight">
								<span class="text-[0.65rem] font-bold uppercase opacity-70"
									>{SLOT_LABELS[slot]()}</span
								>
								<span dir="auto" class="truncate font-display text-sm font-bold"
									>{itemName(item)}</span
								>
								<span class="text-xs font-bold" style:color={RARITY_COLOR[item.rarity]}
									>{RARITY_NAMES[item.rarity]()} · {m.raid_item_level({ level: item.level })}</span
								>
								<span class="text-xs">{statLine(item)}</span>
								{#if traitLine(item)}
									<span dir="auto" class="text-[0.7rem] leading-snug opacity-80"
										>{traitLine(item)}</span
									>
								{/if}
								<div class="mt-1 flex flex-wrap gap-1">
									<button
										type="button"
										class="btn-chunky px-2 py-0.5 text-xs"
										class:bg-explosion-yellow={cost !== null && cost <= profile.gold}
										disabled={cost === null || cost > profile.gold}
										onclick={() => game.upgrade(slot)}
									>
										{cost === null ? m.raid_upgrade_max() : m.raid_upgrade({ cost })}
									</button>
									{#if slot === 'helmet' || slot === 'vest'}
										<button
											type="button"
											class="btn-chunky px-2 py-0.5 text-xs"
											disabled={profile.stash.length >= STASH_SIZE}
											onclick={() => game.unequip(slot)}
										>
											{m.raid_unequip()}
										</button>
									{/if}
								</div>
							</div>
						{:else}
							<RaidItemIcon
								kind={slot === 'helmet' ? 'helmet' : 'vest'}
								class="size-12 shrink-0 opacity-30"
							/>
							<div class="flex flex-col leading-tight">
								<span class="text-[0.65rem] font-bold uppercase opacity-70"
									>{SLOT_LABELS[slot]()}</span
								>
								<span class="text-sm">{m.raid_slot_empty()}</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<!-- Stash -->
		<section class="flex flex-col gap-2">
			<h2 class="font-display text-lg font-bold">
				{m.raid_lobby_stash({ count: profile.stash.length, max: STASH_SIZE })}
			</h2>
			{#if profile.stash.length === 0}
				<p class="text-sm opacity-80">{m.raid_lobby_stash_empty()}</p>
			{:else}
				<ul class="flex flex-wrap gap-1.5">
					{#each profile.stash as item (item.id)}
						<li>
							<button
								type="button"
								class="relative block rounded-lg border-2 border-transparent"
								class:border-ink={selectedId === item.id}
								aria-pressed={selectedId === item.id}
								aria-label="{itemName(item)}, {RARITY_NAMES[item.rarity]()}, {m.raid_item_level({
									level: item.level
								})}"
								onclick={() => (selectedId = selectedId === item.id ? null : item.id)}
							>
								<RaidItemIcon kind={iconKind(item)} rarity={item.rarity} class="size-12" />
								<span
									class="absolute -right-1 -bottom-1 rounded bg-ink px-1 font-display text-[0.6rem] font-bold text-paper tabular-nums"
									>{item.level}</span
								>
								{#if isBetter(item)}
									<span
										class="absolute -top-1 -left-1 rounded-full bg-khaki px-1 text-[0.6rem] font-bold text-paper"
										>▲</span
									>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
				{#if selected}
					<div
						class="flex flex-wrap items-center gap-2 rounded-xl border-3 bg-paper p-2"
						style:border-color={RARITY_COLOR[selected.rarity]}
					>
						<div class="flex min-w-0 flex-1 flex-col leading-tight">
							<span dir="auto" class="font-display text-sm font-bold">{itemName(selected)}</span>
							<span class="text-xs font-bold" style:color={RARITY_COLOR[selected.rarity]}
								>{RARITY_NAMES[selected.rarity]()} · {m.raid_item_level({
									level: selected.level
								})}</span
							>
							<span class="text-xs">{statLine(selected)}</span>
							{#if traitLine(selected)}
								<span dir="auto" class="text-[0.7rem] opacity-80">{traitLine(selected)}</span>
							{/if}
						</div>
						<div class="flex flex-wrap gap-1">
							{#each slotsFor(selected) as slot (slot)}
								<button
									type="button"
									class="btn-chunky bg-explosion-yellow px-2 py-1 text-xs"
									onclick={() => equip(slot)}
								>
									{m.raid_equip()}{selected.type === 'weapon' ? `: ${SLOT_LABELS[slot]()}` : ''}
								</button>
							{/each}
							<button type="button" class="btn-chunky px-2 py-1 text-xs" onclick={salvageSelected}>
								{m.raid_salvage({ gold: salvageValue(selected) })}
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</section>
	</div>
</div>
