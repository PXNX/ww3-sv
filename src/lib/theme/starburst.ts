/*
 * Geometry for the flat starburst explosion in the freeonis style: thin yellow rays of varied
 * length, each tipped with a small red arrowhead, plus a few loose sparks. Pure and deterministic.
 */

export interface StarburstShapes {
	/** Yellow ray triangles, as SVG polygon point lists */
	rays: string[];
	/** Red arrowhead tips, as SVG polygon point lists */
	tips: string[];
	/** Small loose yellow sparks, as SVG polygon point lists */
	sparks: string[];
}

const RAY_LENGTHS = [1, 0.62, 0.88, 0.55, 0.97, 0.7, 0.84, 0.58, 0.93, 0.66, 0.8, 0.6];

function point(cx: number, cy: number, angle: number, along: number, across: number) {
	const x = cx + along * Math.cos(angle) - across * Math.sin(angle);
	const y = cy + along * Math.sin(angle) + across * Math.cos(angle);
	return `${x.toFixed(1)},${y.toFixed(1)}`;
}

export function starburst(cx: number, cy: number, radius: number, rays = 12): StarburstShapes {
	const shapes: StarburstShapes = { rays: [], tips: [], sparks: [] };
	const inner = radius * 0.12;
	const width = radius * 0.11;
	const tip = radius * 0.14;

	for (let i = 0; i < rays; i++) {
		const angle = (Math.PI * 2 * i) / rays - Math.PI / 2 + (i % 2 ? 0.08 : -0.05);
		const length = radius * RAY_LENGTHS[i % RAY_LENGTHS.length] - tip;
		shapes.rays.push(
			[
				point(cx, cy, angle, inner, -width / 2),
				point(cx, cy, angle, length, 0),
				point(cx, cy, angle, inner, width / 2)
			].join(' ')
		);
		shapes.tips.push(
			[
				point(cx, cy, angle, length - tip * 0.2, -tip * 0.45),
				point(cx, cy, angle, length + tip, 0),
				point(cx, cy, angle, length - tip * 0.2, tip * 0.45),
				point(cx, cy, angle, length + tip * 0.25, 0)
			].join(' ')
		);
		if (i % 3 === 1) {
			const sparkAngle = angle + Math.PI / rays;
			const at = radius * 0.45;
			shapes.sparks.push(
				[
					point(cx, cy, sparkAngle, at, -width * 0.35),
					point(cx, cy, sparkAngle, at + radius * 0.14, 0),
					point(cx, cy, sparkAngle, at, width * 0.35)
				].join(' ')
			);
		}
	}
	return shapes;
}
