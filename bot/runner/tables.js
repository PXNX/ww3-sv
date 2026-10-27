// Creates the tables and indexes of tgcloud/schema.js in the local database, so the runner needs no
// separate migration step. Only additions are applied (new tables, columns and indexes), like
// `tgcloud migrate` without the drops.

import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { is, SQL } from 'drizzle-orm';

const dialect = new SQLiteSyncDialect();
const quote = (name) => `"${name.replaceAll('"', '""')}"`;

function literal(value) {
  if (is(value, SQL)) return `(${dialect.sqlToQuery(value).sql})`;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function columnSql(column) {
  const parts = [quote(column.name), column.getSQLType()];
  if (column.primary) parts.push(column.autoIncrement ? 'PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY');
  if (column.notNull && !column.primary) parts.push('NOT NULL');
  if (column.default !== undefined) parts.push(`DEFAULT ${literal(column.default)}`);
  return parts.join(' ');
}

export function ensureTables(sqlite, schema) {
  for (const table of Object.values(schema)) {
    const config = getTableConfig(table);
    const existing = sqlite.query(`PRAGMA table_info(${quote(config.name)})`).all().map((row) => row.name);
    if (existing.length === 0) {
      sqlite.exec(`CREATE TABLE ${quote(config.name)} (${config.columns.map(columnSql).join(', ')})`);
    } else {
      for (const column of config.columns.filter((c) => !existing.includes(c.name))) {
        sqlite.exec(`ALTER TABLE ${quote(config.name)} ADD COLUMN ${columnSql(column)}`);
      }
    }
    for (const index of config.indexes) {
      const { name, columns, unique } = index.config;
      sqlite.exec(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${quote(name)} ON ${quote(config.name)} (${columns.map((c) => quote(c.name)).join(', ')})`);
    }
  }
}
