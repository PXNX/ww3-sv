<!--
	The crisis on the desk: a headline, a short briefing and two ways out, each with its price and
	its consequences shown as chips. Left unanswered at the end of the day it costs the home front.
-->
<script lang="ts">
	import { crisisDef } from '#lib/game/warroom/council.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { WarRoomGame } from '#lib/stores/warroomGame.svelte.js';
	import {
		crisisBody,
		crisisOptionLabel,
		crisisTitle,
		effectLabel,
		resourceCost
	} from './warroomText.js';
	import IconSiren from '~icons/lucide/siren';

	let { game }: { game: WarRoomGame } = $props();

	const id = $derived(game.crisis);
	const def = $derived(id ? crisisDef(id) : null);
</script>

{#if id && def}
	{#key id}
		<section
			class="crisis-in flex flex-col gap-2 rounded-2xl border-3 border-ink bg-[#fff1c2] p-2 shadow-[3px_3px_0_var(--color-ink)]"
			aria-live="assertive"
		>
			<header class="flex items-center gap-2">
				<IconSiren class="siren size-5 shrink-0 text-tie-red" aria-hidden="true" />
				<div class="flex min-w-0 flex-col">
					<p class="text-[0.7rem] font-bold tracking-wide uppercase opacity-70">
						{m.warroom_crisis_label()}
					</p>
					<h2 dir="auto" class="font-display text-lg leading-tight font-bold">
						{crisisTitle(id)}
					</h2>
				</div>
			</header>
			<p dir="auto" class="text-xs leading-snug font-semibold sm:text-sm">{crisisBody(id)}</p>
			<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
				{#each def.options as option, index (option.id)}
					<button
						type="button"
						class="btn-chunky flex-col items-stretch gap-1 bg-paper p-2 text-start disabled:opacity-50"
						disabled={!game.canResolveCrisis(index)}
						onclick={() => game.resolveCrisis(index)}
					>
						<span dir="auto" class="font-display text-sm leading-tight font-bold">
							{crisisOptionLabel(id, index)}
						</span>
						{#if option.cost}
							<span dir="auto" class="text-[0.7rem] font-bold text-tie-red">
								{m.warroom_crisis_cost({ cost: resourceCost(option.cost) })}
							</span>
						{/if}
						<span class="flex flex-wrap gap-1">
							{#each option.effects as effect, effectIndex (effectIndex)}
								<span
									dir="auto"
									class="rounded-full border border-ink bg-sand px-1.5 py-0.5 text-[0.65rem] leading-none font-semibold"
								>
									{effectLabel(effect)}
								</span>
							{/each}
						</span>
					</button>
				{/each}
			</div>
			<p dir="auto" class="text-[0.7rem] font-semibold opacity-70">{m.warroom_crisis_neglect()}</p>
		</section>
	{/key}
{/if}

<style>
	.crisis-in {
		animation: crisis-in 0.35s cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	:global(.siren) {
		animation: siren 0.8s ease-in-out infinite alternate;
	}
	@keyframes crisis-in {
		from {
			transform: translateY(-10px) scale(0.96);
			opacity: 0;
		}
	}
	@keyframes siren {
		to {
			transform: rotate(14deg) scale(1.15);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.crisis-in,
		:global(.siren) {
			animation: none;
		}
	}
</style>
