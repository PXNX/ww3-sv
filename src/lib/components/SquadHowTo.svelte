<!--
	What a squad is and how it differs from friends and the referral link, for the top of the raid
	lobby's squad section. A squad exists in the raid only; a friend is someone the bot knows as a
	friend; the referral link is for people who have never played and has its own card on the profile.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { SQUAD_SIZE } from '#lib/services/squad.js';
	import IconGift from '~icons/lucide/gift';
	import IconLink from '~icons/lucide/link';
	import IconUsers from '~icons/lucide/users';
</script>

<div class="flex flex-col gap-1.5 rounded-xl bg-black/20 p-2.5 text-xs leading-snug">
	<p dir="auto" class="font-semibold">{m.squad_intro({ max: SQUAD_SIZE })}</p>
	<ul class="flex flex-col gap-1">
		<li class="flex items-start gap-2">
			<IconUsers class="mt-0.5 size-3.5 shrink-0 text-[#22c3b0]" aria-hidden="true" />
			<span dir="auto" class="opacity-90">{m.squad_way_friend()}</span>
		</li>
		<li class="flex items-start gap-2">
			<IconLink class="mt-0.5 size-3.5 shrink-0 text-[#ffd23a]" aria-hidden="true" />
			<span dir="auto" class="opacity-90">{m.squad_way_link()}</span>
		</li>
		<li class="flex items-start gap-2">
			<IconGift class="mt-0.5 size-3.5 shrink-0 text-[#ff9a3c]" aria-hidden="true" />
			<span dir="auto" class="opacity-90">
				{m.squad_way_referral()}
				<a href={resolve('/profile')} class="font-bold underline underline-offset-2">
					{m.squad_way_referral_open()}
				</a>
			</span>
		</li>
	</ul>
</div>
