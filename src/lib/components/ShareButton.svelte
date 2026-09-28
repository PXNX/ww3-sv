<script lang="ts">
	import { APP_NAME } from '$lib/config';
	import { m } from '$lib/paraglide/messages';
	import { renderScoreCard, shareScore, type ScoreCard } from '$lib/services/share';
	import { mascotImage } from '$lib/theme/character';
	import IconShare from '~icons/lucide/share-2';

	let {
		modeName,
		score,
		drawBoard
	}: {
		modeName: string;
		score: number;
		drawBoard?: ScoreCard['drawBoard'];
	} = $props();

	let busy = $state(false);
	let status = $state('');

	async function share() {
		busy = true;
		status = '';
		try {
			const blob = await renderScoreCard({
				appName: APP_NAME,
				modeName,
				scoreLabel: m.game_score(),
				score: String(score),
				mascotSrc: mascotImage('smug'),
				drawBoard
			});
			const outcome = await shareScore({
				blob,
				filename: `ww3-${modeName.toLowerCase().replace(/\W+/g, '-')}-${score}.png`,
				text: m.share_text({ score, mode: modeName, app: APP_NAME }),
				url: location.origin
			});
			if (outcome.kind === 'downloaded') {
				status = outcome.linkCopied ? m.share_downloaded() : m.share_downloaded_no_copy();
			}
		} catch {
			status = m.share_failed();
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col items-center gap-1">
	<button type="button" class="btn-chunky bg-flag-blue" onclick={share} disabled={busy}>
		<IconShare class="size-5" aria-hidden="true" />
		{m.share_button()}
	</button>
	<p class="min-h-5 text-sm" role="status">{status}</p>
</div>
