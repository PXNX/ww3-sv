<!--
	Rare Earth Squeeze playfield: an abstract trade map (mines on the left, hubs and ports in the
	middle, factories on the right) drawn as SVG, with a transparent button on every node that has a
	switch. Tap a node to turn its switch to the next outgoing lane, or drag from it towards the lane
	you want. Crates of rare earth roll along the selected lanes; the notices of the ministry sit
	underneath, the fixed-step loop and the overlays (start card, pause card, toast, banner, red flash)
	are here too. The playfield stays left-to-right and never scrolls. Reduced motion: no shake, no
	pulsing.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { createFixedLoop, onAppHidden } from '#lib/game/loop.js';
	import { PointerDrag } from '#lib/game/pointerDrag.js';
	import {
		ELEMENTS,
		MAP_HEIGHT,
		MAP_WIDTH,
		laneTowards,
		pointOnEdge
	} from '#lib/game/rareearth/graph.js';
	import type { Element as RareElement } from '#lib/game/rareearth/graph.js';
	import { ruleStatus, type Rule } from '#lib/game/rareearth/rules.js';
	import { timeLeftShare } from '#lib/game/rareearth/state.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { RareEarthGame } from '#lib/stores/rareearthGame.svelte.js';
	import PauseOverlay from './PauseOverlay.svelte';
	import {
		ELEMENT_SYMBOLS,
		elementName,
		factoryName,
		nodeName,
		nodeShort,
		ruleKindName,
		ruleText
	} from './rareearthText.js';
	import IconBan from '~icons/lucide/ban';
	import IconCoins from '~icons/lucide/coins';
	import IconGauge from '~icons/lucide/gauge';
	import IconPlay from '~icons/lucide/play';
	import IconStamp from '~icons/lucide/stamp';

	let { game }: { game: RareEarthGame } = $props();

	const graph = $derived(game.state.graph);
	let field: HTMLDivElement | undefined = $state();

	const loop = createFixedLoop({
		update: (dtMs) => game.update(dtMs),
		render: () => {}
	});

	onMount(() => {
		const stopHidden = onAppHidden(() => game.pause());
		return () => {
			loop.pause();
			stopHidden();
		};
	});

	$effect(() => {
		if (game.status === 'playing') loop.start();
		else loop.pause();
	});

	// Screen shake: the office rattles when a heart is lost
	$effect(() => {
		const count = game.hurtCount;
		if (count === 0 || !field || game.reducedMotion) return;
		field.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: 'translate(-5px, 3px) rotate(-0.3deg)' },
				{ transform: 'translate(5px, -3px) rotate(0.3deg)' },
				{ transform: 'translate(-3px, -2px)' },
				{ transform: 'translate(2px, 2px)' },
				{ transform: 'translate(0, 0)' }
			],
			{ duration: 340, easing: 'ease-out' }
		);
	});

	// Dragging from a node towards a lane picks that lane; a tap turns the switch to the next one
	let dragNode: string | null = null;
	let preview = $state<{ node: string; lane: number | null } | null>(null);

	const dragger = new PointerDrag({
		threshold: 8,
		onMove: (session) => {
			if (!dragNode) return;
			preview = {
				node: dragNode,
				lane: laneTowards(
					game.state.graph,
					dragNode,
					session.pointer.x - session.start.x,
					session.pointer.y - session.start.y
				)
			};
		},
		onEnd: (session) => {
			if (dragNode) {
				game.dragTowards(
					dragNode,
					session.pointer.x - session.start.x,
					session.pointer.y - session.start.y
				);
			}
			dragNode = null;
			preview = null;
		},
		onTap: () => {
			if (dragNode) game.cycle(dragNode);
			dragNode = null;
			preview = null;
		},
		onCancel: () => {
			dragNode = null;
			preview = null;
		}
	});

	function press(event: PointerEvent, nodeId: string) {
		if (game.status !== 'playing') return;
		if (dragger.begin(event, { capture: event.currentTarget as Element })) dragNode = nodeId;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (game.status === 'over' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.code === 'Escape') {
			if (game.status === 'playing') game.pause();
			return;
		}
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('input, select, textarea')) return;
		if (event.code === 'KeyP') {
			if (!event.repeat && !(target instanceof HTMLButtonElement)) game.togglePause();
		}
	}

	function onNodeKey(event: KeyboardEvent, nodeId: string) {
		if (game.status !== 'playing') return;
		if (event.code === 'ArrowUp' || event.code === 'ArrowLeft') {
			event.preventDefault();
			game.cycle(nodeId, -1);
		} else if (event.code === 'ArrowDown' || event.code === 'ArrowRight') {
			event.preventDefault();
			game.cycle(nodeId, 1);
		}
	}

	const SHAPE_COLOURS: Record<RareElement, string> = {
		neodymium: '#4fa8d8',
		dysprosium: '#ddb93c',
		europium: '#9bd18a'
	};

	/** The notice in force or announced for a lane, if any (the newest wins) */
	function laneRule(edgeId: string): Rule | undefined {
		return game.rules.findLast((rule) => rule.edge === edgeId);
	}

	function licenceAt(nodeId: string): Rule | undefined {
		return game.rules.find((rule) => rule.kind === 'licence' && rule.node === nodeId);
	}

	function pct(value: number, total: number): string {
		return `${(value / total) * 100}%`;
	}

	function secondsLeft(rule: Rule): number {
		const status = ruleStatus(rule, game.nowMs);
		const target = status === 'announced' ? rule.startMs : rule.endMs;
		return Math.max(0, Math.ceil((target - game.nowMs) / 1000));
	}

	function cratePosition(crate: (typeof game.crates)[number]): { x: number; y: number } {
		if (crate.edge) return pointOnEdge(graph, crate.edge, crate.progress);
		const node = graph.nodes[crate.node];
		return { x: node.x, y: node.y };
	}

	const quotaLabel = (rule: Rule) => `${rule.used}/${rule.limit}`;
