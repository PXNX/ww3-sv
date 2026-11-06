// `sdk/db` for the nyx runner: the schema DSL and operators of Telegram Serverless, mapped onto
// drizzle-orm's SQLite dialect, which the platform's builder copies.

import { integer } from 'drizzle-orm/sqlite-core';

export { and, eq, gt, gte, lt, lte, ne, or, not, isNull, isNotNull, inArray, desc, asc, sql } from 'drizzle-orm';
export { integer, text, real, blob, index, uniqueIndex, sqliteTable as table } from 'drizzle-orm/sqlite-core';

export const boolean = (name) => integer(name, { mode: 'boolean' });
