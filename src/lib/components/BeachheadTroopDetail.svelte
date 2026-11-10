<!--
	A troop's detail view at the training ground, on the same screen as the commanders: the troop
	acting out its attack on a lit tile, its attack as bars with what the next level adds in green,
	its special ability when it has one, and the training upgrade with its price and time, or the
	countdown while it is being trained.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { troopStatsForLevel } from '#lib/game/beachhead/campaign.js';
	import { MAX_TROOP_LEVEL, TROOPS, type TroopKind } from '#lib/game/beachhead/config.js';
	import { troopName } from '#lib/components/beachheadText.js';
	import BeachheadUnitScreen, {
		type UnitStat,
		type UnitUpgrade
	} from '#lib/components/BeachheadUnitScreen.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconCircleDashed from '~icons/lucide/circle-dashed';
	import IconCrosshair from '~icons/lucide/crosshair';
	import IconGauge from '~icons/lucide/gauge';
	import IconHeart from '~icons/lucide/heart';
	import IconHeartPulse from '~icons/lucide/heart-pulse';
	import IconSwords from '~icons/lucide/swords';
	import IconTimer from '~icons/lucide/timer';
	import IconUsers from '~icons/lucide/users';

	let { game, kind, onback }: { game: BeachheadGame; kind: TroopKind; onback: () => void } =
		$props();

	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const level = $derived(game.troopLevel(kind));
	const base = $derived(TROOPS[kind]);
	const stats = $derived(troopStatsForLevel(kind, level));
	const next = $derived(troopStatsForLevel(kind, Math.min(MAX_TROOP_LEVEL, level + 1)));
	const peak = $derived(troopStatsForLevel(kind, MAX_TROOP_LEVEL));

	const attack = $derived<UnitStat[]>([
		{
			label: m.beachhead_hero_stat_damage(),
			icon: IconSwords,
			now: stats.damage,
			next: next.damage,
			max: peak.damage
		},
		{ label: m.beachhead_stat_rate(), icon: IconTimer, now: 1000 / base.attackMs, max: 9 },
		{ label: m.beachhead_stat_range(), icon: IconCrosshair, now: base.range, max: 7 },
		{
			label: m.beachhead_hero_stat_hp(),
			icon: IconHeart,
			now: stats.hp,
			next: next.hp,
			max: peak.hp
		},
		{ label: m.beachhead_stat_speed(), icon: IconGauge, now: base.speed, max: 4 },
		{ label: m.beachhead_stat_space(), icon: IconUsers, now: base.space, max: 6 }
	]);

	/** What the troop does besides its attack, as the skill card */
	const ability = $derived.by<UnitStat[] | null>(() => {
		if (base.healRadius) {
			return [
				{
					label: m.beachhead_hero_stat_heal(),
					icon: IconHeartPulse,
					now: base.healAmount ?? 0,
					max: 30
				},
				{ label: m.beachhead_stat_radius(), icon: IconCircleDashed, now: base.healRadius, max: 3 }
			];
		}
		if (base.commandRadius) {
			return [
				{
					label: m.beachhead_stat_radius(),
					icon: IconCircleDashed,
					now: base.commandRadius,
					max: 4
				}
			];
		}
		if (base.spawnKind) {
			return [
				{ label: m.beachhead_stat_ability(), icon: IconUsers, now: base.spawnCap ?? 0, max: 6 }
			];
		}
		if (base.splash) {
			return [
				{ label: m.beachhead_stat_radius(), icon: IconCircleDashed, now: base.splash, max: 3 }
			];
		}
		return null;
	});

	const upgrades = $derived.by<UnitUpgrade[]>(() => {
		void now;
		const research = game.research?.kind === kind ? game.research : null;
		return [
			{
				id: 'train',
				title: m.beachhead_troop_train(),
				at: level,
				max: MAX_TROOP_LEVEL,
				cost: game.troopUpgradeCost(kind),
				timeMs: game.troopResearchMs(kind),
				remainingMs: research ? research.endsAt - now : null,
				locked: game.troopUpgradeLocked(kind),
				lockedLabel: m.beachhead_troop_locked(),
				can: game.canUpgradeTroop(kind),
				go: () => game.upgradeTroop(kind)
			}
		];
	});
</script>

<BeachheadUnitScreen
	{game}
	{kind}
	{level}
	name={troopName(kind)}
	attack={{ title: m.beachhead_unit_attack(), stats: attack }}
	skill={ability ? { title: m.beachhead_stat_ability(), stats: ability } : null}
	{upgrades}
	{onback}
/>
