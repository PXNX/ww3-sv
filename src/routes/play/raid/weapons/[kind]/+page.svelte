<!--
	A raid weapon's own page, laid out like a brawler's hero screen for landscape. On the left the
	weapon's name on a black banner, its trait, the headline stats (all of them behind "Show all";
	of the player's own weapon with its level and crystals when opened from it in the lobby, else
	of a common level 1 one), its crystal sockets and the other weapons. On the right the player's
	agent with the weapon, and the attack and the two skills as round buttons placed as in a raid.
	Tapping one swaps the left side for a purple panel with what it does, its cooldown and numbers
	and a looping example on a staged battlefield. The cross closes the page.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import RaidCrystalIcon from '#lib/components/RaidCrystalIcon.svelte';
	import RaidItemIcon from '#lib/components/RaidItemIcon.svelte';
	import RaidSkillIcon from '#lib/components/RaidSkillIcon.svelte';
	import RaidWeaponDemo from '#lib/components/RaidWeaponDemo.svelte';
	import RotateHint from '#lib/components/RotateHint.svelte';
	import {
		ATTACK_HINTS,
		crystalEffect,
		crystalName,
		RARITY_NAMES,
		SKILL_HINTS,
		SKILL_NAMES,
		WEAPON_NAMES,
		WEAPON_TRAITS
	} from '#lib/components/raidText.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import {
		BOSS_MAX_STARS,
		MAP_IDS,
		RARITY_COLOR,
		SKILL_COOLDOWN_MS,
		WEAPON_KINDS,
		WEAPONS
	} from '#lib/game/raid/config.js';
	import type { DemoAction } from '#lib/game/raid/demo.js';
	import {
		crystalsOf,
		makeWeapon,
		socketsOf,
		weaponDps,
		weaponStats,
		type WeaponItem
	} from '#lib/game/raid/items.js';
	import { parseProfile, weaponStarCount } from '#lib/game/raid/profile.js';
	import { SKILL_FACTS } from '#lib/game/raid/skillFacts.js';
	import { m } from '#lib/paraglide/messages.js';
	import { localStore } from '#lib/services/storage.js';
	import { detailsItem, PROFILE_KEY } from '#lib/stores/raidGame.svelte.js';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconTimer from '~icons/lucide/timer';
	import IconX from '~icons/lucide/x';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const kind = $derived(data.kind);
	const spec = $derived(WEAPONS[kind]);
	const reducedMotion = prefersReducedMotion();
	const name = $derived(WEAPON_NAMES[kind]());

	/** The player's own weapon when the lobby passed one, and the career level it is played at */
	let own = $state<{ item: WeaponItem; level: number; equipped: boolean } | null>(null);
	/** The weapon's star stat: its best boss fight stars added up over the maps */
	let stars = $state(0);
	onMount(() => {
		const profile = parseProfile(localStore().read<unknown>(PROFILE_KEY, null));
		if (!profile) return;
		stars = weaponStarCount(profile, kind);
		const id = detailsItem();
		if (!id) return;
		const { primary, secondary } = profile.loadout;
		const item = [primary, secondary, ...profile.stash].find(
			(candidate): candidate is WeaponItem => candidate.id === id && candidate.type === 'weapon'
		);
		if (item && item.kind === kind)
			own = { item, level: career().level, equipped: item === primary || item === secondary };
	});

	const item = $derived(own?.item ?? makeWeapon(kind));
	const stats = $derived(weaponStats(item, own?.level ?? 1));

	/** The skills' description starts lower-case, after the skill's name in the tutorial */
	const sentence = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
	const round = (value: number) => (value >= 10 ? Math.round(value) : Math.round(value * 10) / 10);

	const rows = $derived(
		[
			{
				label: m.raid_details_stat_stars(),
				value: `★ ${stars}/${MAP_IDS.length * BOSS_MAX_STARS}`
			},
			{
				label: m.raid_details_stat_dps(),
				value: `${Math.round(weaponDps(item, own?.level ?? 1))}`
			},
			{
				label: m.raid_details_stat_damage(),
				value: `${round(stats.damage)}${spec.pellets > 1 ? ` × ${spec.pellets}` : ''}`
			},
			{ label: m.raid_details_stat_range(), value: `${spec.range}` },
			{ label: m.raid_details_stat_rate(), value: (1000 / stats.fireMs).toFixed(1) },
			{ label: m.raid_details_stat_crit(), value: `${Math.round(stats.critChance * 100)}%` },
			{ label: m.raid_details_stat_crit_damage(), value: `×${stats.critMultiplier}` },
			{ label: m.raid_details_stat_speed(), value: `${spec.projectileSpeed}` },
			spec.pellets > 1 ? { label: m.raid_details_stat_pellets(), value: `${spec.pellets}` } : null,
			spec.pierce > 0 ? { label: m.raid_details_stat_pierce(), value: `${spec.pierce}` } : null,
			spec.splash > 0 ? { label: m.raid_details_stat_splash(), value: `${spec.splash}` } : null,
			stats.burnMs > 0
				? {
						label: m.raid_details_stat_burn(),
						value: m.raid_details_burn_value({
							seconds: round(stats.burnMs / 1000),
							dps: round(stats.burnDps)
						})
					}
				: null,
			{ label: m.raid_details_stat_sockets(), value: `${socketsOf(item)}` }
		].filter((row) => row !== null)
	);
	/** The first three stats are always shown, the rest behind "Show all" */
	let allStats = $state(false);
	const shownRows = $derived(allStats ? rows : rows.slice(0, 3));

	/** The attack or skill whose panel is open; none shows the weapon itself */
	let action = $state<DemoAction | null>(null);
	const skill = $derived(
		action === null || action === 'attack' ? null : (spec.skills[action] ?? null)
	);
	const facts = $derived(skill ? SKILL_FACTS[skill] : null);
	const actionName = $derived(skill ? SKILL_NAMES[skill]() : m.raid_details_attack());
	$effect(() => {
		// Another weapon's page starts on its overview
		void kind;
		action = null;
		allStats = false;
	});

	function pick(next: DemoAction) {
		action = action === next ? null : next;
	}

	// The buttons sit on an arc around the attack, as in a raid
	const ATTACK = 104;
	const SKILL = 70;
	const ARC = 112;
	function arcSpot(degrees: number) {
		const angle = (degrees * Math.PI) / 180;
		const center = ATTACK / 2;
		return `right: ${center - Math.cos(angle) * ARC - SKILL / 2}px; bottom: ${center + Math.sin(angle) * ARC - SKILL / 2}px; width: ${SKILL}px; height: ${SKILL}px;`;
	}
