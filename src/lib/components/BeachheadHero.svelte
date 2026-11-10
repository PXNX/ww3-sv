<!--
	The commanders' screen. Two cards at the top pick the Azov commander or Prigozhin, each drawn as
	in battle. Below, the picked one gets the full hero screen: his attack and his skill as bars that
	show what the next level adds, and his upgrades. The Azov commander is promoted and trains his
	command skill with shards found on conquered bases and resources, never past the dojo's level;
	Prigozhin is trained at the training ground like the troops, and every blow of his hammer heals.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { troopStatsForLevel } from '#lib/game/beachhead/campaign.js';
	import {
		AZOV_COMMAND,
		MAX_HERO_LEVEL,
		MAX_HERO_SKILL_LEVEL,
		MAX_TROOP_LEVEL,
		TROOPS
	} from '#lib/game/beachhead/config.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import BeachheadUnitScreen, {
		type UnitStat,
		type UnitUpgrade
	} from '#lib/components/BeachheadUnitScreen.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconCircleDashed from '~icons/lucide/circle-dashed';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconFlame from '~icons/lucide/flame';
	import IconGauge from '~icons/lucide/gauge';
	import IconGem from '~icons/lucide/gem';
	import IconHeart from '~icons/lucide/heart';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconSwords from '~icons/lucide/swords';
	import IconTimer from '~icons/lucide/timer';
	import IconWind from '~icons/lucide/wind';

	let { game }: { game: BeachheadGame } = $props();
	/** Which of the two commanders is shown */
	let selected = $state<'azov' | 'hero'>('azov');

	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const percent = (value: number): string => `+${Math.round(value * 100)}%`;
	const seconds = (value: number): string => `${Math.round(value * 10) / 10}s`;

	/** Hit, rate of fire, reach, health and pace of a unit at a level and the next one */
	function attackStats(kind: 'azov' | 'hero', level: number, top: number): UnitStat[] {
		const at = troopStatsForLevel(kind, level);
		const next = troopStatsForLevel(kind, Math.min(top, level + 1));
		const peak = troopStatsForLevel(kind, top);
		const base = TROOPS[kind];
		return [
			{
				label: m.beachhead_hero_stat_damage(),
				icon: IconSwords,
				now: at.damage,
				next: next.damage,
				max: peak.damage
			},
			{ label: m.beachhead_stat_rate(), icon: IconTimer, now: 1000 / base.attackMs, max: 2 },
			{ label: m.beachhead_stat_range(), icon: IconCrosshair, now: base.range, max: 7 },
			{
				label: m.beachhead_hero_stat_hp(),
				icon: IconHeart,
				now: at.hp,
				next: next.hp,
				max: peak.hp
			},
			{ label: m.beachhead_stat_speed(), icon: IconGauge, now: base.speed, max: 4 }
		];
	}

	// The Azov commander: promoted with shards, his aura trained as his command skill
	const azovLevel = $derived(game.heroLevel);
	const skill = $derived(game.heroSkill);
	const azovAttack = $derived(attackStats('azov', azovLevel, MAX_HERO_LEVEL));
	const azovSkill = $derived<UnitStat[]>([
		{
			label: m.beachhead_hero_stat_aura(),
			icon: IconCircleDashed,
			now: AZOV_COMMAND.radius,
			max: AZOV_COMMAND.radius
		},
		{
			label: m.beachhead_hero_stat_aura_damage(),
			icon: IconFlame,
			now: AZOV_COMMAND.damagePerLevel * skill,
			next: AZOV_COMMAND.damagePerLevel * Math.min(MAX_HERO_SKILL_LEVEL, skill + 1),
			max: AZOV_COMMAND.damagePerLevel * MAX_HERO_SKILL_LEVEL,
			format: percent
		},
		{
			label: m.beachhead_hero_stat_aura_speed(),
			icon: IconWind,
			now: AZOV_COMMAND.speedPerLevel * skill,
			next: AZOV_COMMAND.speedPerLevel * Math.min(MAX_HERO_SKILL_LEVEL, skill + 1),
			max: AZOV_COMMAND.speedPerLevel * MAX_HERO_SKILL_LEVEL,
			format: percent
		}
	]);
	const azovUpgrades = $derived<UnitUpgrade[]>([
		{
			id: 'level',
			title: m.beachhead_hero_upgrade(),
			at: azovLevel,
			max: MAX_HERO_LEVEL,
			cost: game.heroCardCost() === null ? null : game.heroUpgradeCost(),
			cards: game.heroCardCost(),
			locked: game.heroUpgradeLocked(),
			lockedLabel: m.beachhead_upgrade_locked(),
			can: game.canUpgradeHero(),
			go: () => game.upgradeHero()
		},
		{
			id: 'skill',
			title: m.beachhead_hero_train_skill(),
			at: skill,
			max: MAX_HERO_SKILL_LEVEL,
			cost: game.skillCardCost() === null ? null : game.skillUpgradeCost(),
			cards: game.skillCardCost(),
			locked: game.skillUpgradeLocked(),
			lockedLabel: m.beachhead_upgrade_locked(),
			can: game.canUpgradeSkill(),
			go: () => game.upgradeSkill()
		}
	]);

	// Prigozhin: trained like a troop; his hammer heals everyone around him every few seconds
	const prigoLevel = $derived(game.troopLevel('hero'));
	const prigoAttack = $derived(attackStats('hero', prigoLevel, MAX_TROOP_LEVEL));
	const prigoSkill = $derived<UnitStat[]>([
		{
			label: m.beachhead_hero_stat_heal(),
			icon: IconHeartPulse,
			now: TROOPS.hero.healAmount ?? 0,
			max: TROOPS.hero.healAmount ?? 1
		},
		{
			label: m.beachhead_stat_radius(),
			icon: IconCircleDashed,
			now: TROOPS.hero.healRadius ?? 0,
			max: TROOPS.hero.healRadius ?? 1
		},
		{
			label: m.beachhead_stat_every(),
			icon: IconTimer,
			now: (TROOPS.hero.healEveryMs ?? 0) / 1000,
			max: (TROOPS.hero.healEveryMs ?? 1000) / 1000,
			format: seconds
		}
	]);
	const prigoUpgrades = $derived.by<UnitUpgrade[]>(() => {
		void now;
		const research = game.research?.kind === 'hero' ? game.research : null;
		return [
			{
				id: 'train',
				title: m.beachhead_troop_train(),
				at: prigoLevel,
				max: MAX_TROOP_LEVEL,
				cost: game.troopUpgradeCost('hero'),
				timeMs: game.troopResearchMs('hero'),
				remainingMs: research ? research.endsAt - now : null,
				locked: game.troopUpgradeLocked('hero'),
				lockedLabel: m.beachhead_troop_locked(),
				can: game.canUpgradeTroop('hero'),
				go: () => game.upgradeTroop('hero')
			}
		];
	});
