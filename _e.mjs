import fs from 'node:fs';
function edit(f, pairs) {
	let s = fs.readFileSync(f, 'utf8');
	for (const [a, b] of pairs) {
		if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 60));
		s = s.replace(a, () => b);
	}
	fs.writeFileSync(f, s);
}
edit('src/routes/play/warroom/+page.svelte', [
	[
		'\timport WarRoomArmy from',
		"\timport WarRoomCouncil from '#lib/components/WarRoomCouncil.svelte';\n\timport WarRoomCrisis from '#lib/components/WarRoomCrisis.svelte';\n\timport WarRoomCurve from '#lib/components/WarRoomCurve.svelte';\n\timport WarRoomTicker from '#lib/components/WarRoomTicker.svelte';\n\timport { rankName, rankOf } from '#lib/components/warroomText.js';\n\timport WarRoomArmy from"
	],
	[
		"type Tab = 'army' | 'industry' | 'recruit';",
		"type Tab = 'army' | 'industry' | 'recruit' | 'council';"
	],
	[
		"\t\t{ id: 'recruit', label: () => m.warroom_tab_recruit() }\n",
		"\t\t{ id: 'recruit', label: () => m.warroom_tab_recruit() },\n\t\t{ id: 'council', label: () => m.warroom_tab_council() }\n"
	],
	[
		"\t\t\t: game.outcome === 'armistice'\n\t\t\t\t? m.warroom_gameover_armistice()\n\t\t\t\t: m.warroom_gameover_lost()",
		"\t\t\t: game.outcome === 'armistice'\n\t\t\t\t? m.warroom_gameover_armistice()\n\t\t\t\t: game.outcome === 'coup'\n\t\t\t\t\t? m.warroom_gameover_coup()\n\t\t\t\t\t: m.warroom_gameover_lost()"
	],
	[
		"\t\tif (event.code === 'Digit3') tab = 'recruit';",
		"\t\tif (event.code === 'Digit3') tab = 'recruit';\n\t\tif (event.code === 'Digit4') tab = 'council';"
	],
	[
		'\t\t\t\t\t<WarRoomMap {game} />\n',
		'\t\t\t\t\t<WarRoomMap {game} />\n\n\t\t\t\t\t<WarRoomTicker {game} />\n\n\t\t\t\t\t<WarRoomCrisis {game} />\n'
	],
	['grid grid-cols-3 gap-1.5', 'grid grid-cols-2 gap-1.5 sm:grid-cols-4'],
	[
		'\t\t\t\t\t\t{:else}\n\t\t\t\t\t\t\t<WarRoomRecruit {game} />',
		"\t\t\t\t\t\t{:else if tab === 'council'}\n\t\t\t\t\t\t\t<WarRoomCouncil {game} />\n\t\t\t\t\t\t{:else}\n\t\t\t\t\t\t\t<WarRoomRecruit {game} />"
	],
	[
		'\t\t\t<p>{m.warroom_tutorial_keys()}</p>',
		'\t\t\t<p>{m.warroom_tutorial_council()}</p>\n\t\t<p>{m.warroom_tutorial_keys()}</p>'
	],
	[
		'\t\t</dl>\n\t</GameOverModal>',
		'\t\t</dl>\n\t\t<dl class="mt-2 grid grid-cols-3 gap-2 font-display text-sm">\n\t\t\t<div class="flex flex-col items-center rounded-xl border-2 border-ink bg-sand p-2">\n\t\t\t\t<dt dir="auto" class="text-center font-bold">{m.warroom_stat_stability()}</dt>\n\t\t\t\t<dd class="text-2xl font-bold tabular-nums">{Math.round(game.stability)}</dd>\n\t\t\t</div>\n\t\t\t<div class="flex flex-col items-center rounded-xl border-2 border-ink bg-sand p-2">\n\t\t\t\t<dt dir="auto" class="text-center font-bold">{m.warroom_stat_crises()}</dt>\n\t\t\t\t<dd class="text-2xl font-bold tabular-nums">{game.crisesHandled}</dd>\n\t\t\t</div>\n\t\t\t<div class="flex flex-col items-center rounded-xl border-2 border-ink bg-sand p-2">\n\t\t\t\t<dt dir="auto" class="text-center font-bold">{m.warroom_rank_title()}</dt>\n\t\t\t\t<dd dir="auto" class="rank-stamp text-center text-sm leading-tight font-bold">\n\t\t\t\t\t{rankName(rankOf(game.score, game.outcome))}\n\t\t\t\t</dd>\n\t\t\t</div>\n\t\t</dl>\n\t\t<div class="mt-2"><WarRoomCurve history={game.history} /></div>\n\t</GameOverModal>'
	]
]);
let s = fs.readFileSync('src/routes/play/warroom/+page.svelte', 'utf8');
s += `
<style>
	:global(.rank-stamp) {
		animation: rank-stamp 0.5s cubic-bezier(0.2, 1.6, 0.4, 1) 0.4s both;
	}
	@keyframes rank-stamp {
		from {
			transform: scale(2.4) rotate(-12deg);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.rank-stamp) {
			animation: none;
		}
	}
</style>
`;
fs.writeFileSync('src/routes/play/warroom/+page.svelte', s);
