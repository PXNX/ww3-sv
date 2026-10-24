<!--
	A raid weapon's own page: every stat (of the player's own weapon with its level and crystals
	when opened from it in the lobby, else of a common level 1 one), and the base attack and the two
	skills as buttons; tapping one shows what it does, its numbers and a looping example on a
	staged battlefield. Laid out side by side for landscape.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config.js';
	import RaidCrystalIcon from '#lib/components/RaidCrystalIcon.svelte';
	import RaidItemIcon from '#lib/components/RaidItemIcon.svelte';
	import RaidSkillIcon from '#lib/components/RaidSkillIcon.svelte';
	import RaidWeaponDemo from '#lib/components/RaidWeaponDemo.svelte';
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
	import { RARITY_COLOR, SKILL_COOLDOWN_MS, WEAPON_KINDS, WEAPONS } from '#lib/game/raid/config.js';
	import type { DemoAction } from '#lib/game/raid/demo.js';
	import {
		crystalsOf,
		makeWeapon,
		socketsOf,
		weaponDps,
		weaponStats,
		type WeaponItem
	} from '#lib/game/raid/items.js';
	import { parseProfile } from '#lib/game/raid/profile.js';
	import { SKILL_FACTS } from '#lib/game/raid/skillFacts.js';
	import { m } from '#lib/paraglide/messages.js';
	import { localStore } from '#lib/services/storage.js';
	import { detailsItem, PROFILE_KEY } from '#lib/stores/raidGame.svelte.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconCrosshair from '~icons/lucide/crosshair';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const kind = $derived(data.kind);
	const spec = $derived(WEAPONS[kind]);
	const reducedMotion = prefersReducedMotion();
	const name = $derived(WEAPON_NAMES[kind]());

	/** The player's own weapon when the lobby passed one, and the player's level */
	let own = $state<{ item: WeaponItem; level: number } | null>(null);
	onMount(() => {
		const id = detailsItem();
		if (!id) return;
		const profile = parseProfile(localStore().read<unknown>(PROFILE_KEY, null));
		if (!profile) return;
		const { primary, secondary } = profile.loadout;
		const item = [primary, secondary, ...profile.stash].find(
			(candidate): candidate is WeaponItem => candidate.id === id && candidate.type === 'weapon'
		);
		if (item && item.kind === kind) own = { item, level: profile.level };
	});

	const item = $derived(own?.item ?? makeWeapon(kind));
	const stats = $derived(weaponStats(item, own?.level ?? 1));

	/** The skills' description starts lower-case, after the skill's name in the tutorial */
	const sentence = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
	const round = (value: number) => (value >= 10 ? Math.round(value) : Math.round(value * 10) / 10);

	const rows = $derived(
		[
			{
				label: m.raid_details_stat_dps(),
				value: `${Math.round(weaponDps(item, own?.level ?? 1))}`
			},
			{
				label: m.raid_details_stat_damage(),
				value: `${round(stats.damage)}${spec.pellets > 1 ? ` × ${spec.pellets}` : ''}`
			},
			{ label: m.raid_details_stat_rate(), value: (1000 / stats.fireMs).toFixed(1) },
			{ label: m.raid_details_stat_crit(), value: `${Math.round(stats.critChance * 100)}%` },
			{ label: m.raid_details_stat_crit_damage(), value: `×${stats.critMultiplier}` },
			{ label: m.raid_details_stat_range(), value: `${spec.range}` },
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

	// The attack and the two skills; one at a time is shown
	let action = $state<DemoAction>('attack');
	const actions = $derived([
		{ action: 'attack' as const, label: m.raid_details_attack() },
		...spec.skills.map((skill, slot) => ({
			action: (slot === 0 ? 0 : 1) as DemoAction,
			label: SKILL_NAMES[skill]()
		}))
	]);
	const skill = $derived(action === 'attack' ? null : spec.skills[action]);
	const facts = $derived(skill ? SKILL_FACTS[skill] : null);
</script>

<svelte:head>
	<title>{name} | {m.mode_raid_name()} | {APP_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex max-w-5xl flex-col gap-3 ps-[calc(0.75rem+env(safe-area-inset-left))] pe-[calc(0.75rem+env(safe-area-inset-right))] pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center gap-2">
		<a href={resolve('/play/raid')} class="btn-chunky px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.raid_details_back()}
		</a>
	</div>

	<div class="grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
		<!-- The weapon and all its stats -->
		<div class="flex flex-col gap-3">
			<header
				class="flex items-center gap-3 rounded-[14px_8px_16px_10px] border-3 border-ink bg-banner-slate p-3 text-paper shadow-[4px_4px_0_var(--color-ink)]"
			>
				<RaidItemIcon {kind} rarity={item.rarity} class="size-16 shrink-0" />
				<div class="flex min-w-0 flex-col">
					<h1 dir="auto" class="text-2xl leading-tight font-bold sm:text-3xl">{name}</h1>
					<p dir="auto" class="text-sm">{WEAPON_TRAITS[kind]()}</p>
					{#if own}
						<p
							class="w-fit rounded bg-paper px-1.5 text-sm font-bold"
							style:color={RARITY_COLOR[item.rarity]}
						>
							{RARITY_NAMES[item.rarity]()} · {m.raid_item_level({ level: item.level })}
						</p>
					{/if}
				</div>
			</header>
			<p class="text-xs font-semibold opacity-80">
				{own ? m.raid_details_yours() : m.raid_details_base()}
			</p>
			<dl class="grid grid-cols-2 gap-1.5 font-display sm:grid-cols-3">
				{#each rows as row (row.label)}
					<div
						class="flex flex-col items-center justify-center rounded-md border-2 border-ink bg-sand p-1.5 text-center"
					>
						<dt class="text-[0.7rem] leading-tight font-bold">{row.label}</dt>
						<dd class="text-base font-bold tabular-nums">{row.value}</dd>
					</div>
				{/each}
			</dl>
			{#if own && crystalsOf(item).length > 0}
				<ul class="flex flex-col gap-1">
					{#each crystalsOf(item) as crystal, index (index)}
						<li class="flex items-center gap-2 text-sm">
							<RaidCrystalIcon kind={crystal.kind} rarity={crystal.rarity} class="size-7" />
							<span dir="auto"
								><strong>{crystalName(crystal)}</strong>: {crystalEffect(crystal)}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- The attack and the skills, one at a time -->
		<div class="flex flex-col gap-2">
			<p class="text-xs font-semibold opacity-80">{m.raid_details_pick()}</p>
			<div class="grid grid-cols-3 gap-2" role="tablist" aria-label={m.raid_details_skills()}>
				{#each actions as entry (entry.action)}
					{@const active = action === entry.action}
					<button
						type="button"
						role="tab"
						aria-selected={active}
						class="btn-chunky flex-col gap-0.5 px-1 py-1.5 text-xs leading-tight"
						class:bg-explosion-yellow={active}
						onclick={() => (action = entry.action)}
					>
						{#if entry.action === 'attack'}
							<IconCrosshair class="size-6" aria-hidden="true" />
						{:else}
							<RaidSkillIcon skill={spec.skills[entry.action]} class="size-6" />
						{/if}
						<span dir="auto">{entry.label}</span>
					</button>
				{/each}
			</div>

			<section class="sticker flex flex-col gap-2 p-3" role="tabpanel" style:--tilt="-0.3deg">
				<div class="flex flex-wrap items-center gap-2">
					<h2 dir="auto" class="font-display text-xl font-bold">
						{skill ? SKILL_NAMES[skill]() : m.raid_details_attack()}
					</h2>
					{#if skill}
						<span class="ms-auto rounded bg-ink px-1.5 font-display text-xs font-bold text-paper"
							>{action === 0 ? 'E' : 'R'} · {m.raid_details_cooldown({
								seconds: SKILL_COOLDOWN_MS[skill] / 1000
							})}</span
						>
					{/if}
				</div>
				<p dir="auto" class="text-sm">
					{skill ? sentence(SKILL_HINTS[skill]()) : ATTACK_HINTS[kind]()}
				</p>
				{#if facts}
					<ul class="flex flex-wrap gap-1.5 font-display text-xs font-bold">
						{#if facts.damage}
							<li class="rounded bg-tie-red px-1.5 text-paper">
								{m.raid_details_skill_damage({ value: facts.damage })}
							</li>
						{/if}
						{#if facts.radius}
							<li class="rounded bg-flag-blue px-1.5 text-paper">
								{m.raid_details_skill_radius({ value: facts.radius })}
							</li>
						{/if}
						{#if facts.durationMs}
							<li class="rounded bg-khaki px-1.5 text-paper">
								{m.raid_details_skill_duration({ seconds: facts.durationMs / 1000 })}
							</li>
						{/if}
						{#if facts.count}
							<li class="rounded bg-ink px-1.5 text-paper">
								{m.raid_details_skill_count({ value: facts.count })}
							</li>
						{/if}
					</ul>
				{/if}
				{#key `${kind}:${action}`}
					<RaidWeaponDemo
						{kind}
						{action}
						label="{name}: {skill ? SKILL_NAMES[skill]() : m.raid_details_attack()}"
						{reducedMotion}
					/>
				{/key}
			</section>
		</div>
	</div>

	<nav class="flex flex-col gap-2" aria-label={m.raid_details_other()}>
		<h2 class="font-display text-lg font-bold">{m.raid_details_other()}</h2>
		<ul class="flex flex-wrap gap-2">
			{#each WEAPON_KINDS.filter((other) => other !== kind) as other (other)}
				<li>
					<a
						href={resolve('/play/raid/weapons/[kind]', { kind: other })}
						class="btn-chunky flex items-center gap-1.5 px-2 py-1 text-sm"
					>
						<RaidItemIcon kind={other} class="size-7" />
						{WEAPON_NAMES[other]()}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</main>