</script>

<svelte:head>
	<title>{name} | {m.mode_raid_name()} | {APP_NAME}</title>
</svelte:head>

<main
	class="relative min-h-dvh overflow-x-hidden bg-[radial-gradient(ellipse_at_62%_45%,#3fe0d0,#17a9a6_45%,#0b6f78)] ps-[calc(1rem+env(safe-area-inset-left))] pe-[calc(1rem+env(safe-area-inset-right))] pt-[calc(1rem+var(--top-inset))] pb-[calc(1rem+env(safe-area-inset-bottom))] text-white"
>
	<a
		href={resolve('/play/raid')}
		class="absolute top-[calc(0.5rem+var(--top-inset))] right-[calc(0.5rem+var(--top-right-inset))] z-20 flex size-12 -skew-x-6 items-center justify-center rounded-md bg-[#d9f3ff] text-[#7a2fd0] shadow-[0_3px_0_rgb(0_0_0/0.25)] active:scale-95"
		aria-label={m.raid_details_back()}
		title={m.raid_details_back()}
	>
		<IconX class="size-8 stroke-[3.5]" aria-hidden="true" />
	</a>

	<div class="grid min-h-[calc(100dvh-2rem)] gap-4 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
		<!-- Left: the weapon, or the panel of the picked attack or skill -->
		<div class="relative z-10 flex flex-col gap-3">
			{#if action === null}
				<header class="flex items-center gap-1 pt-2">
					<RaidItemIcon
						{kind}
						rarity={item.rarity}
						class="z-10 size-20 shrink-0 -rotate-6 drop-shadow-[0_3px_0_rgb(0_0_0/0.3)]"
					/>
					<div class="-ms-5 flex min-w-0 flex-col items-start">
						<h1
							dir="auto"
							class="-skew-x-6 bg-[#111] py-1.5 ps-7 pe-6 font-display text-3xl leading-none font-black uppercase italic sm:text-4xl"
						>
							{name}
						</h1>
						{#if own}
							<span
								class="ms-6 -skew-x-6 rounded-b-md bg-paper px-2 font-display text-sm font-black uppercase italic"
								style:color={RARITY_COLOR[item.rarity]}
							>
								{RARITY_NAMES[item.rarity]()} · {m.raid_item_level({ level: item.level })}
							</span>
						{/if}
					</div>
				</header>
				<p dir="auto" class="max-w-sm text-lg leading-snug font-bold text-[#c9fff6] italic">
					{WEAPON_TRAITS[kind]()}
				</p>
				<p class="text-xs font-semibold text-white/75">
					{own ? m.raid_details_yours() : m.raid_details_base()}<br />{m.raid_details_pick()}
				</p>

				<dl class="grid grid-cols-3 gap-x-4 gap-y-2 font-display">
					{#each shownRows as row (row.label)}
						<div class="flex flex-col">
							<dt class="text-[0.7rem] leading-tight font-black text-white uppercase">
								{row.label}
							</dt>
							<dd class="text-2xl leading-tight font-bold tabular-nums">{row.value}</dd>
						</div>
					{/each}
				</dl>
				{#if rows.length > 3}
					<button
						type="button"
						class="w-fit -skew-x-6 rounded-md bg-[#7a3fe0] px-3 py-1 font-display text-sm font-black text-white uppercase italic shadow-[0_3px_0_rgb(0_0_0/0.25)]"
						aria-expanded={allStats}
						onclick={() => (allStats = !allStats)}
					>
						{allStats ? m.raid_details_fewer_stats() : m.raid_details_all_stats()}
					</button>
				{/if}

				<!-- Crystal sockets -->
				<section class="flex flex-col gap-1.5">
					<h2 class="font-display text-sm font-black uppercase">{m.raid_details_crystals()}</h2>
					<ul class="flex flex-wrap gap-2">
						{#each { length: socketsOf(item) }, index (index)}
							{@const crystal = own ? crystalsOf(item)[index] : undefined}
							<li
								class="flex size-14 items-center justify-center rounded-lg bg-[#0b5560]/60 shadow-[inset_0_0_0_2px_rgb(255_255_255/0.12)]"
								title={crystal ? `${crystalName(crystal)}: ${crystalEffect(crystal)}` : undefined}
							>
								{#if crystal}
									<RaidCrystalIcon kind={crystal.kind} rarity={crystal.rarity} class="size-11" />
									<span class="sr-only">{crystalName(crystal)}: {crystalEffect(crystal)}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>

				<nav class="mt-auto flex flex-col gap-1" aria-label={m.raid_details_other()}>
					<h2 class="font-display text-sm font-black uppercase">{m.raid_details_other()}</h2>
					<ul class="flex flex-wrap gap-1.5">
						{#each WEAPON_KINDS.filter((other) => other !== kind) as other (other)}
							<li>
								<a
									href={resolve('/play/raid/weapons/[kind]', { kind: other })}
									class="flex size-12 items-center justify-center rounded-lg bg-[#0b5560]/60 active:scale-95"
									title={WEAPON_NAMES[other]()}
								>
									<RaidItemIcon kind={other} class="size-9" />
									<span class="sr-only">{WEAPON_NAMES[other]()}</span>
								</a>
							</li>
						{/each}
					</ul>
				</nav>
			{:else}
				<section
					class="-ms-[calc(1rem+env(safe-area-inset-left))] -mt-[calc(1rem+var(--top-inset))] flex min-h-dvh flex-col gap-3 bg-[#3b0d5c] ps-[calc(1.5rem+env(safe-area-inset-left))] pe-6 pt-[calc(1.25rem+var(--top-inset))] pb-6"
					aria-labelledby="raid-action-title"
				>
					<div class="flex items-center gap-3">
						<span
							class="flex size-14 shrink-0 items-center justify-center rounded-full bg-paper shadow-[0_3px_0_rgb(0_0_0/0.3)]"
						>
							{#if skill}
								<RaidSkillIcon {skill} class="size-9" />
							{:else}
								<IconCrosshair class="size-9 text-tie-red" aria-hidden="true" />
							{/if}
						</span>
						<h2
							id="raid-action-title"
							dir="auto"
							class="font-display text-3xl leading-none font-black uppercase italic"
						>
							{actionName}
						</h2>
					</div>
					{#key `${kind}:${action}`}
						<div class="max-w-[22rem] overflow-hidden rounded-md">
							<RaidWeaponDemo {kind} {action} label="{name}: {actionName}" {reducedMotion} />
						</div>
					{/key}
					{#if skill}
						<div
							class="flex items-center justify-between rounded-md bg-black/25 px-3 py-2 font-display font-bold"
						>
							<span class="flex items-center gap-2 uppercase"
								><IconTimer class="size-5" aria-hidden="true" />{m.raid_details_cooldown({
									seconds: SKILL_COOLDOWN_MS[skill] / 1000
								})}</span
							>
							<span class="rounded bg-white/15 px-1.5 text-sm">{action === 0 ? 'E' : 'R'}</span>
						</div>
					{/if}
					<p dir="auto" class="text-lg leading-snug text-white/85">
						{skill ? sentence(SKILL_HINTS[skill]()) : ATTACK_HINTS[kind]()}
					</p>
					{#if facts}
						<ul class="flex flex-wrap gap-1.5 font-display text-sm font-bold">
							{#if facts.damage}
								<li class="rounded bg-tie-red px-2 text-white">
									{m.raid_details_skill_damage({ value: facts.damage })}
								</li>
							{/if}
							{#if facts.radius}
								<li class="rounded bg-flag-blue px-2 text-white">
									{m.raid_details_skill_radius({ value: facts.radius })}
								</li>
							{/if}
							{#if facts.durationMs}
								<li class="rounded bg-[#5f7a3a] px-2 text-white">
									{m.raid_details_skill_duration({ seconds: facts.durationMs / 1000 })}
								</li>
							{/if}
							{#if facts.count}
								<li class="rounded bg-black/40 px-2 text-white">
									{m.raid_details_skill_count({ value: facts.count })}
								</li>
							{/if}
						</ul>
					{/if}
				</section>
			{/if}
		</div>

		<!-- Right: the agent with the weapon, and the attack and skills placed as in a raid -->
		<div
			class="relative flex min-h-80 items-center justify-start md:sticky md:top-0 md:h-[calc(100dvh-2rem)]"
		>
			<div class="relative" aria-hidden="true">
				<Avatar size={170} class="drop-shadow-[0_8px_0_rgb(0_0_0/0.15)]" />
				<RaidItemIcon
					{kind}
					class="absolute -bottom-6 left-1/2 size-32 -translate-x-1/3 -rotate-12 drop-shadow-[0_6px_0_rgb(0_0_0/0.25)]"
				/>
			</div>

			<div
				class="absolute right-2 bottom-24 sm:right-6"
				style:width="{ATTACK}px"
				style:height="{ATTACK}px"
				role="tablist"
				aria-label={m.raid_details_skills()}
			>
				<button
					type="button"
					role="tab"
					aria-selected={action === 'attack'}
					class="absolute inset-0 flex items-center justify-center rounded-full bg-[#0b5560]/50 ring-4 transition-transform active:scale-95 {action ===
					'attack'
						? 'scale-110 ring-[#ff7ad9]'
						: 'ring-white/30'}"
					aria-label={m.raid_details_attack()}
					title={m.raid_details_attack()}
					onclick={() => pick('attack')}
				>
					<span
						class="flex size-[78%] items-center justify-center rounded-full bg-linear-to-b from-[#ffe27a] to-[#f5b52a]"
					>
						<RaidItemIcon {kind} class="size-14" />
					</span>
				</button>
				{#each spec.skills as id, slot (id)}
					{@const entry = (slot === 0 ? 0 : 1) as DemoAction}
					<button
						type="button"
						role="tab"
						aria-selected={action === entry}
						class="absolute flex items-center justify-center rounded-full ring-4 transition-transform active:scale-95 {action ===
						entry
							? 'scale-110 bg-[#ff7ad9]/70 ring-[#ff7ad9]'
							: 'bg-[#0b5560]/50 ring-white/30'}"
						style={arcSpot(slot === 0 ? 160 : 112)}
						aria-label={SKILL_NAMES[id]()}
						title={SKILL_NAMES[id]()}
						onclick={() => pick(entry)}
					>
						<span class="flex size-[78%] items-center justify-center rounded-full bg-paper">
							<RaidSkillIcon skill={id} class="size-9" />
						</span>
					</button>
				{/each}
			</div>

			<div class="absolute right-2 bottom-0 flex items-center gap-3 sm:right-6">
				<a
					href={resolve('/play/raid')}
					class="-skew-x-6 rounded-md bg-[#7a3fe0] px-4 py-2.5 font-display text-sm font-black uppercase italic shadow-[0_3px_0_rgb(0_0_0/0.25)] active:translate-y-0.5"
				>
					{m.raid_details_play()}
				</a>
				{#if own?.equipped}
					<span
						class="-skew-x-6 rounded-md bg-[#6b6b6b] px-5 py-2 font-display text-2xl font-black uppercase italic shadow-[0_4px_0_rgb(0_0_0/0.3)]"
					>
						{m.raid_details_equipped()}
					</span>
				{/if}
			</div>
		</div>
	</div>
</main>

<!-- Laid out for landscape: upright, a card asks for the phone to be turned -->
<RotateHint />
