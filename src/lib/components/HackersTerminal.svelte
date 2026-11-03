<!--
	Hermit Hackers boot terminal: the start screen is the unit's own machine rather than a menu card.
	The shell answers a handful of commands. `targets` opens the address list (star an address to
	keep it at the top, HACK starts a run there), `hardware` opens the parts shop for the machine,
	and `neofetch` prints what the rig is made of. Everything shown here is fictional.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { TARGETS } from '#lib/game/hackers/config.js';
	import {
		HARDWARE_SPECS,
		cpuName,
		gpuName,
		hardwareCost,
		hardwareEffects,
		ramGb,
		type HardwareId
	} from '#lib/game/hackers/hardware.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { HackersGame } from '#lib/stores/hackersGame.svelte.js';
	import { soundManager } from '#lib/sound/soundManager.svelte.js';
	import IconStar from '~icons/lucide/star';

	let { game }: { game: HackersGame } = $props();

	type Program = 'none' | 'targets' | 'hardware';

	const BOOT = [
		'HERMIT-OS 3.1.1 (tty0)',
		'booting hermit-shell ...',
		'[ OK ] encrypted relay stack',
		'[ OK ] dogelite wallet stub (sandbox)',
		'[ OK ] trace dampener',
		'last login: tonight on the basement rig',
		''
	] as const;

	const HW_NAMES: Record<HardwareId, () => string> = {
		cpu: m.hackers_hw_cpu,
		ram: m.hackers_hw_ram,
		gpu: m.hackers_hw_gpu,
		cable: () => 'Cable'
	};

	/** Lines already on the screen; `queue` holds what is still being printed */
	let lines = $state.raw<string[]>([]);
	let queue: string[] = [...BOOT];
	let printTimer: ReturnType<typeof setInterval> | undefined;
	let screen: HTMLDivElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();
	let command = $state('');
	let program = $state<Program>('none');
	let sessionMs = $state(0);
	let hackStartMs = $state(0);

	/** Favourites float to the top, the rest keep the order of the list */
	const targets = $derived(
		TARGETS.map((target, index) => ({ ...target, index })).sort(
			(a, b) =>
				Number(game.favorites.includes(b.ip)) - Number(game.favorites.includes(a.ip)) ||
				a.index - b.index
		)
	);

	const LINE_MS = 55;
	const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	/** Queues lines; they print one at a time like output scrolling in (all at once for reduced motion) */
	function say(...added: string[]) {
		queue.push(...added);
		if (reducedMotion()) {
			flush();
			return;
		}
		printTimer ??= setInterval(printNext, LINE_MS);
	}

	function flush() {
		lines = [...lines, ...queue.splice(0)];
		void scrollDown();
	}

	function printNext() {
		const next = queue.shift();
		if (next === undefined) {
			clearInterval(printTimer);
			printTimer = undefined;
			return;
		}
		lines = [...lines, next];
		if (next.trim() !== '') soundManager().play('term-type', 0.4);
		void scrollDown();
	}

	async function scrollDown() {
		await tick();
		screen?.scrollTo({ top: screen.scrollHeight });
	}

	onMount(() => {
		// The boot text starts printing right away; a hardware keyboard can type at once
		if (reducedMotion()) flush();
		else printTimer = setInterval(printNext, LINE_MS);
		if (window.matchMedia?.('(pointer: fine)').matches) input?.focus();
		const clock = setInterval(() => (sessionMs += 1000), 1000);
		return () => {
			clearInterval(printTimer);
			clearInterval(clock);
		};
	});

	function help() {
		say(
			m.hackers_term_help_title(),
			`  ${m.hackers_term_help_help()}`,
			`  ${m.hackers_term_help_neofetch()}`,
			`  ${m.hackers_term_help_targets()}`,
			`  ${m.hackers_term_help_hardware()}`,
			`  ${m.hackers_term_help_hack()}`,
			`  ${m.hackers_term_help_clear()}`
		);
	}

	/** A poor hermit's neofetch: the made-up rig on the left, its parts on the right */
	function neofetch(): string[] {
		const art = [
			'   ,---.   ',
			'  / o o \\  ',
			'  |  ^  |  ',
			"  \\ '-' /  ",
			"   '---'   ",
			'           ',
			'           '
		];
		const info = [
			`OS: HERMIT-OS 3.1.1`,
			`HOST: basement-rig`,
			`KERNEL: 6.6.6-hermit`,
			`CPU: ${cpuName(game.hardware)}`,
			`GPU: ${gpuName(game.hardware)}`,
			`RAM: ${ramGb(game.hardware)} GB`,
			`BANK: ${game.bank} DogeLite`
		];
		return art.map((line, index) => `${line}   ${info[index]}`);
	}

	function hack(ip?: string) {
		hackStartMs = Date.now();
		const target = ip === undefined ? 0 : TARGETS.findIndex((entry) => entry.ip === ip);
		if (target < 0) {
			say(m.hackers_term_unknown_ip({ ip: ip ?? '' }));
			return;
		}
		game.start(target);
	}

	function buy(id: HardwareId) {
		const cost = hardwareCost(id, game.hardware[id]);
		if (cost === null) {
			say(m.hackers_term_maxed());
			return;
		}
		if (game.bank < cost) {
			say(m.hackers_term_no_money());
			return;
		}
		game.buyHardware(id);
		say(m.hackers_term_bought({ part: HW_NAMES[id](), level: game.hardware[id] }));
	}

	function run() {
		const raw = command.trim();
		command = '';
		if (raw.length === 0) return;
		say(`root@hermit:~$ ${raw}`);
		const [name, ...args] = raw.toLowerCase().split(/\s+/);
		switch (name) {
			case 'help':
				help();
				break;
			case 'neofetch':
				say(...neofetch());
				break;
			case 'ls':
			case 'targets':
				program = 'targets';
				break;
			case 'hardware':
			case 'hw':
				program = 'hardware';
				break;
			case 'hack':
				hack(args[0]);
				break;
			case 'clear':
				lines = [];
				queue = [];
				program = 'none';
				break;
			case 'logoff':
				say('> SESSION ENDED — LOGGED OFF');
				say(`> Time in terminal: ${Math.round(sessionMs / 1000)}s`);
				game.quit();
				break;
			case 'time':
				say(`> Session time: ${Math.round(sessionMs / 1000)}s`);
				if (hackStartMs > 0)
					say(`> Last hack started ${Math.round((Date.now() - hackStartMs) / 1000)}s ago`);
				break;
			default:
				say(m.hackers_term_unknown({ cmd: name }));
				break;
		}
	}

	function effect(id: HardwareId): string {
		const effects = hardwareEffects(game.hardware);
		switch (id) {
			case 'cpu':
				return m.hackers_hw_cpu_effect({
					pct: Math.round((effects.minerMultiplier - 1) * 100)
				});
			case 'ram':
				return m.hackers_hw_ram_effect({
					pct: Math.round((1 - effects.creepMultiplier) * 100)
				});
			case 'gpu':
				return m.hackers_hw_gpu_effect({ pct: Math.round(effects.siphonBonus * 100) });
			case 'cable':
				return '';
		}
	}
