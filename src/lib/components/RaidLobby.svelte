<!--
	Raid lobby between raids, in the brawler look of the other raid screens and laid out for
	landscape. Above the fold the battlefield open right now (one at a time, the next takes over
	every twelve hours) with its countdown and the one coming next, the three ways to play it (the
	endless hunt, the three-minute boss fight or the wave defense of a command post) as big
	buttons, and beside them the raider's level and season card (tap it for the season's rewards),
	gold and scrap, the live event and room for the squad. Further down today's quests with their
	claim buttons, the loadout (two weapons, helmet, vest and boots; tap a weapon for all its stats
	and skills) with gold upgrades and socketed crystals, the loose crystals (socketed from here, or
	combined five into one rarer) and the stash, where each piece can be equipped or salvaged for
	gold and scrap.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import {
		BOSS_FIGHT_MS,
		CRYSTAL_COMBINE_COUNT,
		RARITY_COLOR,
		SEASON_TIERS,
		STASH_SIZE,
		WEAPONS,
		type MapId,
		type RaidMode
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
	import { rotationAt } from '#lib/game/raid/rotation.js';
	import { seasonNumber, seasonTier, seasonTierProgress } from '#lib/game/raid/season.js';
	import { rememberDetailsItem, type RaidGame } from '#lib/stores/raidGame.svelte.js';
	import Avatar from './Avatar.svelte';
	import RaidCrystalIcon from './RaidCrystalIcon.svelte';
	import RaidItemIcon from './RaidItemIcon.svelte';
	import RaidQuestCard from './RaidQuestCard.svelte';
	import RaidSeasonScreen from './RaidSeasonScreen.svelte';
	import {
		BOSS_NAMES,
		crystalEffect,
		crystalName,
		EVENT_HINTS,
		EVENT_NAMES,
		formatTime,
		itemName,
		MAP_DESCRIPTIONS,
		MAP_NAMES,
		PERK_HINTS,
		RARITY_NAMES,
		seasonRewardText,
		SKILL_NAMES,
		WEAPON_NAMES,
		WEAPON_TRAITS
	} from './raidText';
	import IconChevronRight from '~icons/lucide/chevron-right';
	import IconCoins from '~icons/lucide/coins';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconGift from '~icons/lucide/gift';
	import IconRepeat from '~icons/lucide/repeat';
	import IconShield from '~icons/lucide/shield';
	import IconSkull from '~icons/lucide/skull';
	import IconTimer from '~icons/lucide/timer';
	import IconWrench from '~icons/lucide/wrench';
	import IconZap from '~icons/lucide/zap';

	let {
		game,
		onStart,
		squad
	}: { game: RaidGame; onStart: (map: MapId, mode: RaidMode) => void; squad?: Snippet } = $props();

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

	/** The wall clock, ticking every second for the rotation, live event and quest countdowns */
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

	// Small skewed buttons in the raid screens' colours
	const BUTTON =
		'inline-flex -skew-x-6 items-center gap-1 rounded-md px-2.5 py-1 font-display text-xs leading-tight font-black text-white uppercase italic shadow-[0_2px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 disabled:opacity-45 disabled:active:translate-y-0';
	const ORANGE = 'border-b-3 border-[#b84300] bg-linear-to-b from-[#ff9a3c] to-[#ff6a10]';
	const PURPLE = 'border-b-3 border-[#4b1d8f] bg-[#7a3fe0]';
	const TEAL = 'border-b-3 border-[#0f7f73] bg-[#22c3b0]';
	const MUTED = 'border-b-3 border-black/30 bg-white/15';

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

	/** Hours, minutes and seconds, such as 05:07:42 */
	function clock(ms: number): string {
		const seconds = Math.max(0, Math.ceil(ms / 1000));
		return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
			.map((part) => String(part).padStart(2, '0'))
			.join(':');
	}

	const xpShare = $derived(Math.min(1, profile.xp / game.xpNeeded));

	// The battlefield open right now
	const rotation = $derived(rotationAt(now));
	const map = $derived(rotation.map);
	const mapInfo = $derived(raidMap(map));
	interface ModeCard {
		id: RaidMode;
		icon: typeof IconCrosshair;
		name: string;
		hint: string;
		best: string | null;
		color: string;
		bestColor: string;
	}

	/** The ways to play it, each with the player's best on this battlefield */
	const modes = $derived.by((): ModeCard[] => {
		const huntBest = profile.bestTimeMs[map];
		const bossBest = profile.bossBestMs[map];
		const defenseBest = profile.defenseBestWave[map];
		return [
			{
				id: 'hunt',
				icon: IconCrosshair,
				name: m.raid_lobby_mode_hunt(),
				hint: m.raid_lobby_mode_hunt_hint(),
				best: huntBest ? m.raid_map_best({ time: formatTime(huntBest) }) : null,
				color: 'border-[#b84300] bg-linear-to-b from-[#ff9a3c] to-[#ff6a10]',
				bestColor: 'text-[#fff1c2]'
			},
			{
				id: 'boss',
				icon: IconSkull,
				name: m.raid_lobby_mode_boss(),
				hint: m.raid_lobby_mode_boss_hint({
					boss: BOSS_NAMES[map](),
					time: formatTime(BOSS_FIGHT_MS)
				}),
				best: bossBest
					? m.raid_lobby_boss_best({ time: formatTime(bossBest) })
					: m.raid_lobby_boss_unbeaten(),
				color: 'border-[#4b1d8f] bg-[#7a3fe0]',
				bestColor: 'text-[#e2c9ff]'
			},
			{
				id: 'defense',
				icon: IconShield,
				name: m.raid_lobby_mode_defense(),
				hint: m.raid_lobby_mode_defense_hint(),
				best: defenseBest ? m.raid_lobby_defense_best({ wave: defenseBest }) : null,
				color: 'border-[#0f7f73] bg-[#22c3b0]',
				bestColor: 'text-[#d6fff8]'
			}
		];
	});

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

<div class="flex w-full flex-col gap-5 text-white">
	<!-- Above the fold: the battlefield and how to play it, the raider beside it -->
	<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,17rem)]">
		<div class="flex min-w-0 flex-col gap-3">
			<!-- The battlefield open now, in its own colours -->
			<section
				class="relative overflow-hidden rounded-2xl shadow-[0_4px_0_rgb(0_0_0/0.3)]"
				style:background="repeating-linear-gradient(135deg, {mapInfo.palette.ground} 0 22px, {mapInfo
					.palette.groundDark} 22px 32px)"
				aria-labelledby="raid-lobby-map"
			>
				<div
					class="flex min-h-40 flex-col gap-1.5 bg-linear-to-r from-[#12082e]/90 via-[#12082e]/60 to-[#12082e]/10 p-3 rtl:bg-linear-to-l"
				>
					<div class="flex flex-wrap items-center gap-2 font-display text-xs font-black uppercase">
						<span
							class="-skew-x-6 rounded bg-[#22c3b0] px-2 py-0.5 italic shadow-[0_2px_0_rgb(0_0_0/0.25)]"
							>{m.raid_lobby_open_now()}</span
						>
						<span class="flex items-center gap-1 tabular-nums" aria-live="off">
							<IconTimer class="size-4" aria-hidden="true" />
							{m.raid_lobby_closes_in({ time: clock(rotation.endsAt - now) })}
						</span>
						<span
							dir="auto"
							class="ms-auto rounded bg-black/45 px-2 py-0.5 text-white/90 normal-case"
							title={m.raid_lobby_rotation_hint()}
							>{m.raid_lobby_next_map({ map: MAP_NAMES[rotation.next]() })}</span
						>
					</div>
					<h2
						id="raid-lobby-map"
						dir="auto"
						class="title font-display text-4xl leading-none font-black uppercase italic"
					>
						{MAP_NAMES[map]()}
					</h2>
					<p
						dir="auto"
						class="max-w-md text-sm leading-snug font-semibold text-white/90 drop-shadow-[0_1px_0_rgb(0_0_0/0.5)]"
					>
						{MAP_DESCRIPTIONS[map]()}
					</p>
					<div class="mt-auto flex flex-wrap items-center gap-1.5 font-display text-xs font-black">
						<span class="rounded bg-[#e0413a] px-1.5 py-0.5"
							>{m.raid_map_danger({ value: mapInfo.difficulty })}</span
						>
						<span class="rounded bg-[#ffc83a] px-1.5 py-0.5 text-[#3d1478]"
							>{m.raid_map_reward({ value: mapInfo.reward })}</span
						>
						<span dir="auto" class="text-[0.7rem] font-bold text-white/75"
							>{m.raid_lobby_rotation_hint()}</span
						>
					</div>
				</div>
			</section>

			<!-- The three ways to play it -->
			<div class="grid grid-cols-3 gap-2.5 px-1">
				{#each modes as mode (mode.id)}
					<button
						type="button"
						class="mode flex -skew-x-6 flex-col items-start gap-0.5 rounded-xl border-b-5 px-2.5 py-2 text-start shadow-[0_4px_0_rgb(0_0_0/0.25)] active:translate-y-0.5 {mode.color}"
						onclick={() => onStart(map, mode.id)}
					>
						<span class="flex max-w-full items-center gap-1.5">
							<mode.icon class="size-6 shrink-0 stroke-[2.5]" aria-hidden="true" />
							<span
								class="min-w-0 font-display text-lg leading-none font-black break-words uppercase italic drop-shadow-[0_2px_0_rgb(0_0_0/0.2)]"
								>{mode.name}</span
							>
						</span>
						<span dir="auto" class="text-[0.7rem] leading-tight font-bold">{mode.hint}</span>
						{#if mode.best}
							<span class="font-display text-[0.7rem] leading-tight font-black {mode.bestColor}"
								>{mode.best}</span
							>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex min-w-0 flex-col gap-3">
			<!-- Level and season in one card; tap it for the season's rewards -->
			<button
				type="button"
				class="flex items-center gap-3 rounded-xl bg-[#1b0b3a]/80 p-2.5 text-start shadow-[0_3px_0_rgb(0_0_0/0.3)] active:translate-y-0.5"
				aria-label="{m.raid_lobby_level({ level: profile.level })}, {m.raid_season_open()}"
				onclick={() => (showSeason = true)}
			>
				<!-- The player's own agent, with the raider level pinned to it -->
				<span class="relative size-14 shrink-0 rounded-full bg-[#7a3fe0] ring-3 ring-white/80">
					<span class="block size-full overflow-hidden rounded-full">
						<Avatar size={56} class="ms-[-3px] -mt-1" />
					</span>
					<span
						class="absolute -start-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full bg-[#ffc83a] font-display text-xs font-black text-[#3d1478] tabular-nums shadow-[0_2px_0_rgb(0_0_0/0.3)]"
						>{profile.level}</span
					>
					{#if claimable > 0}
						<span
							class="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#ff6b3d] font-display text-[0.65rem] font-black ring-2 ring-white"
							>{claimable}</span
						>
					{/if}
				</span>
				<span class="flex min-w-0 flex-1 flex-col gap-1 font-display font-bold">
					<span class="flex items-center gap-2 text-sm leading-none font-black uppercase italic">
						<span>{m.raid_lobby_level({ level: profile.level })}</span>
						<span class="text-[0.65rem] text-white/75">{m.raid_lobby_xp({ xp: profile.xp, next: game.xpNeeded })}</span>
					</span>
					<span class="h-3 w-full overflow-hidden rounded-full bg-black/35">
						<span class="block h-full rounded-full bg-[#7fd3ff]" style:width="{xpShare * 100}%"></span>
					</span>
				</span>
				<IconChevronRight class="size-5 shrink-0 opacity-70 rtl:rotate-180" aria-hidden="true" />
			</button>

			<!-- Gold and scrap -->
			<div class="flex gap-2 font-display text-base font-black tabular-nums">
				<span class="flex flex-1 items-center gap-1.5 rounded-lg bg-[#1b0b3a]/60 px-2.5 py-1">
					<IconCoins class="size-5 text-[#ffd23a]" aria-hidden="true" />
					<span class="sr-only">{m.raid_lobby_gold({ gold: profile.gold })}</span>
					<span aria-hidden="true">{profile.gold}</span>
				</span>
				<span class="flex flex-1 items-center gap-1.5 rounded-lg bg-[#1b0b3a]/60 px-2.5 py-1">
					<IconWrench class="size-5 text-[#c9ced4]" aria-hidden="true" />
					<span class="sr-only">{m.raid_lobby_scrap({ scrap: profile.scrap })}</span>
					<span aria-hidden="true">{profile.scrap}</span>
				</span>
			</div>

			<!-- Live event now, or the next one -->
			<section
				class="flex items-center gap-2 rounded-xl px-2.5 py-1.5 {liveEvent
					? 'bg-linear-to-r from-[#ffc83a] to-[#ff9a3c] text-[#3d1478]'
					: 'bg-[#1b0b3a]/60'}"
				aria-live="polite"
			>
				<IconZap
					class="size-5 shrink-0 {liveEvent ? 'fill-[#3d1478]' : 'text-[#ffc83a]'}"
					aria-hidden="true"
				/>
				<div class="flex min-w-0 flex-col leading-tight">
					{#if liveEvent}
						<span class="font-display text-xs font-black uppercase italic"
							>{m.raid_event_live({ event: EVENT_NAMES[liveEvent.kind]() })} · {m.raid_event_seconds(
								{
									seconds: Math.max(0, Math.ceil((liveEvent.endsAt - now) / 1000))
								}
							)}</span
						>
						<span dir="auto" class="truncate text-[0.7rem] font-semibold"
							>{EVENT_HINTS[liveEvent.kind]()}</span
						>
					{:else}
						<span class="font-display text-xs font-black"
							>{m.raid_event_next({
								event: EVENT_NAMES[nextEvent.kind](),
								time: formatTime(nextEvent.startsAt - now)
							})}</span
						>
						<span dir="auto" class="truncate text-[0.7rem] text-white/75"
							>{EVENT_HINTS[nextEvent.kind]()}</span
						>
					{/if}
				</div>
			</section>

			{#if squad}
				<!-- The squad going in with the raider, beside the play buttons -->
				<div class="mt-auto min-h-16">
					{@render squad()}
				</div>
			{/if}
		</div>
	</div>

	<!-- Daily quests -->
	<section class="flex flex-col gap-1" aria-labelledby="raid-lobby-quests">
		<div class="flex items-baseline justify-between gap-2">
			<h2 id="raid-lobby-quests" class="heading">{m.raid_quests_title()}</h2>
			<span class="font-display text-xs font-bold text-white/75"
				>{m.raid_quests_new_in({ hours: questHours })}</span
			>
		</div>
		<ul class="grid gap-3 ps-2 pt-2 sm:grid-cols-3">
			{#each profile.quests.quests as quest, index (index)}
				{@const done = questDone(quest)}
				<li class="flex min-w-0 flex-col gap-1.5">
					<RaidQuestCard {quest} before={quest.progress} compact />
					<div class="flex items-center justify-between gap-2 font-display text-xs font-bold">
						<span class="flex items-center gap-2 tabular-nums">
							{#if quest.reward.gold}
								<span class="flex items-center gap-0.5"
									><IconCoins class="size-3.5 text-[#ffd23a]" aria-hidden="true" /><span
										class="sr-only">{m.raid_reward_gold({ amount: quest.reward.gold })}</span
									><span aria-hidden="true">{quest.reward.gold}</span></span
								>
							{/if}
							{#if quest.reward.scrap}
								<span class="flex items-center gap-0.5"
									><IconWrench class="size-3.5 text-[#c9ced4]" aria-hidden="true" /><span
										class="sr-only">{m.raid_reward_scrap({ amount: quest.reward.scrap })}</span
									><span aria-hidden="true">{quest.reward.scrap}</span></span
								>
							{/if}
						</span>
						{#if quest.claimed}
							<span class="-skew-x-6 rounded bg-white/15 px-2 py-0.5 font-black uppercase italic"
								>{m.raid_quest_claimed()}</span
							>
						{:else}
							<button
								type="button"
								class="{BUTTON} {done ? ORANGE : MUTED}"
								disabled={!done}
								onclick={() => game.claimQuest(index)}
							>
								<IconGift class="size-3.5" aria-hidden="true" />
								{m.raid_quest_claim()}
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</section>

	<div class="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
		<!-- Loadout -->
		<section class="flex min-w-0 flex-col gap-2" aria-labelledby="raid-lobby-loadout">
			<div class="flex items-center justify-between gap-2">
				<h2 id="raid-lobby-loadout" class="heading">{m.raid_lobby_loadout()}</h2>
				<button type="button" class="{BUTTON} {PURPLE}" onclick={() => game.swapLoadoutWeapons()}>
					<IconRepeat class="size-3.5" aria-hidden="true" />
					{m.raid_swap_weapons()}
				</button>
			</div>
			<ul class="grid gap-2 sm:grid-cols-2">
				{#each SLOTS as slot (slot)}
					{@const item = profile.loadout[slot]}
					{@const cost = item ? upgradeCost(item) : null}
					<li
						class="flex items-start gap-2 rounded-xl border-s-4 bg-[#2a1a52]/85 p-2 shadow-[0_3px_0_rgb(0_0_0/0.3)]"
						style:border-color={item ? RARITY_COLOR[item.rarity] : 'rgb(255 255 255 / 0.2)'}
					>
						{#if item}
							{#if item.type === 'weapon'}
								<!-- A weapon opens its own page with all stats and skills -->
								<a
									href={detailsHref(item)}
									onclick={() => openDetails(item)}
									class="shrink-0 rounded-lg bg-[#1b0b3a]/80 p-1 transition-transform hover:scale-105"
								>
									<RaidItemIcon kind={item.kind} rarity={item.rarity} class="size-12" />
									<span class="sr-only">{m.raid_weapon_details()}</span>
								</a>
							{:else}
								<span class="shrink-0 rounded-lg bg-[#1b0b3a]/80 p-1">
									<RaidItemIcon kind={iconKind(item)} rarity={item.rarity} class="size-12" />
								</span>
							{/if}
							<div class="flex min-w-0 flex-1 flex-col leading-tight">
								<span class="font-display text-[0.65rem] font-black text-white/60 uppercase"
									>{SLOT_LABELS[slot]()}</span
								>
								{#if item.type === 'weapon'}
									<a
										href={detailsHref(item)}
										onclick={() => openDetails(item)}
										dir="auto"
										class="truncate font-display text-sm font-black underline decoration-white/40 decoration-2 underline-offset-2"
										>{itemName(item)}</a
									>
								{:else}
									<span dir="auto" class="truncate font-display text-sm font-black"
										>{itemName(item)}</span
									>
								{/if}
								<span class="text-xs font-bold" style:color={RARITY_COLOR[item.rarity]}
									>{RARITY_NAMES[item.rarity]()} · {m.raid_item_level({ level: item.level })}</span
								>
								<span class="text-xs font-semibold">{statLine(item)}</span>
								{#if traitLine(item)}
									<span dir="auto" class="text-[0.7rem] leading-snug text-white/70"
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
												class="block size-6 rounded-full border-2 border-dashed border-white/35"
												title={m.raid_crystal_empty_socket()}
											></span>
										{/each}
									</span>
								{/if}
								<div class="mt-1.5 flex flex-wrap gap-1.5">
									<button
										type="button"
										class="{BUTTON} {cost !== null && cost <= profile.gold ? ORANGE : MUTED}"
										disabled={cost === null || cost > profile.gold}
										onclick={() => game.upgrade(slot)}
									>
										{cost === null ? m.raid_upgrade_max() : m.raid_upgrade({ cost })}
									</button>
									{#if item.type === 'weapon'}
										<a
											class="{BUTTON} {TEAL}"
											href={detailsHref(item)}
											onclick={() => openDetails(item)}
										>
											{m.raid_weapon_details()}
											<IconChevronRight class="size-3.5 rtl:rotate-180" aria-hidden="true" />
										</a>
									{:else}
										<button
											type="button"
											class="{BUTTON} {MUTED}"
											disabled={profile.stash.length >= STASH_SIZE}
											onclick={() => game.unequip(item.slot)}
										>
											{m.raid_unequip()}
										</button>
									{/if}
								</div>
							</div>
						{:else}
							<span class="shrink-0 rounded-lg bg-[#1b0b3a]/60 p-1">
								<RaidItemIcon
									kind={slot === 'primary' || slot === 'secondary' ? 'rifle' : slot}
									class="size-12 opacity-30"
								/>
							</span>
							<div class="flex flex-col leading-tight">
								<span class="font-display text-[0.65rem] font-black text-white/60 uppercase"
									>{SLOT_LABELS[slot]()}</span
								>
								<span class="text-sm text-white/75">{m.raid_slot_empty()}</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<div class="flex min-w-0 flex-col gap-5">
			<!-- Crystals -->
			<section class="flex flex-col gap-2" aria-labelledby="raid-lobby-crystals">
				<h2 id="raid-lobby-crystals" class="heading">{m.raid_lobby_crystals()}</h2>
				{#if stock.length === 0}
					<p dir="auto" class="rounded-xl bg-[#1b0b3a]/60 px-3 py-2 text-sm text-white/85">
						{m.raid_lobby_crystals_empty()}
					</p>
				{:else}
					<ul class="flex flex-wrap gap-2">
						{#each stock as { crystal, count } (`${crystal.kind}:${crystal.rarity}`)}
							{@const active =
								selectedCrystal?.kind === crystal.kind &&
								selectedCrystal?.rarity === crystal.rarity}
							<li>
								<button
									type="button"
									class="relative block rounded-xl bg-[#1b0b3a]/80 p-1 {active
										? 'ring-3 ring-white'
										: ''}"
									aria-pressed={active}
									aria-label="{crystalName(crystal)} ×{count}"
									title="{crystalName(crystal)}: {crystalEffect(crystal)}"
									onclick={() => (selectedCrystal = active ? null : crystal)}
								>
									<RaidCrystalIcon kind={crystal.kind} rarity={crystal.rarity} class="size-10" />
									<span
										class="absolute -end-1 -bottom-1 rounded bg-black/75 px-1 font-display text-[0.6rem] font-black tabular-nums"
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
							class="flex flex-wrap items-center gap-2 rounded-xl border-s-4 bg-[#2a1a52]/85 p-2"
							style:border-color={RARITY_COLOR[crystal.rarity]}
						>
							<div class="flex min-w-0 flex-1 flex-col leading-tight">
								<span dir="auto" class="font-display text-sm font-black"
									>{crystalName(crystal)}</span
								>
								<span dir="auto" class="text-xs text-white/80">{crystalEffect(crystal)}</span>
							</div>
							<div class="flex flex-wrap gap-1.5">
								{#each WEAPON_SLOTS as slot (slot)}
									<button
										type="button"
										class="{BUTTON} {ORANGE}"
										disabled={freeSockets(slot) <= 0}
										onclick={() => socket(slot)}
									>
										{m.raid_crystal_socket({ weapon: WEAPON_NAMES[profile.loadout[slot].kind]() })}
									</button>
								{/each}
								{#if cost !== null}
									<button
										type="button"
										class="{BUTTON} {PURPLE}"
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
			<section class="flex flex-col gap-2" aria-labelledby="raid-lobby-stash">
				<h2 id="raid-lobby-stash" class="heading">
					{m.raid_lobby_stash({ count: profile.stash.length, max: STASH_SIZE })}
				</h2>
				{#if profile.stash.length === 0}
					<p dir="auto" class="rounded-xl bg-[#1b0b3a]/60 px-3 py-2 text-sm text-white/85">
						{m.raid_lobby_stash_empty()}
					</p>
				{:else}
					<ul class="flex flex-wrap gap-2">
						{#each profile.stash as item (item.id)}
							<li>
								<button
									type="button"
									class="relative block rounded-xl bg-[#1b0b3a]/80 p-1 {selectedId === item.id
										? 'ring-3 ring-white'
										: ''}"
									aria-pressed={selectedId === item.id}
									aria-label="{itemName(item)}, {RARITY_NAMES[item.rarity]()}, {m.raid_item_level({
										level: item.level
									})}"
									onclick={() => (selectedId = selectedId === item.id ? null : item.id)}
								>
									<RaidItemIcon kind={iconKind(item)} rarity={item.rarity} class="size-11" />
									<span
										class="absolute -end-1 -bottom-1 rounded bg-black/75 px-1 font-display text-[0.6rem] font-black tabular-nums"
										>{item.level}</span
									>
									{#if isBetter(item)}
										<span
											class="absolute -start-1 -top-1 rounded-full bg-[#22c3b0] px-1 text-[0.6rem] font-black"
											>▲</span
										>
									{/if}
									{#if item.type === 'armor' && item.perk}
										<span
											class="absolute -end-1 -top-1 rounded-full bg-[#ff6b3d] px-1 text-[0.6rem] font-black"
											>★</span
										>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
					{#if selected}
						<div
							class="flex flex-wrap items-center gap-2 rounded-xl border-s-4 bg-[#2a1a52]/85 p-2"
							style:border-color={RARITY_COLOR[selected.rarity]}
						>
							<div class="flex min-w-0 flex-1 flex-col leading-tight">
								<span dir="auto" class="font-display text-sm font-black">{itemName(selected)}</span>
								<span class="text-xs font-bold" style:color={RARITY_COLOR[selected.rarity]}
									>{RARITY_NAMES[selected.rarity]()} · {m.raid_item_level({
										level: selected.level
									})}</span
								>
								<span class="text-xs font-semibold">{statLine(selected)}</span>
								{#if traitLine(selected)}
									<span dir="auto" class="text-[0.7rem] text-white/70">{traitLine(selected)}</span>
								{/if}
							</div>
							<div class="flex flex-wrap gap-1.5">
								{#each slotsFor(selected) as slot (slot)}
									<button type="button" class="{BUTTON} {ORANGE}" onclick={() => equip(slot)}>
										{m.raid_equip()}{selected.type === 'weapon' ? `: ${SLOT_LABELS[slot]()}` : ''}
									</button>
								{/each}
								{#if selected.type === 'weapon'}
									<a
										class="{BUTTON} {TEAL}"
										href={detailsHref(selected)}
										onclick={() => openDetails(selected)}
									>
										{m.raid_weapon_details()}
										<IconChevronRight class="size-3.5 rtl:rotate-180" aria-hidden="true" />
									</a>
								{/if}
								<button type="button" class="{BUTTON} {PURPLE}" onclick={salvageSelected}>
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-[#12082e]/70 p-4 text-white"
		role="dialog"
		aria-modal="true"
		aria-labelledby="raid-claimed-title"
	>
		<div
			class="pop-in flex max-w-sm flex-col gap-3 rounded-2xl bg-[radial-gradient(ellipse_at_70%_30%,#9a4fe0,#6a2bb8_55%,#3d1478)] p-5 shadow-[0_6px_0_rgb(0_0_0/0.3)]"
		>
			<h2
				id="raid-claimed-title"
				dir="auto"
				class="font-display text-2xl leading-none font-black uppercase italic"
			>
				{m.raid_season_claimed_title()}
			</h2>
			<ul class="flex flex-col gap-1.5">
				{#each game.claimed as reward, index (index)}
					<li
						class="reward flex items-center gap-2 rounded-lg bg-[#1b0b3a]/70 px-2 py-1"
						style:animation-delay="{index * 90}ms"
					>
						{#if reward.type === 'gold'}
							<IconCoins class="size-7 text-[#ffd23a]" aria-hidden="true" />
						{:else if reward.type === 'scrap'}
							<IconWrench class="size-7 text-[#c9ced4]" aria-hidden="true" />
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
				class="-skew-x-6 self-end rounded-lg border-b-4 border-[#b84300] bg-linear-to-b from-[#ff9a3c] to-[#ff6a10] px-6 py-2 font-display text-xl leading-none font-black uppercase italic shadow-[0_4px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
				autofocus
				onclick={() => game.dismissClaimed()}
			>
				{m.raid_season_close()}
			</button>
		</div>
	</div>
{/if}

<style>
	.heading {
		font-family: var(--font-display);
		font-size: 1.25rem;
		line-height: 1;
		font-weight: 900;
		font-style: italic;
		text-transform: uppercase;
		color: #e2c9ff;
	}

	.title {
		-webkit-text-stroke: 1.5px #12082e;
		paint-order: stroke fill;
		text-shadow: 0 3px 0 rgb(0 0 0 / 0.35);
	}

	.mode {
		transition:
			translate 120ms ease-out,
			filter 120ms ease-out;
	}

	.mode:hover {
		filter: brightness(1.08);
	}

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

		.mode {
			transition: none;
		}
	}
</style>
