<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import '../app.css';
	import { APP_NAME } from '#lib/config.js';
	import { streakDeadline } from '#lib/game/career/profile.js';
	import { career } from '#lib/game/career/store.svelte.js';
	import { groupGameLaunch, launchStartParam, startRoute } from '#lib/services/telegram.js';
	import { clipPreload } from '#lib/sound/preload.svelte.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import { appearance } from '#lib/stores/appearance.svelte.js';
	import { telegram } from '#lib/stores/telegram.svelte.js';

	let { children } = $props();

	const account = telegram();
	const careerState = career();
	const look = appearance();

	// Keeps <html data-theme> and the browser chrome colour in step with the choice, including a
	// device switch while the theme follows the device. The boot script in app.html paints first.
	$effect(() => {
		const dark = look.dark;
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', dark ? '#16213a' : '#e8e1bc');
	});

	// Inside Telegram the bot learns when the streak breaks, to remind the player two hours before;
	// this runs again after every claim, which moves the deadline a day on
	$effect(() => {
		if (account.status !== 'verified') return;
		const profile = careerState.profile;
		void account.syncStreak(profile.streak, streakDeadline(profile));
	});

	onMount(() => {
		// Voice clips are fetched while the player is still on the start screen; a muted player
		// starts the same prefetch when they turn sound on.
		if (!soundManager().muted) clipPreload().start();
		// Early, while the URL hash still holds the Mini App launch parameters
		void account.start();
		// A `startapp=shop` or `startapp=profile` link opens that page instead of the start screen,
		// and the Play button of a chat's game message opens its mode for that chat's leaderboard
		void launchStartParam().then((param) => {
			if (page.url.pathname !== resolve('/')) return;
			const game = groupGameLaunch(param);
			if (game) {
				account.groupGame = game;
				void goto(resolve(game.route));
				return;
			}
			const route = startRoute(param);
			if (route) void goto(resolve(route));
		});
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js', {
				type: import.meta.env.DEV ? 'module' : 'classic'
			});
		}
	});
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<div class="min-h-dvh">
	{@render children()}
</div>