</script>

<!-- The two commanders to pick from, drawn as they fight -->
<div class="flex gap-2" role="tablist">
	{#each [{ id: 'azov' as const, name: m.beachhead_troop_azov(), level: azovLevel }, { id: 'hero' as const, name: m.beachhead_troop_hero(), level: prigoLevel }] as hero (hero.id)}
		<button
			type="button"
			role="tab"
			aria-selected={selected === hero.id}
			class="pick relative flex items-center gap-2 rounded-[14px] border-3 border-ink py-1 ps-1 pe-3 {selected ===
			hero.id
				? 'bg-explosion-yellow'
				: 'bg-paper'}"
			onclick={() => (selected = hero.id)}
		>
			<span
				class="flex size-11 items-center justify-center overflow-hidden rounded-[10px] bg-[#7cc4f0]"
			>
				<BeachheadPortrait type="troop" kind={hero.id} level={hero.level} size={44} />
			</span>
			<span class="flex flex-col items-start leading-tight">
				<span class="text-sm font-bold">{hero.name}</span>
				<span class="font-display text-xs font-bold tabular-nums"
					>{m.beachhead_level_tag({ level: hero.level })}</span
				>
			</span>
		</button>
	{/each}
</div>

{#if selected === 'azov'}
	<BeachheadUnitScreen
		{game}
		kind="azov"
		level={azovLevel}
		name={m.beachhead_hero_name()}
		hint={m.beachhead_troop_azov_hint()}
		attack={{ title: m.beachhead_attack_pistol(), stats: azovAttack }}
		skill={{
			title: m.beachhead_skill_command(),
			text: m.beachhead_skill_command_text(),
			stats: azovSkill
		}}
		upgrades={azovUpgrades}
	>
		{#snippet extra()}
			<p
				class="flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2 font-display text-sm font-bold tabular-nums"
				title={m.beachhead_hero_cards({ cards: game.heroCards })}
			>
				<IconGem class="size-4" aria-hidden="true" />
				{game.heroCards}
			</p>
		{/snippet}
	</BeachheadUnitScreen>
{:else}
	<BeachheadUnitScreen
		{game}
		kind="hero"
		level={prigoLevel}
		name={m.beachhead_troop_hero()}
		hint={m.beachhead_troop_hero_hint()}
		attack={{ title: m.beachhead_attack_hammer(), stats: prigoAttack }}
		skill={{
			title: m.beachhead_skill_hammer(),
			text: m.beachhead_skill_hammer_text(),
			stats: prigoSkill
		}}
		upgrades={prigoUpgrades}
	/>
{/if}

<style>
	.pick {
		box-shadow: 2px 3px 0 var(--color-ink);
		transition: transform 120ms ease;
	}

	.pick[aria-selected='true'] {
		transform: translateY(-2px);
	}
</style>
