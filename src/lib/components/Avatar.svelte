<!--
	The player's agent as a layered inline SVG bust in the game's cartoon style: thick ink outlines,
	flat colours, a slightly too big head. Layers go back to front: hair that hangs behind the head,
	shirt, neck, ears, head, face, front hair and the hat. Without a `look` it draws the player's
	own saved agent, so any screen can show "you" with one tag; until the player is signed in with
	Telegram that agent is anonymous, a hooded figure with a question mark for a face.
-->
<script lang="ts">
	import type { AvatarLook } from '#lib/game/avatar/look.js';
	import { avatar } from '#lib/game/avatar/store.svelte.js';

	interface Props {
		look?: AvatarLook;
		/** Width in CSS pixels; the bust is a little taller than wide */
		size?: number;
		expression?: 'happy' | 'neutral' | 'surprised';
		/** Accessible name; without one the drawing is decorative */
		label?: string;
		class?: string;
	}

	let { look, size = 64, expression = 'happy', label, class: className = '' }: Props = $props();

	const avatarState = avatar();
	const current = $derived(look ?? avatarState.shown);
	const anonymous = $derived(!look && avatarState.anonymous);
	const HOOD = '#1d1d1d';
	const uid = $props.id();

	const INK = '#111111';
	const STROKE = 3;

	/** Where the head sits, per face shape, so hair, ears and hats can follow it */
	const HEADS = {
		round: { top: 28, half: 34, bottom: 96 },
		oval: { top: 25, half: 30, bottom: 99 },
		square: { top: 28, half: 33, bottom: 96 },
		long: { top: 21, half: 29, bottom: 99 }
	} as const;

	const head = $derived(HEADS[current.face]);
	const left = $derived(60 - head.half);
	const right = $derived(60 + head.half);
	/** A cap of hair over the top of the head, down to the temples */
	const hairCap = $derived(
		`M${left - 1} 60 C${left - 2} ${head.top - 8} ${right + 2} ${head.top - 8} ${right + 1} 60 ` +
			`C${right - 6} ${head.top + 12} ${left + 6} ${head.top + 12} ${left - 1} 60 Z`
	);
	const darkShirt = $derived(current.shirtColor === '#111111');
</script>

<svg
	viewBox="0 0 120 140"
	width={size}
	height={size * (140 / 120)}
	class={className}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	stroke={INK}
	stroke-width={STROKE}
	stroke-linejoin="round"
	stroke-linecap="round"
