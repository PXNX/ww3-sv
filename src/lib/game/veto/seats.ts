/* The five permanent seats at the table, in seating order. The ids are Circle Flags icon names. */
export const SEATS = ['us', 'gb', 'fr', 'ru', 'cn'] as const;

export type SeatId = (typeof SEATS)[number];