</script>

<section class="flex min-h-0 flex-1 flex-col gap-2" dir="ltr" aria-label={m.hackers_term_aria()}>
	<div
		class="flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] uppercase opacity-70"
	>
		<span>hermit-shell</span>
		<span>{m.hackers_term_bank({ amount: game.bank })}</span>
	</div>

	<div
		bind:this={screen}
		class="min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed"
		aria-live="polite"
	>
		<pre class="font-mono whitespace-pre-wrap">{lines.join('\n')}</pre>

		{#if program === 'targets'}
			<div class="hk-rule mt-2 pt-2">
				<p class="text-xs font-bold tracking-wide">{m.hackers_term_targets_title()}</p>
				<p class="mb-1 text-[11px] opacity-70">{m.hackers_term_targets_hint()}</p>
				<ul class="flex flex-col gap-1.5">
					{#each targets as target (target.ip)}
						{@const favorite = game.favorites.includes(target.ip)}
						<li class="flex items-center gap-2 text-xs">
							<button
								type="button"
								class="hk-btn shrink-0 {favorite ? 'text-(--hk-amber)' : 'opacity-70'}"
								aria-pressed={favorite}
								aria-label={favorite
									? m.hackers_term_unstar({ ip: target.ip })
									: m.hackers_term_star({ ip: target.ip })}
								onclick={() => game.toggleFavorite(target.ip)}
							>
								<IconStar class="size-4 {favorite ? 'fill-current' : ''}" aria-hidden="true" />
							</button>
							<span class="w-[7.5rem] shrink-0 tabular-nums">{target.ip}</span>
							<span class="min-w-0 flex-1 truncate opacity-80">{target.system}</span>
							<button
								type="button"
								class="hk-btn hk-btn-sm shrink-0 text-xs"
								onclick={() => game.start(target.index)}
							>
								{m.hackers_term_hack()}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{:else if program === 'hardware'}
			<div class="hk-rule mt-2 pt-2">
				<p class="text-xs font-bold tracking-wide">{m.hackers_term_hardware_title()}</p>
				<p class="mb-1 text-[11px] opacity-70">{m.hackers_term_hardware_hint()}</p>
				<ul class="flex flex-col gap-1.5">
					{#each HARDWARE_SPECS as part (part.id)}
						{@const level = game.hardware[part.id]}
						{@const cost = hardwareCost(part.id, level)}
						<li class="flex items-center gap-2 text-xs">
							<span class="w-9 shrink-0 font-bold">{HW_NAMES[part.id]()}</span>
							<span class="w-16 shrink-0 opacity-80">
								{m.hackers_shop_level({ level, max: part.maxLevel })}
							</span>
							<span class="min-w-0 flex-1 truncate opacity-80">
								{level === 0 ? m.hackers_hw_stock() : effect(part.id)}
							</span>
							<button
								type="button"
								class="hk-btn hk-btn-sm shrink-0 text-xs tabular-nums"
								class:hk-btn-solid={cost !== null && game.bank >= cost}
								disabled={cost === null || game.bank < cost}
								onclick={() => buy(part.id)}
							>
								{#if cost === null}
									{m.hackers_shop_max()}
								{:else}
									{m.hackers_shop_buy({ cost })}
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<form
		class="hk-rule flex items-center gap-2 pt-2"
		onsubmit={(event) => {
			event.preventDefault();
			run();
		}}
	>
		<label class="sr-only" for="hackers-command">{m.hackers_term_input()}</label>
		<span class="shrink-0 text-sm">root@hermit:~$</span>
		<input
			id="hackers-command"
			bind:this={input}
			bind:value={command}
			class="min-h-11 min-w-0 flex-1 rounded-sm border border-(--hk-green-faint) bg-transparent px-2 text-base text-(--hk-green) caret-(--hk-green) outline-none placeholder:text-(--hk-green)/40 focus:border-(--hk-green) focus:shadow-[0_0_8px_rgb(57_255_106/0.4)]"
			placeholder={m.hackers_term_hint()}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="go"
		/>
		<button type="submit" class="hk-btn shrink-0" aria-label={m.hackers_term_run()}>
			<span aria-hidden="true">&#9166;</span>
		</button>
	</form>
</section>
