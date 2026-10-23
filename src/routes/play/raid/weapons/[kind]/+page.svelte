<!--
	A raid weapon's details: its stats, what the base attack and each of its two skills do, each
	with a small looping example on a staged battlefield, and links to the other weapons.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config.js';
	import RaidItemIcon from '#lib/components/RaidItemIcon.svelte';
	import RaidSkillIcon from '#lib/components/RaidSkillIcon.svelte';
	import RaidWeaponDemo from '#lib/components/RaidWeaponDemo.svelte';
	import {
		ATTACK_HINTS,
		SKILL_HINTS,
		SKILL_NAMES,
		WEAPON_NAMES,
		WEAPON_TRAITS
	} from '#lib/components/raidText.js';
	import { prefersReducedMotion } from '#lib/game/loop.js';
	import { SKILL_COOLDOWN_MS, WEAPON_KINDS, WEAPONS } from '#lib/game/raid/config.js';
	import { m } from '#lib/paraglide/messages.js';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const kind = $derived(data.kind);
	const spec = $derived(WEAPONS[kind]);
	const reducedMotion = prefersReducedMotion();
	const name = $derived(WEAPON_NAMES[kind]());

	/** The skills' description starts lower-case, after the skill's name in the tutorial */
	const sentence = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

	const stats = $derived([
		{
			label: m.raid_details_stat_damage(),
			value: `${Math.round(spec.damage)}${spec.pellets > 1 ? ` × ${spec.pellets}` : ''}`
		},
		{ label: m.raid_details_stat_rate(), value: (1000 / spec.fireMs).toFixed(1) },
		{ label: m.raid_details_stat_crit(), value: `${Math.round(spec.critChance * 100)}%` },
		{ label: m.raid_details_stat_range(), value: `${spec.range}` }
	]);
</script>

<svelte:head>
	<title>{name} | {m.mode_raid_name()} | {APP_NAME}</title>
</svelte:head>

<main
	class="mx-auto flex max-w-3xl flex-col gap-4 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
	<div class="flex items-center gap-2">
		<a href={resolve('/play/raid')} class="btn-chunky px-3 py-1 text-sm">
			<IconArrowLeft class="size-4 rtl:rotate-180" aria-hidden="true" />
			{m.raid_details_back()}
		</a>
	</div>

	<header
		class="flex items-center gap-3 rounded-[14px_8px_16px_10px] border-3 border-ink bg-banner-slate p-3 text-paper shadow-[4px_4px_0_var(--color-ink)]"
	>
		<RaidItemIcon {kind} rarity="rare" class="size-16 shrink-0" />
		<div class="flex flex-col">
			<h1 dir="auto" class="text-2xl leading-tight font-bold sm:text-3xl">{name}</h1>
			<p dir="auto" class="text-sm">{WEAPON_TRAITS[kind]()}</p>
		</div>
	</header>

	<dl class="grid grid-cols-2 gap-2 font-display sm:grid-cols-4">
		{#each stats as stat (stat.label)}
			<div
				class="flex flex-col items-center rounded-md border-2 border-ink bg-sand p-2 text-center"
			>
				<dt class="text-xs leading-tight font-bold">{stat.label}</dt>
				<dd class="text-xl font-bold tabular-nums">{stat.value}</dd>
			</div>
		{/each}
	</dl>

	<section class="sticker flex flex-col gap-2 p-3" style:--tilt="-0.4deg">
		<h2 class="font-display text-xl font-bold">{m.raid_details_attack()}</h2>
		<p dir="auto" class="text-sm">{ATTACK_HINTS[kind]()}</p>
		{#key kind}
			<RaidWeaponDemo
				{kind}
				action="attack"
				label="{name}: {m.raid_details_attack()}"
				{reducedMotion}
			/>
		{/key}
	</section>

	{#each spec.skills as skill, slot (skill)}
		<section
			class="sticker flex flex-col gap-2 p-3"
			style:--tilt={slot === 0 ? '0.4deg' : '-0.3deg'}
		>
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="flex size-10 items-center justify-center rounded-full border-3 border-ink bg-paper"
				>
					<RaidSkillIcon {skill} class="size-6" />
				</span>
				<h2 dir="auto" class="font-display text-xl font-bold">{SKILL_NAMES[skill]()}</h2>
				<span class="ms-auto rounded bg-ink px-1.5 font-display text-xs font-bold text-paper"
					>{slot === 0 ? 'E' : 'R'} · {m.raid_details_cooldown({
						seconds: SKILL_COOLDOWN_MS[skill] / 1000
					})}</span
				>
			</div>
			<p dir="auto" class="text-sm">{sentence(SKILL_HINTS[skill]())}</p>
			{#key kind}
				<RaidWeaponDemo
					{kind}
					action={slot === 0 ? 0 : 1}
					label="{name}: {SKILL_NAMES[skill]()}"
					{reducedMotion}
				/>
			{/key}
		</section>
	{/each}

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
