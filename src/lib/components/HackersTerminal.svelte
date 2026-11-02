<!--
	Hermit Hackers boot terminal: the start screen is the unit's own machine rather than a menu card.
	The shell answers a handful of commands. `targets` opens the address list (star an address to
	keep it at the top, HACK starts a run there), `hardware` opens the parts shop for the machine,
	and `neofetch` prints what the rig is made of. Everything shown here is fictional.
-->
<script lang="ts">
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
		gpu: m.hackers_hw_gpu
	};

	let lines = $state.raw<string[]>([...BOOT]);
	let command = $state('');
	let program = $state<Program>('none');

	/** Favourites float to the top, the rest keep the order of the list */
	const targets = $derived(
		TARGETS.map((target, index) => ({ ...target, index })).sort(
			(a, b) =>
				Number(game.favorites.includes(b.ip)) - Number(game.favorites.includes(a.ip)) ||
				a.index - b.index
		)
	);

	function say(...added: string[]) {
		lines = [...lines, ...added];
	}

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
				program = 'none';
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
		}
	}
</script>

<section
	class="relative overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-[#021208] p-3 font-mono text-[#39ff6a] shadow-[4px_4px_0_var(--color-ink)] [text-shadow:0_0_6px_rgba(57,255,106,0.5)]"
	aria-label={m.hackers_term_aria()}
>
	<div
		class="pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.22)_0_1px,transparent_1px_3px)]"
		aria-hidden="true"
	></div>

	<div class="relative z-0 flex flex-col gap-2" dir="ltr">
		<div class="flex flex-wrap items-baseline justify-between gap-x-3 text-[10px] uppercase opacity-70">
			<span>hermit-shell</span>
			<span>{m.hackers_term_bank({ amount: game.bank })}</span>
		</div>

		<div class="max-h-[24rem] overflow-y-auto text-xs leading-relaxed" aria-live="polite">
			<pre class="font-mono whitespace-pre-wrap">{lines.join('\n')}</pre>

			{#if program === 'targets'}
				<div class="mt-2 border-t border-[#39ff6a]/30 pt-2">
					<p class="text-[11px] font-bold tracking-wide">{m.hackers_term_targets_title()}</p>
					<p class="mb-1 text-[10px] opacity-70">{m.hackers_term_targets_hint()}</p>
					<ul class="flex flex-col gap-1">
						{#each targets as target (target.ip)}
							{@const favorite = game.favorites.includes(target.ip)}
							<li class="flex items-center gap-1.5 text-[11px]">
								<button
									type="button"
									class="shrink-0 rounded border border-[#39ff6a]/50 p-0.5 transition hover:border-[#39ff6a] {favorite
										? 'text-[#e8b923]'
										: 'opacity-60'}"
									aria-pressed={favorite}
									aria-label={favorite
										? m.hackers_term_unstar({ ip: target.ip })
										: m.hackers_term_star({ ip: target.ip })}
									onclick={() => game.toggleFavorite(target.ip)}
								>
									<IconStar
										class="size-3.5 {favorite ? 'fill-current' : ''}"
										aria-hidden="true"
									/>
								</button>
								<span class="w-[104px] shrink-0 tabular-nums">{target.ip}</span>
								<span class="min-w-0 flex-1 truncate opacity-80">{target.system}</span>
								<button
									type="button"
									class="shrink-0 rounded border border-[#39ff6a] px-1.5 py-0.5 text-[10px] font-bold transition hover:bg-[#39ff6a] hover:text-[#021208]"
									onclick={() => game.start(target.index)}
								>
									{m.hackers_term_hack()}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{:else if program === 'hardware'}
				<div class="mt-2 border-t border-[#39ff6a]/30 pt-2">
					<p class="text-[11px] font-bold tracking-wide">{m.hackers_term_hardware_title()}</p>
					<p class="mb-1 text-[10px] opacity-70">{m.hackers_term_hardware_hint()}</p>
					<ul class="flex flex-col gap-1">
						{#each HARDWARE_SPECS as part (part.id)}
							{@const level = game.hardware[part.id]}
							{@const cost = hardwareCost(part.id, level)}
							<li class="flex items-center gap-1.5 text-[11px]">
								<span class="w-8 shrink-0 font-bold">{HW_NAMES[part.id]()}</span>
								<span class="w-14 shrink-0 opacity-80">
									{m.hackers_shop_level({ level, max: part.maxLevel })}
								</span>
								<span class="min-w-0 flex-1 truncate opacity-80">
									{level === 0 ? m.hackers_hw_stock() : effect(part.id)}
								</span>
								<button
									type="button"
									class="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition disabled:opacity-40 {cost !==
										null && game.bank >= cost
										? 'border-[#39ff6a] hover:bg-[#39ff6a] hover:text-[#021208]'
										: 'border-[#39ff6a]/40'}"
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
			class="flex items-center gap-1.5 border-t border-[#39ff6a]/30 pt-2 text-xs"
			onsubmit={(event) => {
				event.preventDefault();
				run();
			}}
		>
			<label class="sr-only" for="hackers-command">{m.hackers_term_input()}</label>
			<span class="shrink-0">root@hermit:~$</span>
			<input
				id="hackers-command"
				bind:value={command}
				class="min-w-0 flex-1 bg-transparent text-xs text-[#39ff6a] caret-[#39ff6a] outline-none placeholder:text-[#39ff6a]/40"
				placeholder={m.hackers_term_hint()}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			/>
		</form>
	</div>
</section>
