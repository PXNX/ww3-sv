/* Translated names of the rooms of the West Wing and of the tools in the Leak Patrol tray */
import { ROOMS } from '#lib/game/leakpatrol/rooms.js';
import type { ToolKind } from '#lib/game/leakpatrol/tools.js';
import { m } from '#lib/paraglide/messages.js';

const ROOM_NAMES: readonly (() => string)[] = [
	m.leakpatrol_room_oval,
	m.leakpatrol_room_press,
	m.leakpatrol_room_situation,
	m.leakpatrol_room_cabinet,
	m.leakpatrol_room_kitchen,
	m.leakpatrol_room_garden
];

if (ROOM_NAMES.length !== ROOMS.length) {
	throw new Error('leakpatrolText.ts and ROOMS disagree about the number of rooms');
}

export function roomName(index: number): string {
	return ROOM_NAMES[index]();
}

const TOOL_NAMES: Record<ToolKind, () => string> = {
	sharpie: m.leakpatrol_tool_sharpie,
	tape: m.leakpatrol_tool_tape,
	folder: m.leakpatrol_tool_folder
};

export function toolName(tool: ToolKind): string {
	return TOOL_NAMES[tool]();
}
