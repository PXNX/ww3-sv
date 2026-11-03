<!--
	The training ground sheet: every troop and every support skill with its level, and a round button
	to train it one level further. A troop or skill cannot be trained past the level of the training
	ground itself, which is why the level of the building is shown at the top.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { SUPPORT_SKILLS } from '#lib/game/beachhead/campaign.js';
	import { TROOPS, type SkillId, type TroopKind } from '#lib/game/beachhead/config.js';
	import { SKILL_ICONS } from '#lib/components/beachheadIcons.js';
	import { troopName } from '#lib/components/beachheadText.js';
	import BeachheadPortrait from '#lib/components/BeachheadPortrait.svelte';
	import BeachheadSkillDetail from '#lib/components/BeachheadSkillDetail.svelte';
	import BeachheadTroopDetail from '#lib/components/BeachheadTroopDetail.svelte';
	import type { BeachheadGame } from '#lib/stores/beachheadGame.svelte.js';
	import IconHourglass from '~icons/lucide/hourglass';
	import IconGraduationCap from '~icons/lucide/graduation-cap';

	let { game }: { game: BeachheadGame } = $props();
	/** The troop whose details are open; the lab shows only the tiles until one is tapped */
	let selected = $state<TroopKind | null>(null);
	let selectedSkill = $state<SkillId | null>(null);

	// The two heroes grow in the hero dojo, not here
	const troops = (Object.keys(TROOPS) as TroopKind[]).filter(
		(kind) => kind !== 'hero' && kind !== 'azov'
	);

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

{#if selectedSkill}
	<BeachheadSkillDetail
		{game}
		skill={selectedSkill}
		name={skillName(selectedSkill)}
		onback={() => (selectedSkill = null)}
	/>
{:else if selected}
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
	<ul class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
		{#each SUPPORT_SKILLS as skill (skill)}
			{@const SkillIcon = SKILL_ICONS[skill]}
			<li>
				<button
					type="button"
					class="relative flex w-full flex-col items-center gap-0.5 rounded-[14px] border-2 border-ink bg-sand p-1.5"
					title={skillName(skill)}
					onclick={() => (selectedSkill = skill)}
				>
					<span
						class="flex size-14 items-center justify-center rounded-full border-3 border-ink bg-paper shadow-[2px_2px_0_var(--color-ink)]"
					>
						<SkillIcon class="size-8" aria-hidden="true" />
					</span>
					<span class="text-center text-[0.7rem] leading-tight font-bold">{skillName(skill)}</span>
					<span
						class="absolute -end-1 -top-1 flex min-w-6 items-center justify-center rounded-full border-2 border-ink bg-paper px-1 font-display text-xs font-bold tabular-nums"
					>
						{game.supportSkillLevel(skill)}
					</span>
					{#if game.research?.skill === skill}
						<IconHourglass
							class="absolute -start-1 -top-1 size-5 rounded-full border-2 border-ink bg-paper p-0.5 text-flag-blue"
							aria-hidden="true"
						/>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
{/if}
