<!--
	Raid lobby between raids, laid out for landscape: the raider's level and season progress in one
	card (tap it for the season's rewards), the three battlefields (tap one to start the raid),
	the live event running now or coming next and today's quests. Beside them the loadout (two
	weapons, helmet, vest and boots; tap a weapon for all its stats and skills) with gold upgrades
	and socketed crystals, the loose crystals (socketed from here, or combined five into one
	rarer), and the stash, where each piece can be equipped or salvaged for gold and scrap.
-->
<script lang="ts">
	import { onMount } from 'svelte';
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
	import { liveEventAt, nextLiveEvent } from '#lib/game/raid/events.js';
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
	import { hoursUntilNewQuests, questDone } from '#lib/game/raid/quests.js';
	import { seasonNumber, seasonTier, seasonTierProgress } from '#lib/game/raid/season.js';
	import { rememberDetailsItem, type RaidGame } from '#lib/stores/raidGame.svelte.js';
	import Avatar from './Avatar.svelte';
	import RaidCrystalIcon from './RaidCrystalIcon.svelte';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import RaidSeasonScreen from './RaidSeasonScreen.svelte';
	import {
		crystalEffect,
		crystalName,
		EVENT_HINTS,
		EVENT_NAMES,
		formatTime,
		itemName,
		MAP_DESCRIPTIONS,
		MAP_NAMES,
		PERK_HINTS,
		questText,
		RARITY_NAMES,
		seasonRewardText,
		SKILL_NAMES,
		WEAPON_NAMES,
		WEAPON_TRAITS
	} from './raidText';
	import IconChevronRight from '~icons/lucide/chevron-right';
	import IconCoins from '~icons/lucide/coins';
	import IconGift from '~icons/lucide/gift';
	import IconListChecks from '~icons/lucide/list-checks';
	import IconPlay from '~icons/lucide/play';
	import IconRepeat from '~icons/lucide/repeat';
	import IconSettings from '~icons/lucide/settings';
	import IconZap from '~icons/lucide/zap';

	let { game, onStart }: { game: RaidGame; onStart: (map: MapId) => void } = $props();

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
	let showSeason = $state(false);

	/** The wall clock, ticking every second for the live event and quest countdowns */
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

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

	/** The weapon's own page with all its stats and skills, showing this very weapon */
	const detailsHref = (item: Extract<GearItem, { type: 'weapon' }>) =>
		resolve('/play/raid/weapons/[kind]', { kind: item.kind });
	const openDetails = (item: GearItem) => rememberDetailsItem(item.id);

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

	// Season, shown with the level
	const season = $derived(profile.season);
	const reached = $derived(seasonTier(season.xp));
	const tierProgress = $derived(seasonTierProgress(season.xp));
	const claimable = $derived(reached - season.claimed);

	// Live events and quests
	const liveEvent = $derived(liveEventAt(now));
	const nextEvent = $derived(nextLiveEvent(now));
	const questHours = $derived(hoursUntilNewQuests(now));
</script>

