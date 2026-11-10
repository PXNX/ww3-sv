<!--
	The window of a building or defence, in the manner of a base builder. The picture stands on the
	left on a lit tile with its level; on the right every number is a bar, and in the upgrade view the
	part the next level adds is shown in green. For the headquarters everything it unlocks is listed.
	The build time and a big green button with the price are at the bottom. The info view shows the
	same picture and bars for the level it has now, with what it does in a line of text.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { OVERCHARGE_CRYSTALS, type OverchargeCrystal } from '#lib/game/beachhead/crystals.js';
	import { crystalName } from '#lib/components/beachheadText.js';
	import CrystalIcon from '#lib/components/CrystalIcon.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import {
		boatCapacity,
		boatsAtHq,
		type BuildingKey,
		type Resources
	} from '#lib/game/beachhead/campaign.js';
	import {
		DEFENSE_LEVEL_GAIN,
		buildingHpScale,
		GUARD_KINDS,
		GUARD_UNLOCK_HQ,
		MAX_DEFENSE_LEVEL,
		defenseLevel,
		isLayoutKey
	} from '#lib/game/beachhead/baseLayout.js';
	import {
		BASE_CHARTED_ISLANDS,
		BUILDINGS,
		MINES,
		isMine,
		type BuildingKind
	} from '#lib/game/beachhead/config.js';
	import { buildingName } from '#lib/components/beachheadText.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconArrowBigUp from '~icons/lucide/arrow-big-up';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconShip from '~icons/lucide/ship';
	import IconStar from '~icons/lucide/star';

	let {
		game,
		building,
		defenseId,
		mode = 'upgrade',
		hint = ''
	}: {
		game: BeachheadGame;
		building: string;
		defenseId?: number;
		/** What it is now, or what the next level brings */
		mode?: 'info' | 'upgrade';
		/** What it does, in a line, for the info view */
		hint?: string;
	} = $props();

	/** A placed mine, gun or hedgehog being looked at instead of a building */
	const defense = $derived(
		defenseId === undefined ? null : (game.layout.mines.find((d) => d.id === defenseId) ?? null)
	);
	/** A ticking clock for the countdown while a builder raises this defence */
	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const defenseLeft = $derived.by(() => {
		void now;
		return defense ? game.defenseRemaining(defense.id) : null;
	});
	/** The overcharge slot of what the popup shows; every main building and every defence has one */
	const crystalTarget = $derived(
		defense
			? `defense:${defense.id}`
			: ['hq', 'bunker', 'training', 'dojo', 'radar'].includes(building)
				? building
				: null
	);
	const crystalHere = $derived(crystalTarget ? (game.crystals.slots[crystalTarget] ?? null) : null);
	function cycleCrystal() {
		if (!crystalTarget) return;
		const choices: (OverchargeCrystal | null)[] = [...OVERCHARGE_CRYSTALS, null];
		const at = choices.indexOf(crystalHere);
		game.setOvercharge(crystalTarget, choices[(at + 1) % choices.length]);
	}
	const defenseNow = $derived(defense ? defenseLevel(defense) : 1);
	const defenseNext = $derived(Math.min(MAX_DEFENSE_LEVEL, defenseNow + 1));
	const defenseCost = $derived(defense ? game.defenseUpgradeCost(defense.id) : null);
	const defenseStats = $derived.by(() => {
		const rows: { label: string; from: string; to: string }[] = [];
		if (!defense) return rows;
		const kind = defense.kind as BuildingKind;
		const base = BUILDINGS[kind];
		const hp = (level: number) => Math.round(base.hp * (1 + DEFENSE_LEVEL_GAIN.hp * (level - 1)));
		const raw = isMine(kind) ? MINES[kind].damage : base.damage;
		const damage = (level: number) =>
			Math.round(raw * (1 + DEFENSE_LEVEL_GAIN.damage * (level - 1)));
		rows.push({
			label: m.beachhead_hero_stat_hp(),
			from: `${hp(defenseNow)}`,
			to: `${hp(defenseNext)}`
		});
		if (raw > 0) {
			rows.push({
				label: m.beachhead_hero_stat_damage(),
				from: `${damage(defenseNow)}`,
				to: `${damage(defenseNext)}`
			});
		}
		// What an upgrade leaves alone is listed too, so the page shows the whole defence
		if (base.range > 0) {
			rows.push({ label: m.beachhead_stat_range(), from: `${base.range}`, to: `${base.range}` });
		}
		if (base.reloadMs > 0) {
			const rate = `${Math.round(10000 / base.reloadMs) / 10}`;
			rows.push({ label: m.beachhead_stat_rate(), from: rate, to: rate });
		}
		return rows;
	});

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	const key = $derived(building as BuildingKey);
	const level = $derived(game.levelOf(key));
	const max = $derived(game.maxLevelOf(key));
	const next = $derived(Math.min(max, level + 1));
	const cost = $derived(game.upgradeCost(key));
	const row = $derived(game.buildRowFor(key));

	const timeText = (ms: number): string => {
		const total = Math.ceil(ms / 1000);
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		return hours > 0
			? `${hours}h ${minutes}m`
			: `${minutes}m ${String(total % 60).padStart(2, '0')}s`;
	};

	/** The numbers an upgrade changes, as a list of "from → to" rows */
	const stats = $derived.by(() => {
		const rows: { label: string; from: string; to: string }[] = [];
		// Every building gets sturdier with its level
		const baseHp = key === 'hq' ? BUILDINGS.hq.hp : BUILDINGS.depot.hp;
		if (!key.startsWith('boat-')) {
			rows.push({
				label: m.beachhead_hero_stat_hp(),
				from: `${Math.round(baseHp * buildingHpScale(Math.max(1, level)))}`,
				to: `${Math.round(baseHp * buildingHpScale(next))}`
			});
		}
		if (key === 'hq') {
			rows.push({
				label: m.beachhead_stat_income(),
				from: `+${25 * (level - 1)}%`,
				to: `+${25 * (next - 1)}%`
			});
			rows.push({
				label: m.beachhead_stat_level_cap(),
				from: `${level + 1}`,
				to: `${next + 1}`
			});
			rows.push({
				label: m.beachhead_stat_boats(),
				from: `${boatsAtHq(level)}`,
				to: `${boatsAtHq(next)}`
			});
		} else if (key.startsWith('warehouse-')) {
			rows.push({
				label: m.beachhead_stat_capacity(),
				from: `${level * 500}`,
				to: `${next * 500}`
			});
			rows.push({
				label: m.beachhead_stat_secured(),
				from: `${Math.round(game.securedShare * 100)}%`,
				to: `${Math.round(game.securedShare * 100)}%`
			});
		} else if (key.startsWith('boat-')) {
			rows.push({
				label: m.beachhead_stat_boat_space(),
				from: `${boatCapacity(level)}`,
				to: `${boatCapacity(next)}`
			});
		} else if (key === 'radar') {
			rows.push({
				label: m.beachhead_stat_charted(),
				from: `${BASE_CHARTED_ISLANDS + (level - 1) * 3}`,
				to: `${BASE_CHARTED_ISLANDS + (next - 1) * 3}`
			});
		} else if (key === 'bunker') {
			rows.push({
				label: m.beachhead_stat_secured(),
				from: `${Math.round((0.2 + (level - 1) * 0.12) * 100)}%`,
				to: `${Math.round((0.2 + (next - 1) * 0.12) * 100)}%`
			});
		} else if (key === 'training' || key === 'dojo') {
			rows.push({ label: m.beachhead_stat_level_cap(), from: `${level}`, to: `${next}` });
		}
		return rows;
	});

	/** What the headquarters opens at its next level: a landing craft, guns, and the higher caps */
	const unlocks = $derived.by(() => {
		if (key !== 'hq' || level >= max) return null;
		return {
			boat: boatsAtHq(next) > boatsAtHq(level) ? boatsAtHq(next) : null,
			guns: GUARD_KINDS.filter((kind) => GUARD_UNLOCK_HQ[kind] === next)
		};
	});

	/** A number from a stat text such as "+25%" or "1200", for its bar */
	const numberOf = (text: string): number => Number.parseFloat(text.replace(/[^0-9.-]/g, ''));

	/** How a stat's bar is filled: the part it has now and the part the next level adds */
	function barOf(stat: { from: string; to: string }): { now: number; gain: number } | null {
		const from = numberOf(stat.from);
		const to = numberOf(stat.to);
		if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
		const top = Math.max(Math.abs(from), Math.abs(to)) * 1.25;
		if (top <= 0) return { now: 0, gain: 0 };
		return {
			now: (Math.abs(from) / top) * 100,
			gain: upgrading ? (Math.max(0, Math.abs(to) - Math.abs(from)) / top) * 100 : 0
		};
	}

	/** Whatever is open: its level and what upgrading it takes */
	const shown = $derived.by(() => {
		if (defense) {
			return {
				level: defenseNow,
				next: defenseNext,
				cost: defenseCost,
				remainingMs: defenseLeft,
				timeMs: game.defenseUpgradeTime(defense.id) ?? 0,
				canStart: game.canUpgradeDefense(defense.id),
				start: () => game.upgradeDefense(defense.id)
			};
		}
		return {
			level,
			next,
			cost: row.remainingMs === null ? cost : null,
			remainingMs: row.remainingMs,
			timeMs: game.buildDuration(key),
			canStart: row.canStart,
			start: () => game.upgrade(key)
		};
	});
	/** The upgrade view only makes sense while there is a next level to buy */
	const upgrading = $derived(mode === 'upgrade' && shown.cost !== null);
	const statList = $derived(defense ? defenseStats : stats);