</script>

<svelte:window
	onkeydown={onKeyDown}
	onpointermove={(event) => dragger.pointerMove(event)}
	onpointerup={(event) => dragger.pointerUp(event)}
	onpointercancel={(event) => dragger.pointerCancel(event)}
/>

<div
	bind:this={field}
	data-playfield
	dir="ltr"
	class="relative flex w-full touch-none flex-col gap-2 overflow-hidden rounded-[14px_8px_16px_10px] border-3 border-ink bg-sand p-2 shadow-[4px_4px_0_var(--color-ink)] select-none sm:gap-3 sm:p-3"
	style:touch-action="none"
>
	<!-- The trade map -->
	<div
		role="group"
		aria-label={m.rareearth_board_label()}
		class="relative w-full overflow-hidden rounded-md border-3 border-ink bg-[#cfe3ea]"
		style:aspect-ratio="{MAP_WIDTH} / {MAP_HEIGHT}"
	>
		<svg
			viewBox="0 0 {MAP_WIDTH} {MAP_HEIGHT}"
			class="absolute inset-0 size-full"
			aria-hidden="true"
			focusable="false"
		>
			<!-- A stylized backdrop: three blobs of land, nothing real -->
			<g fill="#e8e1bc" stroke="#111" stroke-width="1.2" opacity="0.9">
				<path d="M6 22 Q24 6 58 14 Q76 30 66 70 Q74 110 50 138 Q58 176 40 214 Q16 232 6 214 Z" />
				<path
					d="M92 4 Q150 -2 232 12 Q252 30 226 52 Q232 150 214 224 Q150 238 92 232 Q78 130 92 4 Z"
				/>
				<path d="M254 8 Q314 4 316 40 Q312 130 316 222 Q270 238 252 224 Q240 120 254 8 Z" />
			</g>

			<!-- Lanes -->
			{#each Object.values(graph.edges) as edge (edge.id)}
				{@const from = graph.nodes[edge.from]}
				{@const to = graph.nodes[edge.to]}
				{@const selected = game.switches[edge.from] === from.out.indexOf(edge.id)}
				{@const rule = laneRule(edge.id)}
				{@const live = rule ? ruleStatus(rule, game.nowMs) : null}
				{@const aimed =
					preview && preview.node === edge.from && preview.lane === from.out.indexOf(edge.id)}
				<line
					x1={from.x}
					y1={from.y}
					x2={to.x}
					y2={to.y}
					stroke={rule?.kind === 'ban'
						? '#e5484d'
						: rule?.kind === 'tariff'
							? '#c9871f'
							: rule?.kind === 'quota'
								? '#6a7c9b'
								: '#111'}
					stroke-width={selected || aimed ? 3.6 : 1.6}
					stroke-dasharray={rule?.kind === 'ban' ? '5 3' : selected ? undefined : '2 3'}
					stroke-linecap="round"
					opacity={selected || aimed ? 1 : 0.55}
					class:announced={live === 'announced'}
				/>
				{#if selected || aimed}
					{@const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI}
					{@const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }}
					<polygon
						points="-5,-4.5 5,0 -5,4.5"
						fill="#111"
						transform="translate({mid.x} {mid.y}) rotate({angle})"
					/>
				{/if}
				{#if rule}
					{@const mx = from.x + (to.x - from.x) * 0.62}
					{@const my = from.y + (to.y - from.y) * 0.62}
					<g transform="translate({mx} {my})" class:announced={live === 'announced'}>
						<circle r="7" fill="#fff" stroke="#111" stroke-width="1.4" />
						{#if rule.kind === 'ban'}
							<circle r="4.2" fill="none" stroke="#e5484d" stroke-width="1.6" />
							<line x1="-3" y1="3" x2="3" y2="-3" stroke="#e5484d" stroke-width="1.6" />
						{:else if rule.kind === 'tariff'}
							<text
								y="2.8"
								text-anchor="middle"
								font-size="9"
								font-weight="700"
								fill="#c9871f"
								font-family="sans-serif">$</text
							>
						{:else}
							<text
								y="2.2"
								text-anchor="middle"
								font-size="6.2"
								font-weight="700"
								fill="#111"
								font-family="sans-serif">{quotaLabel(rule)}</text
							>
						{/if}
					</g>
				{/if}
			{/each}

			<!-- Nodes -->
			{#each graph.order as id (id)}
				{@const node = graph.nodes[id]}
				{@const licence = licenceAt(id)}
				<g transform="translate({node.x} {node.y})">
					{#if node.kind === 'mine'}
						<polygon
							points="-11,8 -6,-8 6,-8 11,8"
							fill="#7c8c5c"
							stroke="#111"
							stroke-width="2"
							stroke-linejoin="round"
						/>
						<path d="M-4 8 V2 H4 V8" fill="#111" opacity="0.8" />
					{:else if node.kind === 'hub'}
						<circle r="9.5" fill="#fff" stroke="#111" stroke-width="2" />
						<circle r="3.2" fill="#111" />
					{:else if node.kind === 'port'}
						<rect
							x="-10"
							y="-9"
							width="20"
							height="18"
							rx="4"
							fill="#4fa8d8"
							stroke="#111"
							stroke-width="2"
						/>
						<path
							d="M-5 3 H5 M0 -5 V3 M-4 -2 H4"
							stroke="#111"
							stroke-width="1.6"
							fill="none"
							stroke-linecap="round"
						/>
					{:else}
						{@const element = ELEMENTS.find((entry) => graph.factoryOf[entry] === id)}
						<path
							d="M-14 12 V-6 L-6 -11 V-5 L2 -11 V-5 L10 -11 V-16 H14 V12 Z"
							fill="#ddb93c"
							stroke="#111"
							stroke-width="2"
							stroke-linejoin="round"
						/>
						{#if element}
							<text
								x="0"
								y="8"
								text-anchor="middle"
								font-size="8"
								font-weight="800"
								font-family="sans-serif"
								fill="#111">{ELEMENT_SYMBOLS[element]}</text
							>
						{/if}
					{/if}
					{#if node.kind !== 'factory'}
						<text
							y={node.kind === 'mine' ? 21 : 22}
							text-anchor="middle"
							font-size="7"
							font-weight="700"
							font-family="sans-serif"
							fill="#111"
							stroke="#fff"
							stroke-width="2.4"
							paint-order="stroke">{nodeShort(graph, id)}</text
						>
					{/if}
					{#if licence?.element}
						<g
							transform="translate(11 -12)"
							class:announced={ruleStatus(licence, game.nowMs) === 'announced'}
						>
							<circle r="7.5" fill="#fff" stroke="#111" stroke-width="1.4" />
							<text
								y="2.4"
								text-anchor="middle"
								font-size="6.4"
								font-weight="800"
								font-family="sans-serif"
								fill="#111">{ELEMENT_SYMBOLS[licence.element]}</text
							>
						</g>
					{/if}
				</g>
			{/each}

			<!-- Crates -->
			{#each game.crates as crate (crate.id)}
				{@const spot = cratePosition(crate)}
				{@const left = timeLeftShare(crate, game.nowMs)}
				<g transform="translate({spot.x} {spot.y - (crate.edge ? 0 : 12)})">
					{#if crate.element === 'neodymium'}
						<circle r="6.2" fill={SHAPE_COLOURS.neodymium} stroke="#111" stroke-width="1.6" />
					{:else if crate.element === 'dysprosium'}
						<rect
							x="-5.6"
							y="-5.6"
							width="11.2"
							height="11.2"
							rx="1.4"
							fill={SHAPE_COLOURS.dysprosium}
							stroke="#111"
							stroke-width="1.6"
						/>
					{:else}
						<polygon
							points="0,-7 6.6,0 0,7 -6.6,0"
							fill={SHAPE_COLOURS.europium}
							stroke="#111"
							stroke-width="1.6"
						/>
					{/if}
					<text
						y="2.2"
						text-anchor="middle"
						font-size="5.6"
						font-weight="800"
						font-family="sans-serif"
						fill="#111">{ELEMENT_SYMBOLS[crate.element]}</text
					>
					<rect
						x="-6"
						y="7.4"
						width="12"
						height="2.6"
						fill="#fff"
						stroke="#111"
						stroke-width="0.8"
					/>
					<rect
						x="-6"
						y="7.4"
						width={12 * left}
						height="2.6"
						fill={left < 0.25 ? '#e5484d' : '#111'}
					/>
					{#if crate.tariffed}
						<circle cx="6" cy="-6" r="2.2" fill="#c9871f" stroke="#111" stroke-width="0.8" />
					{/if}
				</g>
			{/each}
		</svg>

		<!-- One button per switch: the touch target and the keyboard focus -->
		{#each graph.order as id (id)}
			{@const node = graph.nodes[id]}
			{#if node.out.length > 0}
				{@const lane = game.switches[id] ?? 0}
				<button
					type="button"
					class="rareearth-node absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
					style:left={pct(node.x, MAP_WIDTH)}
					style:top={pct(node.y, MAP_HEIGHT)}
					style:touch-action="none"
					aria-label={m.rareearth_node_label({
						node: nodeName(graph, id),
						target: nodeName(graph, graph.edges[node.out[lane]].to)
					})}
					oncontextmenu={(event) => event.preventDefault()}
					onpointerdown={(event) => press(event, id)}
					onkeydown={(event) => onNodeKey(event, id)}
					onclick={(event) => {
						if (event.detail === 0) game.cycle(id);
					}}
				></button>
			{/if}
		{/each}

		{#if game.toast && game.status === 'playing'}
			{#key game.toast.id}
				<p
					dir="auto"
					class="rareearth-toast pointer-events-none absolute inset-x-2 top-[42%] z-30 text-center font-display text-xl leading-tight font-bold [-webkit-text-stroke:5px_var(--color-ink)] [paint-order:stroke] sm:text-3xl {game
						.toast.tone === 'bad'
						? 'text-tie-red'
						: game.toast.tone === 'good'
							? 'text-paper'
							: 'text-explosion-yellow'}"
					aria-live="polite"
				>
					{game.toast.text}
				</p>
			{/key}
		{/if}

		{#if game.banner && game.status === 'playing'}
			{#key game.banner.id}
				<p
					dir="auto"
					class="rareearth-toast pointer-events-none absolute inset-x-2 top-[14%] z-30 text-center font-display text-lg leading-tight font-bold text-paper [-webkit-text-stroke:4px_var(--color-ink)] [paint-order:stroke] sm:text-2xl"
				>
					{game.banner.text}
				</p>
			{/key}
		{/if}

		{#key game.hurtCount}
			{#if game.hurtCount > 0 && game.status === 'playing'}
				<div
					class="rareearth-hurt pointer-events-none absolute inset-0 z-30 border-8 border-tie-red"
				></div>
			{/if}
		{/key}
	</div>

	<!-- What each factory wants -->
	<ul class="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label={m.rareearth_legend_label()}>
		{#each ELEMENTS as element (element)}
			<li
				class="flex min-w-0 flex-col items-center gap-0.5 rounded-md border-2 border-ink bg-paper px-1 py-1 text-center font-display text-[0.65rem] leading-tight font-bold shadow-[2px_2px_0_var(--color-ink)] sm:flex-row sm:justify-center sm:gap-1.5 sm:text-xs"
				class:opacity-50={element === 'europium' && game.round < 3}
			>
				<svg viewBox="-8 -8 16 16" class="size-5 shrink-0" aria-hidden="true">
					{#if element === 'neodymium'}
						<circle r="6.2" fill={SHAPE_COLOURS.neodymium} stroke="#111" stroke-width="1.6" />
					{:else if element === 'dysprosium'}
						<rect
							x="-5.6"
							y="-5.6"
							width="11.2"
							height="11.2"
							rx="1.4"
							fill={SHAPE_COLOURS.dysprosium}
							stroke="#111"
							stroke-width="1.6"
						/>
					{:else}
						<polygon
							points="0,-7 6.6,0 0,7 -6.6,0"
							fill={SHAPE_COLOURS.europium}
							stroke="#111"
							stroke-width="1.6"
						/>
					{/if}
					<text
						y="2.2"
						text-anchor="middle"
						font-size="5.6"
						font-weight="800"
						font-family="sans-serif"
						fill="#111">{ELEMENT_SYMBOLS[element]}</text
					>
				</svg>
				<span dir="auto" class="truncate">{elementName(element)}</span>
				<span aria-hidden="true">&rarr;</span>
				<span dir="auto" class="truncate">{factoryName(element)}</span>
			</li>
		{/each}
	</ul>

	<!-- The notices of the ministry -->
	<section class="flex min-h-[7.5rem] flex-col gap-1.5" aria-label={m.rareearth_board_title()}>
		<h3 dir="auto" class="flex items-center gap-1.5 font-display text-xs font-bold sm:text-sm">
			<IconStamp class="size-4 shrink-0" aria-hidden="true" />
			{m.rareearth_board_title()}
		</h3>
		{#each game.rules as rule (rule.id)}
			{@const announced = ruleStatus(rule, game.nowMs) === 'announced'}
			<article
				class="flex items-start gap-2 rounded-md border-2 border-ink bg-paper px-2 py-1.5 shadow-[2px_2px_0_var(--color-ink)]"
				class:rareearth-new={announced}
			>
				<span
					class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-ink {rule.kind ===
					'ban'
						? 'bg-tie-red text-paper'
						: rule.kind === 'tariff'
							? 'bg-mustard'
							: rule.kind === 'quota'
								? 'bg-banner-slate text-paper'
								: 'bg-explosion-yellow'}"
					aria-hidden="true"
				>
					{#if rule.kind === 'ban'}
						<IconBan class="size-4" />
					{:else if rule.kind === 'tariff'}
						<IconCoins class="size-4" />
					{:else if rule.kind === 'quota'}
						<IconGauge class="size-4" />
					{:else}
						<IconStamp class="size-4" />
					{/if}
				</span>
				<div class="min-w-0 flex-1">
					<p dir="auto" class="flex flex-wrap items-center gap-x-2 font-display text-xs font-bold">
						<span>{ruleKindName(rule.kind)}</span>
						<span
							class="rounded border border-ink px-1 text-[0.65rem] tabular-nums {announced
								? 'bg-explosion-yellow'
								: 'bg-sand'}"
						>
							{announced
								? m.rareearth_notice_announced({ seconds: secondsLeft(rule) })
								: m.rareearth_notice_active({ seconds: secondsLeft(rule) })}
						</span>
					</p>
					<p dir="auto" class="text-xs leading-snug">{ruleText(graph, rule)}</p>
				</div>
			</article>
		{:else}
			<p
				dir="auto"
				class="rounded-md border-2 border-dashed border-ink/40 px-2 py-3 text-center text-xs text-ink/60 italic"
			>
				{m.rareearth_board_empty()}
			</p>
		{/each}
	</section>

	{#if game.status === 'ready'}
		<div
			class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-ink/35 p-4"
		>
			<div
				class="sticker pop-in flex w-full max-w-xs flex-col items-center gap-3 p-4 text-center"
				style:--tilt="-1.5deg"
			>
				<p dir="auto" class="text-sm leading-snug font-semibold">{m.rareearth_ready_hint()}</p>
				<p dir="auto" class="text-xs leading-snug text-ink/70 italic">{m.rareearth_tip()}</p>
				{#if game.best !== null}
					<p class="text-sm font-semibold">{m.rareearth_best({ score: game.best })}</p>
				{/if}
				<button type="button" class="btn-chunky bg-tie-red text-xl" onclick={() => game.start()}>
					<IconPlay class="size-5" aria-hidden="true" />
					{m.rareearth_start()}
				</button>
			</div>
		</div>
	{:else if game.status === 'paused'}
		<PauseOverlay onResume={() => game.resume()} />
	{/if}
</div>

<style>
	.rareearth-toast {
		animation: rareearth-toast 1300ms ease-out forwards;
	}

	.rareearth-hurt {
		animation: rareearth-hurt 420ms ease-out forwards;
	}

	.rareearth-node {
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		outline-offset: 0;
	}

	.rareearth-node:hover {
		background: color-mix(in srgb, var(--color-paper) 30%, transparent);
	}

	.rareearth-node:focus-visible {
		outline: 3px solid var(--color-ink);
		background: color-mix(in srgb, var(--color-explosion-yellow) 55%, transparent);
	}

	.announced {
		animation: rareearth-blink 800ms ease-in-out infinite;
	}

	.rareearth-new {
		animation: rareearth-pop 260ms ease-out both;
	}

	@keyframes rareearth-toast {
		0% {
			opacity: 0;
			transform: scale(0.7);
		}
		12% {
			opacity: 1;
			transform: scale(1.08);
		}
		20% {
			transform: scale(1);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-0.75rem);
		}
	}

	@keyframes rareearth-hurt {
		from {
			opacity: 0.85;
		}
		to {
			opacity: 0;
		}
	}

	@keyframes rareearth-pop {
		from {
			opacity: 0;
			transform: scale(0.94);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes rareearth-blink {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.rareearth-toast,
		.announced,
		.rareearth-new {
			animation: none;
		}

		.rareearth-hurt {
			animation-duration: 1ms;
		}
	}
</style>
