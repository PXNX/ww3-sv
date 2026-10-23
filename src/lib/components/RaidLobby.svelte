<!--
	Raid lobby between raids: the raider's level, XP, gold and scrap, the season's reward track,
	the three battlefields to pick from, the loadout (two weapons, helmet, vest and boots) with
	gold upgrades and the crystals socketed into the weapons, the loose crystals (socketed from
	here, or combined five into one rarer), and the stash of gear found in earlier raids, where
	each piece can be equipped or salvaged for gold and scrap.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import {
		CRYSTAL_COMBINE_COUNT,
		MAP_IDS,
		RARITY_COLOR,
		SEASON_TIERS,
		STASH_SIZE,
		WEAPONS,
		type MapId
	} from '#lib/game/raid/config.js';
	import {
		bootsSpeed,
		crystalsOf,
		gearScore,
		helmetHp,
		salvageScrap,
		salvageValue,
		socketsOf,
		upgradeCost,
		vestArmor,
		weaponDps,
		type Crystal,
		type GearItem
	} from '#lib/game/raid/items.js';
	import { raidMap } from '#lib/game/raid/maps.js';
	import {
		canCombine,
		combineCost,
		slotsFor,
		stockList,
		type LoadoutSlot,
		type WeaponSlot
	} from '#lib/game/raid/profile.js';
	import {
		seasonDaysLeft,
		seasonId,
		seasonNumber,
		seasonReward,
		seasonTier,
		seasonTierProgress
	} from '#lib/game/raid/season.js';
	import type { RaidGame } from '#lib/stores/raidGame.svelte.js';
	import RaidCrystalIcon from './RaidCrystalIcon.svelte';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import {
		crystalEffect,
		crystalName,
		formatTime,
		itemName,
		MAP_DESCRIPTIONS,
		MAP_NAMES,
		PERK_HINTS,
		RARITY_NAMES,
		SKILL_NAMES,
		seasonRewardText,
		WEAPON_NAMES,
		WEAPON_TRAITS
	} from './raidText';
	import IconCheck from '~icons/lucide/check';
	import IconCoins from '~icons/lucide/coins';
	import IconGift from '~icons/lucide/gift';
	import IconInfo from '~icons/lucide/info';
	import IconLock from '~icons/lucide/lock';
	import IconPlay from '~icons/lucide/play';
	import IconRepeat from '~icons/lucide/repeat';
	import IconSettings from '~icons/lucide/settings';

	let { game, onStart }: { game: RaidGame; onStart: () => void } = $props();

	const profile = $derived(game.profile);
	let selectedId = $state<string | null>(null);
	const selected = $derived(profile.stash.find((item) => item.id === selectedId) ?? null);
	let selectedCrystal = $state<Crystal | null>(null);
	const stock = $derived(stockList(profile.crystals));
	/** The selected crystal's count, so the panel closes once the last one is used up */
	const selectedStock = $derived(
		selectedCrystal
			? (stock.find(
					(entry) =>
						entry.crystal.kind === selectedCrystal!.kind &&
						entry.crystal.rarity === selectedCrystal!.rarity
				) ?? null)
			: null
	);

	const SLOT_LABELS: Record<LoadoutSlot, () => string> = {
		primary: m.raid_slot_primary,
		secondary: m.raid_slot_secondary,
		helmet: m.raid_armor_helmet,
		vest: m.raid_armor_vest,
		boots: m.raid_armor_boots
	};
	const SLOTS = ['primary', 'secondary', 'helmet', 'vest', 'boots'] as const;
	const WEAPON_SLOTS = ['primary', 'secondary'] as const;

	function iconKind(item: GearItem) {
		return item.type === 'weapon' ? item.kind : item.slot;
	}

	function statLine(item: GearItem): string {
		if (item.type === 'weapon')
			return m.raid_stat_dps({ value: Math.round(weaponDps(item, profile.level)) });
		if (item.slot === 'helmet') return m.raid_stat_hp({ value: helmetHp(item) });
		if (item.slot === 'boots')
			return m.raid_stat_speed({ value: Math.round(bootsSpeed(item) * 100) });
		return m.raid_stat_armor({ value: vestArmor(item) });
	}

	function traitLine(item: GearItem): string | null {
		if (item.type !== 'weapon') return item.perk ? PERK_HINTS[item.perk]() : null;
		const [first, second] = WEAPONS[item.kind].skills;
		const skills = m.raid_lobby_skills({
			first: SKILL_NAMES[first](),
			second: SKILL_NAMES[second]()
		});
		return `${WEAPON_TRAITS[item.kind]()} · ${skills}`;
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

	function socket(slot: WeaponSlot) {
		if (selectedCrystal) game.socket(slot, selectedCrystal);
	}

	const freeSockets = (slot: WeaponSlot) =>
		socketsOf(profile.loadout[slot]) - crystalsOf(profile.loadout[slot]).length;

	const xpShare = $derived(Math.min(1, profile.xp / game.xpNeeded));
	const mapColors = (id: MapId) => raidMap(id).palette;

	// Season
	const season = $derived(profile.season);
	const reached = $derived(seasonTier(season.xp));
	const tierProgress = $derived(seasonTierProgress(season.xp));
	const claimable = $derived(reached - season.claimed);
	const tiers = Array.from({ length: SEASON_TIERS }, (_, index) => index + 1);
	const today = new Date();
	const current = $derived(seasonId(today) === season.id);
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
			<div class="flex flex-col items-end gap-0.5 font-display font-bold tabular-nums">
				<span class="flex items-center gap-1 text-lg">
					<IconCoins class="size-5 text-mustard" aria-hidden="true" />
					<span class="sr-only">{m.raid_lobby_gold({ gold: profile.gold })}</span>
					<span aria-hidden="true">{profile.gold}</span>
				</span>
				<span class="flex items-center gap-1 text-sm">
					<IconSettings class="size-4 opacity-70" aria-hidden="true" />
					<span class="sr-only">{m.raid_lobby_scrap({ scrap: profile.scrap })}</span>
					<span aria-hidden="true">{profile.scrap}</span>
				</span>
			</div>
		</section>

		<!-- Season track -->
		<section class="sticker flex flex-col gap-2 p-3" style:--tilt="0.4deg">
			<div class="flex flex-wrap items-baseline justify-between gap-2 font-display">
				<h2 class="text-lg font-bold">
					{m.raid_season_title({ number: seasonNumber(season.id) })}
				</h2>
				{#if current}
					<span class="text-xs font-bold opacity-80"
						>{m.raid_season_days_left({ days: seasonDaysLeft(today) })}</span
					>
				{/if}
			</div>
			<div class="flex items-center gap-2 font-display text-sm font-bold">
				<span class="shrink-0 rounded bg-banner-slate px-1.5 text-paper tabular-nums"
					>{m.raid_season_tier({ tier: reached, max: SEASON_TIERS })}</span
				>
				<div class="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand">
					<div
						class="h-full bg-mustard"
						style:width="{tierProgress.needed > 0
							? (tierProgress.xp / tierProgress.needed) * 100
							: 100}%"
					></div>
				</div>
			</div>
			<p class="text-xs font-semibold tabular-nums opacity-80">
				{tierProgress.needed > 0
					? m.raid_season_xp({ xp: tierProgress.xp, next: tierProgress.needed })
					: m.raid_season_complete()}
			</p>
			<ol class="flex gap-1.5 overflow-x-auto px-1 pt-2 pb-1" aria-label={m.raid_result_season()}>
				{#each tiers as tier (tier)}
					{@const reward = seasonReward(season.id, tier)}
					{@const done = tier <= season.claimed}
					{@const ready = !done && tier <= reached}
					<li
						class="relative flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-lg border-2 p-1 text-center"
						class:border-ink={!ready}
						class:border-khaki={ready}
						class:bg-paper={!done}
						class:bg-sand={done}
						class:opacity-60={tier > reached}
						title={seasonRewardText(reward)}
					>
						<span class="font-display text-[0.6rem] font-bold tabular-nums">{tier}</span>
						{#if reward.type === 'gold'}
							<IconCoins class="size-6 text-mustard" aria-hidden="true" />
						{:else if reward.type === 'scrap'}
							<IconSettings class="size-6 opacity-70" aria-hidden="true" />
						{:else if reward.type === 'crystal'}
							<RaidCrystalIcon
								kind={reward.crystal.kind}
								rarity={reward.crystal.rarity}
								class="size-6"
							/>
						{:else if reward.type === 'weapon'}
							<RaidItemIcon kind={reward.kind} rarity={reward.rarity} class="size-7" />
						{/if}
						<span class="sr-only">{seasonRewardText(reward)}</span>
						{#if done}
							<IconCheck
								class="absolute -top-1.5 -right-1.5 size-4 rounded-full border-2 border-ink bg-khaki p-0.5 text-paper"
								aria-hidden="true"
							/>
						{:else if tier > reached}
							<IconLock class="absolute -top-1.5 -right-1.5 size-4 opacity-70" aria-hidden="true" />
						{/if}
					</li>
				{/each}
			</ol>
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="btn-chunky px-3 py-1 text-sm"
					class:bg-explosion-yellow={claimable > 0}
					disabled={claimable <= 0}
					onclick={() => game.claimSeason()}
				>
					<IconGift class="size-4" aria-hidden="true" />
					{m.raid_season_claim({ count: Math.max(0, claimable) })}
				</button>
				<p class="flex-1 text-xs leading-snug opacity-80">{m.raid_season_hint()}</p>
			</div>
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
				{#each SLOTS as slot (slot)}
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
								{#if item.type === 'weapon' && (slot === 'primary' || slot === 'secondary')}
									<!-- Crystal sockets: tap a crystal to take it out -->
									<span class="mt-1 flex items-center gap-1" aria-label={m.raid_crystal_sockets()}>
										{#each crystalsOf(item) as crystal, index (index)}
											<button
												type="button"
												class="rounded-full"
												title="{crystalName(crystal)}: {crystalEffect(
													crystal
												)}. {m.raid_crystal_remove()}"
												aria-label="{crystalName(crystal)}, {m.raid_crystal_remove()}"
												onclick={() => game.unsocket(slot, index)}
											>
												<RaidCrystalIcon
													kind={crystal.kind}
													rarity={crystal.rarity}
													class="size-6"
												/>
											</button>
										{/each}
										{#each { length: socketsOf(item) - crystalsOf(item).length }, index (index)}
											<span
												class="block size-6 rounded-full border-2 border-dashed border-ink/50"
												title={m.raid_crystal_empty_socket()}
											></span>
										{/each}
									</span>
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
									{#if item.type === 'weapon'}
										<a
											class="btn-chunky px-2 py-0.5 text-xs"
											href={resolve('/play/raid/weapons/[kind]', { kind: item.kind })}
										>
											<IconInfo class="size-3.5" aria-hidden="true" />
											{m.raid_weapon_details()}
										</a>
									{:else}
										<button
											type="button"
											class="btn-chunky px-2 py-0.5 text-xs"
											disabled={profile.stash.length >= STASH_SIZE}
											onclick={() => game.unequip(item.slot)}
										>
											{m.raid_unequip()}
										</button>
									{/if}
								</div>
							</div>
						{:else}
							<RaidItemIcon
								kind={slot === 'primary' || slot === 'secondary' ? 'rifle' : slot}
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

		<!-- Crystals -->
		<section class="flex flex-col gap-2">
			<h2 class="font-display text-lg font-bold">{m.raid_lobby_crystals()}</h2>
			{#if stock.length === 0}
				<p class="text-sm opacity-80">{m.raid_lobby_crystals_empty()}</p>
			{:else}
				<ul class="flex flex-wrap gap-1.5">
					{#each stock as { crystal, count } (`${crystal.kind}:${crystal.rarity}`)}
						{@const active =
							selectedCrystal?.kind === crystal.kind && selectedCrystal?.rarity === crystal.rarity}
						<li>
							<button
								type="button"
								class="relative block rounded-full border-2 border-transparent p-0.5"
								class:border-ink={active}
								aria-pressed={active}
								aria-label="{crystalName(crystal)} ×{count}"
								title="{crystalName(crystal)}: {crystalEffect(crystal)}"
								onclick={() => (selectedCrystal = active ? null : crystal)}
							>
								<RaidCrystalIcon kind={crystal.kind} rarity={crystal.rarity} class="size-11" />
								<span
									class="absolute -right-1 -bottom-1 rounded bg-ink px-1 font-display text-[0.6rem] font-bold text-paper tabular-nums"
									>{count}</span
								>
							</button>
						</li>
					{/each}
				</ul>
				{#if selectedCrystal && selectedStock}
					{@const crystal = selectedStock.crystal}
					{@const cost = combineCost(crystal)}
					<div
						class="flex flex-wrap items-center gap-2 rounded-xl border-3 bg-paper p-2"
						style:border-color={RARITY_COLOR[crystal.rarity]}
					>
						<div class="flex min-w-0 flex-1 flex-col leading-tight">
							<span dir="auto" class="font-display text-sm font-bold">{crystalName(crystal)}</span>
							<span dir="auto" class="text-xs">{crystalEffect(crystal)}</span>
						</div>
						<div class="flex flex-wrap gap-1">
							{#each WEAPON_SLOTS as slot (slot)}
								<button
									type="button"
									class="btn-chunky bg-explosion-yellow px-2 py-1 text-xs"
									disabled={freeSockets(slot) <= 0}
									onclick={() => socket(slot)}
								>
									{m.raid_crystal_socket({ weapon: WEAPON_NAMES[profile.loadout[slot].kind]() })}
								</button>
							{/each}
							{#if cost !== null}
								<button
									type="button"
									class="btn-chunky px-2 py-1 text-xs"
									disabled={!canCombine(profile, crystal)}
									title="{selectedStock.count}/{CRYSTAL_COMBINE_COUNT}"
									onclick={() => game.combine(crystal)}
								>
									{m.raid_crystal_combine({ scrap: cost })}
								</button>
							{/if}
						</div>
					</div>
				{/if}
			{/if}
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
								{#if item.type === 'armor' && item.perk}
									<span
										class="absolute -top-1 -right-1 rounded-full bg-tie-red px-1 text-[0.6rem] font-bold text-paper"
										>★</span
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
								{m.raid_salvage({ gold: salvageValue(selected) })} · {m.raid_reward_scrap({
									amount: salvageScrap(selected)
								})}
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</section>
	</div>
</div>

{#if game.claimed}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="raid-claimed-title"
	>
		<div class="sticker pop-in flex max-w-sm flex-col gap-3 p-5" style:--tilt="-1deg">
			<h2 id="raid-claimed-title" class="font-display text-2xl font-bold">
				{m.raid_season_claimed_title()}
			</h2>
			<ul class="flex flex-col gap-1.5">
				{#each game.claimed as reward, index (index)}
					<li class="reward flex items-center gap-2" style:animation-delay="{index * 90}ms">
						{#if reward.type === 'gold'}
							<IconCoins class="size-7 text-mustard" aria-hidden="true" />
						{:else if reward.type === 'scrap'}
							<IconSettings class="size-7 opacity-70" aria-hidden="true" />
						{:else if reward.type === 'crystal'}
							<RaidCrystalIcon
								kind={reward.crystal.kind}
								rarity={reward.crystal.rarity}
								class="size-7"
							/>
						{:else}
							<RaidItemIcon kind={reward.kind} rarity={reward.rarity} class="size-8" />
						{/if}
						<span dir="auto" class="font-display text-sm font-bold">{seasonRewardText(reward)}</span
						>
					</li>
				{/each}
			</ul>
			<!-- svelte-ignore a11y_autofocus -->
			<button
				type="button"
				class="btn-chunky bg-explosion-yellow"
				autofocus
				onclick={() => game.dismissClaimed()}
			>
				{m.raid_season_close()}
			</button>
		</div>
	</div>
{/if}

<style>
	.reward {
		animation: reward-in 380ms ease-out both;
	}

	@keyframes reward-in {
		from {
			opacity: 0;
			translate: 0 8px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.reward {
			animation: none;
		}
	}
</style>
