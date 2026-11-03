<!--
	The training ground sheet: every troop and every support skill with its level, and a round button
	to train it one level further. A troop or skill cannot be trained past the level of the training
	ground itself, which is why the level of the building is shown at the top.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { SUPPORT_SKILLS, type Resources } from '#lib/game/beachhead/campaign.js';
	import {
		MAX_SUPPORT_SKILL_LEVEL,
		MAX_TROOP_LEVEL,
		TROOPS,
		type SkillId,
		type TroopKind
	} from '#lib/game/beachhead/config.js';
	import { SKILL_ICONS } from '#lib/components/beachheadIcons.js';
	import { troopName } from '#lib/components/beachheadText.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import BeachheadTroopDetail from '#lib/components/BeachheadTroopDetail.svelte';
	import ResourceIcon from '#lib/components/ResourceIcon.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconCircleArrowUp from '~icons/lucide/circle-arrow-up';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconGraduationCap from '~icons/lucide/graduation-cap';
	import IconLock from '~icons/lucide/lock';
	import IconStar from '~icons/lucide/star';

	let { game }: { game: BeachheadGame } = $props();
	/** The troop whose details are open; the lab shows only the tiles until one is tapped */
	let selected = $state<TroopKind | null>(null);

	const RESOURCE_KINDS = ['wood', 'stone', 'iron', 'gold'] as const;
	const troops = Object.keys(TROOPS) as TroopKind[];

	const skillName = (skill: SkillId): string =>
		skill === 'flamingo'
			? m.beachhead_skill_flamingo()
			: skill === 'barrage'
				? m.beachhead_skill_barrage()
				: skill === 'flare'
					? m.beachhead_skill_flare()
					: skill === 'smoke'
						? m.beachhead_skill_smoke()
						: skill === 'emp'
							? m.beachhead_skill_emp()
							: m.beachhead_skill_heal();
</script>

{#snippet costChips(cost: Resources)}
	<span
		class="flex flex-wrap items-center justify-center gap-1 font-display text-[0.7rem] font-bold"
	>
		{#each RESOURCE_KINDS as resource (resource)}
			<span
				class="inline-flex items-center gap-0.5 rounded border-2 border-ink px-1 {game.resources[
					resource
				] >= cost[resource]
					? 'bg-paper'
					: 'bg-tie-red text-paper'}"
			>
				<ResourceIcon kind={resource} class="size-3.5" />
				{cost[resource]}
			</span>
		{/each}
	</span>
{/snippet}

{#snippet pips(level: number, max: number)}
	<div class="flex gap-px" role="img" aria-label={m.beachhead_troop_level({ level, max })}>
		{#each Array.from({ length: max }, (_, index) => index + 1) as pip (pip)}
			<span class="h-1.5 w-2 rounded-sm border border-ink {pip <= level ? 'bg-khaki' : 'bg-paper'}"
			></span>
		{/each}
	</div>
{/snippet}

{#if selected}
	<BeachheadTroopDetail {game} kind={selected} onback={() => (selected = null)} />
{:else}
	<p
		class="flex items-center gap-2 font-display text-sm font-bold"
		title={m.beachhead_building_training_hint()}
	>
		<IconGraduationCap class="size-5" aria-hidden="true" />
		{m.beachhead_building_training()}
		<span class="rounded-full border-2 border-ink bg-paper px-2 tabular-nums">
			{game.levelOf('training')}/{game.maxLevelOf('training')}
		</span>
	</p>

	<h4 class="text-sm font-bold">{m.beachhead_training_title()}</h4>
	<ul class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
		{#each troops as kind (kind)}
			{@const level = game.troopLevel(kind)}
			<li>
				<button
					type="button"
					class="relative flex w-full flex-col items-center gap-0.5 rounded-[14px] border-2 border-ink bg-sand p-1.5"
					title={troopName(kind)}
					onclick={() => (selected = kind)}
				>
					<span
						class="flex size-14 items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
					>
						<BeachheadPortrait type="troop" {kind} {level} size={48} />
					</span>
					<span class="text-center text-[0.7rem] leading-tight font-bold">{troopName(kind)}</span>
					<span
						class="absolute -end-1 -top-1 flex min-w-6 items-center justify-center rounded-full border-2 border-ink bg-paper px-1 font-display text-xs font-bold tabular-nums"
					>
						{level}
					</span>
					{#if game.research?.kind === kind}
						<IconHourglass
							class="absolute -start-1 -top-1 size-5 rounded-full border-2 border-ink bg-paper p-0.5 text-flag-blue"
							aria-hidden="true"
						/>
					{/if}
				</button>
			</li>
		{/each}
	</ul>

	<h4 class="text-sm font-bold">{m.beachhead_skills_title()}</h4>
	<ul class="grid grid-cols-3 gap-2 sm:grid-cols-5">
		{#each SUPPORT_SKILLS as skill (skill)}
			{@const SkillIcon = SKILL_ICONS[skill]}
			{@const level = game.supportSkillLevel(skill)}
			{@const cost = game.supportSkillCost(skill)}
			<li class="flex flex-col items-center gap-1 rounded-[14px] border-2 border-ink bg-sand p-2">
				<span
					class="flex size-12 items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
				>
					<SkillIcon class="size-7" aria-hidden="true" />
				</span>
				<p class="text-center text-xs leading-tight font-bold">{skillName(skill)}</p>
				{@render pips(level, MAX_SUPPORT_SKILL_LEVEL)}
				{#if cost === null}
					<IconStar class="size-5 text-explosion-yellow" aria-label={m.beachhead_upgrade_max()} />
				{:else if game.supportSkillLocked(skill)}
					<IconLock class="size-5" aria-label={m.beachhead_upgrade_locked()} />
				{:else}
					{@render costChips(cost)}
					<button
						type="button"
						class="btn-chunky flex size-8 items-center justify-center rounded-full p-0"
						aria-label={`${m.beachhead_troop_train()} ${skillName(skill)}`}
						disabled={!game.canUpgradeSupportSkill(skill)}
						onclick={() => game.upgradeSupportSkill(skill)}
					>
						<IconCircleArrowUp class="size-5" aria-hidden="true" />
					</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
