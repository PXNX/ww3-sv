/*
 * How each port looks: a fixed color and a fixed cartoon icon (see BeltRoadPortIcon.svelte), so the
 * two ports of a pair always match and no pair relies on color alone.
 */
import { PORTS, type PortId } from './board';

export interface PortStyle {
	/** Route and port color; every one reads against the dark ink outline */
	color: string;
	/** Which glyph BeltRoadPortIcon draws */
	glyph: number;
}

export const PORT_COLORS: Record<PortId, string> = {
	shanghai: '#e5484d',
	piraeus: '#4a78c8',
	hamburg: '#ddb93c',
	rotterdam: '#4fae6a',
	singapore: '#e8863a',
	mombasa: '#9a62c8',
	colombo: '#2fb0a8',
	trieste: '#e07aa8',
	djibouti: '#8a9a3a'
};

export const GLYPH_COUNT = PORTS.length;

export function portStyle(port: PortId): PortStyle {
	return { color: PORT_COLORS[port], glyph: PORTS.indexOf(port) };
}