<div class="grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
	<div class="flex flex-col gap-3">
		<!-- Level and season in one card; tap it for the season's rewards -->
		<button
			type="button"
			class="sticker sticker-interactive flex items-center gap-3 p-3 text-start"
			style:--tilt="-0.5deg"
			aria-label="{m.raid_lobby_level({ level: profile.level })}, {m.raid_season_open()}"
			onclick={() => (showSeason = true)}
		>
			<!-- The player's own agent, with the raider level pinned to it -->
			<span
				class="relative size-14 shrink-0 rounded-full border-3 border-ink bg-flag-blue/25 font-display leading-none font-bold"
			>
				<span class="block size-full overflow-hidden rounded-full">
					<Avatar size={56} class="ms-[-3px] -mt-1" />
				</span>
				<span
					class="absolute -start-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full border-2 border-ink bg-explosion-yellow text-xs tabular-nums"
					>{profile.level}</span
				>
				{#if claimable > 0}
					<span
						class="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full border-2 border-ink bg-tie-red text-[0.65rem] text-paper"
						>{claimable}</span
					>
				{/if}
			</span>
			<span class="flex min-w-0 flex-1 flex-col gap-1 font-display">
				<span class="flex items-baseline justify-between gap-2">
					<span class="text-lg font-bold">{m.raid_lobby_level({ level: profile.level })}</span>
					<span class="text-xs font-bold tabular-nums opacity-80"
						>{m.raid_lobby_xp({ xp: profile.xp, next: game.xpNeeded })}</span
					>
				</span>
				<span class="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-sand">
					<span class="block h-full bg-flag-blue" style:width="{xpShare * 100}%"></span>
				</span>
				<span class="flex items-center gap-2 text-xs font-bold">
					<span class="shrink-0"
						>{m.raid_season_title({ number: seasonNumber(season.id) })} · {m.raid_season_tier({
							tier: reached,
							max: SEASON_TIERS
						})}</span
					>
					<span class="h-2 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand">
						<span
							class="block h-full bg-mustard"
							style:width="{tierProgress.needed > 0
								? (tierProgress.xp / tierProgress.needed) * 100
								: 100}%"
						></span>
					</span>
				</span>
			</span>
			<span class="flex flex-col items-end gap-0.5 font-display font-bold tabular-nums">
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
			</span>
			<IconChevronRight class="size-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
		</button>

		<!-- Battlefields: a tap starts the raid -->
		<section class="flex flex-col gap-2">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="font-display text-lg font-bold">{m.raid_lobby_choose_map()}</h2>
				<span class="text-xs font-semibold opacity-80">{m.raid_lobby_tap_map()}</span>
			</div>
			<div class="grid grid-cols-3 gap-2">
				{#each MAP_IDS as id (id)}
					{@const map = raidMap(id)}
					{@const best = profile.bestTimeMs[id]}
					<button
						type="button"
						class="sticker sticker-interactive group flex flex-col gap-1 p-2 text-start"
						aria-label="{m.raid_start()}: {MAP_NAMES[id]()}"
						onclick={() => onStart(id)}
					>
						<span
							class="relative flex h-10 w-full items-center justify-center rounded-md border-2 border-ink"
							style:background="repeating-linear-gradient(135deg, {mapColors(id).ground} 0 14px, {mapColors(
								id
							).groundDark} 14px 20px)"
						>
							<span
								class="flex size-8 items-center justify-center rounded-full border-2 border-ink bg-tie-red text-paper transition-transform group-hover:scale-110"
							>
								<IconPlay class="size-4" aria-hidden="true" />
							</span>
						</span>
						<span dir="auto" class="font-display text-base leading-tight font-bold"
							>{MAP_NAMES[id]()}</span
						>
						<span dir="auto" class="hidden text-xs leading-snug sm:block"
							>{MAP_DESCRIPTIONS[id]()}</span
						>
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
		</section>

		<!-- Live event now, or the next one -->
		<section
			class="flex items-center gap-2 rounded-xl border-3 border-ink p-2"
			class:bg-explosion-yellow={liveEvent}
			class:bg-paper={!liveEvent}
			aria-live="polite"
		>
			<IconZap class="size-6 shrink-0" aria-hidden="true" />
			<div class="flex min-w-0 flex-col leading-tight">
				{#if liveEvent}
					<span class="font-display text-sm font-bold"
						>{m.raid_event_live({ event: EVENT_NAMES[liveEvent.kind]() })} · {m.raid_event_seconds({
							seconds: Math.max(0, Math.ceil((liveEvent.endsAt - now) / 1000))
						})}</span
					>
					<span dir="auto" class="text-xs">{EVENT_HINTS[liveEvent.kind]()}</span>
				{:else}
					<span class="font-display text-sm font-bold"
						>{m.raid_event_next({
							event: EVENT_NAMES[nextEvent.kind](),
							time: formatTime(nextEvent.startsAt - now)
						})}</span
					>
					<span dir="auto" class="text-xs opacity-80">{EVENT_HINTS[nextEvent.kind]()}</span>
				{/if}
			</div>
		</section>

		<!-- Daily quests -->
		<section class="sticker flex flex-col gap-2 p-3" style:--tilt="0.4deg">
			<div class="flex items-baseline justify-between gap-2 font-display">
				<h2 class="flex items-center gap-1.5 text-lg font-bold">
					<IconListChecks class="size-5" aria-hidden="true" />{m.raid_quests_title()}
				</h2>
				<span class="text-xs font-bold opacity-80"
					>{m.raid_quests_new_in({ hours: questHours })}</span
				>
			</div>
			<ul class="flex flex-col gap-1.5">
				{#each profile.quests.quests as quest, index (index)}
					{@const done = questDone(quest)}
					<li class="flex items-center gap-2">
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span dir="auto" class="text-sm leading-tight font-semibold">{questText(quest)}</span>
							<span class="flex items-center gap-2">
								<span class="h-2 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sand">
									<span
										class="block h-full"
										class:bg-khaki={done}
										class:bg-flag-blue={!done}
										style:width="{Math.min(1, quest.progress / quest.target) * 100}%"
									></span>
								</span>
								<span class="font-display text-[0.65rem] font-bold tabular-nums"
									>{quest.progress}/{quest.target}</span
								>
							</span>
							<span class="text-[0.65rem] font-bold opacity-75"
								>{m.raid_quest_reward_xp({ xp: quest.reward.xp })}{quest.reward.gold
									? ` · ${m.raid_reward_gold({ amount: quest.reward.gold })}`
									: ''}{quest.reward.scrap
									? ` · ${m.raid_reward_scrap({ amount: quest.reward.scrap })}`
									: ''}</span
							>
						</div>
						{#if quest.claimed}
							<span class="rounded bg-khaki px-1.5 font-display text-xs font-bold text-paper"
								>{m.raid_quest_claimed()}</span
							>
						{:else}
							<button
								type="button"
								class="btn-chunky px-2 py-1 text-xs"
								class:bg-explosion-yellow={done}
								disabled={!done}
								onclick={() => game.claimQuest(index)}
							>
								<IconGift class="size-3.5" aria-hidden="true" />
								{m.raid_quest_claim()}
							</button>
						{/if}
					</li>
				{/each}
			</ul>
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
							{#if item.type === 'weapon'}
								<!-- A weapon opens its own page with all stats and skills -->
								<a
									href={detailsHref(item)}
									onclick={() => openDetails(item)}
									class="shrink-0 rounded-lg hover:scale-105"
								>
									<RaidItemIcon kind={item.kind} rarity={item.rarity} class="size-12" />
									<span class="sr-only">{m.raid_weapon_details()}</span>
								</a>
							{:else}
								<RaidItemIcon kind={iconKind(item)} rarity={item.rarity} class="size-12 shrink-0" />
							{/if}
							<div class="flex min-w-0 flex-1 flex-col leading-tight">
								<span class="text-[0.65rem] font-bold uppercase opacity-70"
									>{SLOT_LABELS[slot]()}</span
								>
								{#if item.type === 'weapon'}
									<a
										href={detailsHref(item)}
										onclick={() => openDetails(item)}
										dir="auto"
										class="truncate font-display text-sm font-bold underline decoration-2 underline-offset-2"
										>{itemName(item)}</a
									>
								{:else}
									<span dir="auto" class="truncate font-display text-sm font-bold"
										>{itemName(item)}</span
									>
								{/if}
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
											href={detailsHref(item)}
											onclick={() => openDetails(item)}
										>
											{m.raid_weapon_details()}
											<IconChevronRight class="size-3.5 rtl:rotate-180" aria-hidden="true" />
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
							{#if selected.type === 'weapon'}
								<a
									class="btn-chunky px-2 py-1 text-xs"
									href={detailsHref(selected)}
									onclick={() => openDetails(selected)}
								>
									{m.raid_weapon_details()}
									<IconChevronRight class="size-3.5 rtl:rotate-180" aria-hidden="true" />
								</a>
							{/if}
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

{#if showSeason}
	<RaidSeasonScreen
		{season}
		onClaim={() => game.claimSeason()}
		onClose={() => (showSeason = false)}
	/>
{/if}

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