>
	<defs>
		<clipPath id="{uid}-shirt">
			<path d="M12 141 C12 116 32 103 60 103 C88 103 108 116 108 141 Z" />
		</clipPath>
	</defs>

	<!-- The hood of the anonymous agent, behind the head -->
	{#if anonymous}
		<path d="M18 116 C10 70 22 14 60 14 C98 14 110 70 102 116 Z" fill={HOOD} />
	{/if}

	<!-- Hair that hangs behind the head -->
	{#if current.hair === 'long'}
		<path
			d="M{left - 6} 58 C{left - 10} 90 {left - 4} 112 {left + 4} 116 L{right - 4} 116 C{right +
				4} 112 {right + 10} 90 {right + 6} 58 Z"
			fill={current.hairColor}
		/>
	{:else if current.hair === 'bun'}
		<circle cx="60" cy={head.top - 6} r="13" fill={current.hairColor} />
	{/if}

	<!-- Shirt -->
	{#if current.shirt === 'hoodie'}
		<path
			d="M30 112 C26 92 40 84 60 84 C80 84 94 92 90 112 Z"
			fill={current.shirtColor}
			opacity="0.92"
		/>
	{/if}
	<!-- Neck and ears -->
	<rect
		x="50"
		y={head.bottom - 8}
		width="20"
		height={112 - head.bottom}
		rx="4"
		fill={current.skin}
	/>
	<circle cx={left} cy="64" r="7" fill={current.skin} />
	<circle cx={right} cy="64" r="7" fill={current.skin} />

	{#if current.shirt === 'tank'}
		<path d="M12 141 C12 116 32 103 60 103 C88 103 108 116 108 141 Z" fill={current.skin} />
		<path
			d="M30 141 L34 110 L44 106 C48 118 72 118 76 106 L86 110 L90 141 Z"
			fill={current.shirtColor}
		/>
	{:else}
		<path d="M12 141 C12 116 32 103 60 103 C88 103 108 116 108 141 Z" fill={current.shirtColor} />
	{/if}
	{#if current.shirt === 'camo'}
		<g clip-path="url(#{uid}-shirt)" stroke="none" fill={INK} opacity="0.28">
			<ellipse cx="28" cy="122" rx="10" ry="6" />
			<ellipse cx="56" cy="132" rx="12" ry="5" />
			<ellipse cx="86" cy="118" rx="9" ry="6" />
			<ellipse cx="98" cy="136" rx="8" ry="5" />
			<ellipse cx="44" cy="112" rx="6" ry="4" />
		</g>
		<path d="M12 141 C12 116 32 103 60 103 C88 103 108 116 108 141 Z" fill="none" />
	{:else if current.shirt === 'suit'}
		<path d="M48 104 L60 128 L72 104 Z" fill="#ffffff" />
		<path d="M57 108 L63 108 L65 130 L60 136 L55 130 Z" fill="#e5484d" stroke-width="2" />
		<path d="M48 104 L58 124 M72 104 L62 124" fill="none" stroke-width="2.5" />
	{:else if current.shirt === 'hoodie'}
		<path d="M52 108 L50 126 M68 108 L70 126" fill="none" stroke-width="2.5" />
		<circle cx="50" cy="128" r="2" fill={darkShirt ? '#ffffff' : INK} stroke-width="1.5" />
		<circle cx="70" cy="128" r="2" fill={darkShirt ? '#ffffff' : INK} stroke-width="1.5" />
	{:else if current.shirt === 'tee'}
		<path d="M46 104 C50 114 70 114 74 104" fill="none" stroke-width="2.5" />
	{/if}

	<!-- Head -->
	{#if current.face === 'round'}
		<circle cx="60" cy="62" r="34" fill={current.skin} />
	{:else if current.face === 'oval'}
		<ellipse cx="60" cy="62" rx="30" ry="37" fill={current.skin} />
	{:else if current.face === 'square'}
		<rect x="27" y="28" width="66" height="68" rx="16" fill={current.skin} />
	{:else}
		<rect x="31" y="21" width="58" height="78" rx="26" fill={current.skin} />
	{/if}

	<!-- Eyes -->
	{#if current.eyes === 'dots'}
		<circle cx="48" cy="60" r="3.5" fill={INK} stroke="none" />
		<circle cx="72" cy="60" r="3.5" fill={INK} stroke="none" />
	{:else if current.eyes === 'wide'}
		<circle cx="47" cy="59" r="7.5" fill="#ffffff" stroke-width="2.5" />
		<circle cx="73" cy="59" r="7.5" fill="#ffffff" stroke-width="2.5" />
		<circle cx="49" cy="60" r="3" fill={INK} stroke="none" />
		<circle cx="75" cy="60" r="3" fill={INK} stroke="none" />
	{:else if current.eyes === 'sleepy'}
		<path d="M41 61 Q48 66 55 61" fill="none" stroke-width="2.5" />
		<path d="M65 61 Q72 66 79 61" fill="none" stroke-width="2.5" />
		<path d="M42 56 L54 57 M66 57 L78 56" fill="none" stroke-width="2" opacity="0.6" />
	{:else if current.eyes === 'angry'}
		<circle cx="48" cy="61" r="3.5" fill={INK} stroke="none" />
		<circle cx="72" cy="61" r="3.5" fill={INK} stroke="none" />
		<path d="M40 50 L55 55 M80 50 L65 55" fill="none" stroke-width="3.5" />
	{:else}
		<path d="M36 55 L84 55" fill="none" stroke-width="3" />
		<rect x="38" y="54" width="19" height="12" rx="5" fill={INK} />
		<rect x="63" y="54" width="19" height="12" rx="5" fill={INK} />
		<path d="M42 57 L47 57" stroke="#ffffff" stroke-width="2" opacity="0.8" />
	{/if}

	<!-- Nose -->
	{#if anonymous}
		<!-- No nose and no mouth for the anonymous agent: a question mark instead -->
	{:else if current.nose === 'button'}
		<circle cx="60" cy="71" r="4" fill={current.skin} stroke-width="2.5" />
	{:else if current.nose === 'pointy'}
		<path d="M60 62 L67 76 L58 76" fill={current.skin} stroke-width="2.5" />
	{:else if current.nose === 'potato'}
		<ellipse cx="60" cy="73" rx="8.5" ry="6.5" fill={current.skin} stroke-width="2.5" />
	{:else}
		<path d="M58 60 C70 64 72 76 62 78 C60 78 58 76 59 74" fill={current.skin} stroke-width="2.5" />
	{/if}

	<!-- Mouth and cheeks -->
	{#if anonymous}
		<path
			d="M52 74 C52 66 68 66 68 74 C68 80 60 80 60 86"
			fill="none"
			stroke="#ffffff"
			stroke-width="4.5"
		/>
		<circle cx="60" cy="93" r="3" fill="#ffffff" stroke="none" />
	{:else if expression === 'happy'}
		<path d="M49 84 Q60 93 71 84" fill="none" stroke-width="3" />
		<circle cx="40" cy="76" r="4" fill="#e5484d" stroke="none" opacity="0.25" />
		<circle cx="80" cy="76" r="4" fill="#e5484d" stroke="none" opacity="0.25" />
	{:else if expression === 'surprised'}
		<ellipse cx="60" cy="87" rx="5" ry="6" fill={INK} stroke="none" />
	{:else}
		<path d="M51 86 L69 86" fill="none" stroke-width="3" />
	{/if}

	<!-- Front hair, or the rim of the hood -->
	{#if anonymous}
		<path
			d="M24 92 C18 52 34 26 60 26 C86 26 102 52 96 92"
			fill="none"
			stroke={HOOD}
			stroke-width="9"
		/>
	{:else if current.hair === 'bald'}
		<path
			d="M{60 - 10} {head.top + 7} Q60 {head.top + 3} {60 + 12} {head.top + 8}"
			fill="none"
			stroke="#ffffff"
			stroke-width="3"
			opacity="0.7"
		/>
	{:else if current.hair === 'mohawk'}
		<path
			d="M50 {head.top + 8} L48 {head.top - 12} L54 {head.top - 4} L57 {head.top -
				20} L61 {head.top - 6} L65 {head.top - 18} L67 {head.top - 3} L73 {head.top -
				12} L70 {head.top + 8} Z"
			fill={current.hairColor}
		/>
	{:else if current.hair === 'curly'}
		<g fill={current.hairColor}>
			{#each [-1, -0.66, -0.33, 0, 0.33, 0.66, 1] as t (t)}
				<circle
					cx={60 + t * (head.half - 2)}
					cy={head.top + 4 + Math.abs(t) * Math.abs(t) * 20}
					r="9"
				/>
			{/each}
		</g>
	{:else if current.hair === 'combover'}
		<path d={hairCap} fill={current.hairColor} />
		<path
			d="M{left + 4} {head.top + 14} C{left + 18} {head.top - 2} {right - 4} {head.top - 4} {right +
				2} {head.top + 18}"
			fill="none"
			stroke-width="2"
			opacity="0.55"
		/>
	{:else}
		<path d={hairCap} fill={current.hairColor} />
		{#if current.hair === 'long'}
			<path
				d="M{left - 1} 60 C{left + 4} {head.top + 18} {60 - 4} {head.top + 10} 58 {head.top + 2}"
				fill="none"
				stroke-width="2"
				opacity="0.5"
			/>
		{/if}
	{/if}

	<!-- Hat -->
	{#if current.hat === 'ogre-ears'}
		<!-- Two trumpet ears in the skin colour: horns without the headgear -->
		<path
			d="M{left + 4} 68 C{left - 8} 64 {left - 18} 54 {left - 24} 40 Q{left - 19} 33 {left -
				11} 38 C{left - 4} 48 {left + 1} 56 {left + 4} 58 Z"
			fill={current.skin}
		/>
		<path
			d="M{right - 4} 68 C{right + 8} 64 {right + 18} 54 {right + 24} 40 Q{right + 19} 33 {right +
				11} 38 C{right + 4} 48 {right - 1} 56 {right - 4} 58 Z"
			fill={current.skin}
		/>
		<path
			d="M{left - 19} 41 Q{left - 16} 37 {left - 13} 39 M{right + 19} 41 Q{right + 16} 37 {right +
				13} 39"
			fill="none"
			stroke-width="2"
			opacity="0.35"
		/>
	{:else if current.hat === 'beret'}
		<path
			d="M{left - 6} {head.top + 12} C{left - 8} {head.top - 10} {right + 2} {head.top -
				14} {right + 8} {head.top + 6} C{right} {head.top + 14} {left + 4} {head.top + 18} {left -
				6} {head.top + 12} Z"
			fill="#e5484d"
		/>
		<path d="M64 {head.top - 8} L66 {head.top - 15}" fill="none" stroke-width="3.5" />
	{:else if current.hat === 'cap'}
		<path
			d="M{left} {head.top + 16} C{left} {head.top - 10} {right} {head.top - 10} {right} {head.top +
				16} Z"
			fill="#4fa8d8"
		/>
		<path
			d="M{right - 6} {head.top + 16} L{right + 22} {head.top + 18} Q{right + 18} {head.top +
				10} {right - 4} {head.top + 10}"
			fill="#4fa8d8"
		/>
		<circle cx="60" cy={head.top - 3} r="3" fill="#4fa8d8" stroke-width="2" />
	{:else if current.hat === 'helmet'}
		<path
			d="M{left - 6} {head.top + 22} C{left - 6} {head.top - 14} {right + 6} {head.top -
				14} {right + 6} {head.top + 22} Z"
			fill="#556b2f"
		/>
		<path
			d="M{left - 9} {head.top + 22} L{right + 9} {head.top + 22}"
			fill="none"
			stroke-width="4"
		/>
		<path
			d="M{left - 2} {head.top + 22} L{left + 6} 80 M{right + 2} {head.top + 22} L{right - 6} 80"
			fill="none"
			stroke-width="2"
			opacity="0.7"
		/>
	{:else if current.hat === 'ushanka'}
		<path
			d="M{left - 7} {head.top + 16} L{left - 9} 76 L{left + 5} 72 L{left + 6} {head.top + 16} Z"
			fill="#7a5230"
		/>
		<path
			d="M{right + 7} {head.top + 16} L{right + 9} 76 L{right - 5} 72 L{right - 6} {head.top +
				16} Z"
			fill="#7a5230"
		/>
		<path
			d="M{left - 6} {head.top + 18} C{left - 6} {head.top - 16} {right + 6} {head.top -
				16} {right + 6} {head.top + 18} Z"
			fill="#5b3d22"
		/>
		<rect
			x={left - 8}
			y={head.top + 8}
			width={head.half * 2 + 16}
			height="13"
			rx="6"
			fill="#7a5230"
		/>
		<circle cx="60" cy={head.top + 2} r="4" fill="#e5484d" stroke-width="2" />
	{:else if current.hat === 'crown'}
		<path
			d="M{60 - 22} {head.top + 6} L{60 - 24} {head.top - 18} L{60 - 11} {head.top -
				6} L60 {head.top - 22} L{60 + 11} {head.top - 6} L{60 + 24} {head.top - 18} L{60 +
				22} {head.top + 6} Z"
			fill="#f5c83a"
		/>
		<circle cx="60" cy={head.top - 2} r="3" fill="#e5484d" stroke-width="2" />
	{/if}
</svg>