</script>

{#snippet statRow(stat: { label: string; from: string; to: string })}
	{@const bar = barOf(stat)}
	<li class="flex flex-col gap-0.5">
		<span
			class="flex items-baseline justify-between gap-2 font-display text-sm font-bold tabular-nums"
		>
			<span>{stat.label}</span>
			<span>
				{stat.from}
				{#if upgrading && stat.from !== stat.to}
					<span class="text-[#2f8a49]">→ {stat.to}</span>
				{/if}
			</span>
		</span>
		{#if bar}
			<span
				class="flex h-3.5 overflow-hidden rounded-full border-2 border-ink bg-ink/70"
				aria-hidden="true"
			>
				<span class="h-full bg-[#5aaee8]" style:width="{bar.now}%"></span>
				<span class="gain h-full bg-[#5fd068]" style:width="{bar.gain}%"></span>
			</span>
		{/if}
	</li>
{/snippet}

<div class="flex flex-col gap-3">
	<div class="flex flex-col gap-3 sm:flex-row">
		<!-- The picture on a lit tile, with the level it has or will have -->
		<div class="flex shrink-0 flex-col items-center gap-2 sm:w-48">
			<div
				class="spotlight relative flex w-full items-center justify-center rounded-[18px] border-3 border-ink p-2"
			>
				{#if defense}
					<BeachheadPortrait
						type="defense"
						kind={defense.kind as BuildingKind}
						size={upgrading ? 120 : 112}
					/>
				{:else if isLayoutKey(key)}
					<BeachheadPortrait
						type="building"
						kind={key}
						level={upgrading ? next : Math.max(1, level)}
						{max}
						size={128}
					/>
				{:else}
					<IconShip
						class="size-20 text-paper drop-shadow-[0_3px_0_var(--color-ink)]"
						aria-hidden="true"
					/>
				{/if}
				<span
					class="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border-2 border-ink bg-explosion-yellow px-2.5 font-display text-base font-bold whitespace-nowrap tabular-nums"
				>
					{m.beachhead_level_tag({ level: upgrading ? shown.next : shown.level })}
				</span>
			</div>

			{#if crystalTarget}
				<!-- The overcharge crystal: tap to cycle through the types and back to empty -->
				<button
					type="button"
					class="mt-1 flex w-full items-center justify-between gap-2 rounded-[14px] border-2 border-ink bg-sand px-2 py-1 text-start"
					title={crystalHere ? crystalName(crystalHere) : m.beachhead_crystals_empty_slot()}
					disabled={!crystalHere && game.overchargeSlotsUsed >= game.overchargeSlotsTotal}
					onclick={cycleCrystal}
				>
					<span class="text-xs font-bold">
						{crystalHere ? crystalName(crystalHere) : m.beachhead_crystals_empty_slot()}
					</span>
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper"
					>
						{#if crystalHere}
							<CrystalIcon type={crystalHere} class="size-6" />
						{/if}
					</span>
				</button>
			{/if}
		</div>

		<div class="flex min-w-0 flex-1 flex-col gap-2">
			{#if !upgrading && hint}
				<p class="text-sm">{hint}</p>
			{/if}
			{#if statList.length > 0}
				<ul class="flex flex-col gap-1.5 rounded-[14px] border-2 border-ink bg-sand p-2">
					{#each statList as stat (stat.label)}
						{@render statRow(stat)}
					{/each}
				</ul>
			{/if}

			{#if !defense && upgrading && unlocks && (unlocks.boat !== null || unlocks.guns.length > 0)}
				<div class="flex flex-col gap-1.5">
					<h4 class="text-sm font-bold">{m.beachhead_unlocks_title()}</h4>
					<ul class="flex flex-wrap gap-2">
						{#if unlocks.boat !== null}
							<li
								class="flex items-center gap-2 rounded-[14px] border-2 border-ink bg-paper px-2 py-1"
								title={m.beachhead_building_boat({ index: unlocks.boat })}
							>
								<IconShip class="size-10" aria-hidden="true" />
							</li>
						{/if}
						{#each unlocks.guns as kind (kind)}
							<li
								class="rounded-[14px] border-2 border-ink bg-paper p-1"
								title={buildingName(kind)}
							>
								<BeachheadPortrait type="defense" {kind} size={60} />
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>

	<!-- The bottom bar: how long it takes, and the big green button with the price -->
	{#if shown.remainingMs !== null}
		<p
			class="flex items-center justify-center gap-1.5 rounded-[14px] border-2 border-ink bg-explosion-yellow px-3 py-2 font-display font-bold tabular-nums"
		>
			<IconHourglass class="size-5" aria-hidden="true" />
			{timeText(shown.remainingMs)}
		</p>
	{:else if shown.cost === null}
		<p class="flex items-center justify-center gap-1.5 font-display font-bold">
			<IconStar class="size-6 text-explosion-yellow" aria-hidden="true" />
			{m.beachhead_upgrade_max()}
		</p>
	{:else if upgrading}
		{@const price = shown.cost as Resources}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="flex flex-col font-display font-bold tabular-nums">
				<span class="text-xs opacity-70">{m.beachhead_upgrade_time()}</span>
				<span class="flex items-center gap-1 text-lg">
					<IconHourglass class="size-5" aria-hidden="true" />
					{timeText(shown.timeMs)}
				</span>
			</p>
			<button
				type="button"
				class="upgrade-go flex min-h-13 items-center gap-2 rounded-[16px] px-4 py-1.5 font-display font-bold text-paper tabular-nums disabled:cursor-not-allowed disabled:grayscale-[0.6]"
				aria-label={m.beachhead_upgrade_button()}
				disabled={!shown.canStart}
				onclick={shown.start}
			>
				<IconArrowBigUp class="size-7 fill-current" aria-hidden="true" />
				<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
					{#each RESOURCE_KINDS as resource (resource)}
						{#if price[resource] > 0}
							<span
								class="inline-flex items-center gap-0.5 text-base"
								class:text-[#ffd0c8]={game.resources[resource] < price[resource]}
							>
								<ResourceIcon kind={resource} class="size-5" />
								{price[resource]}
							</span>
						{/if}
					{/each}
				</span>
			</button>
		</div>
	{/if}
</div>

<style>
	.spotlight {
		min-height: 9rem;
		background:
			radial-gradient(circle at 50% 55%, rgb(255 255 255 / 0.55), transparent 60%),
			linear-gradient(#7cc4f0, #3b8fd9);
	}

	.gain {
		background-image: repeating-linear-gradient(
			-45deg,
			rgb(255 255 255 / 0.25) 0 4px,
			transparent 4px 8px
		);
	}

	.upgrade-go {
		border: 3px solid var(--color-ink);
		background: linear-gradient(#6fd36a, #2f9a4a);
		box-shadow:
			inset 0 2px 0 rgb(255 255 255 / 0.4),
			2px 3px 0 var(--color-ink);
		text-shadow: 0 2px 0 var(--color-ink);
	}

	.upgrade-go:not(:disabled):active {
		transform: translateY(2px);
		box-shadow: 1px 1px 0 var(--color-ink);
	}
</style>
