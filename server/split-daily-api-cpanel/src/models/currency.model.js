import { boolean, index, integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { id, ts } from "./columns.js";
const currencies = pgTable("currencies", {
  code: varchar("code", { length: 3 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  symbol: varchar("symbol", { length: 8 }).notNull(),
  minorUnit: integer("minorUnit").default(2).notNull(),
  active: boolean("active").default(true).notNull()
});
const exchangeRates = pgTable("exchange_rates", {
  id: id(),
  baseCurrency: varchar("baseCurrency", { length: 3 }).notNull(),
  quoteCurrency: varchar("quoteCurrency", { length: 3 }).notNull(),
  rate: varchar("rate", { length: 32 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  capturedAt: ts("capturedAt").defaultNow().notNull()
}, (table) => [index("exchange_rates_lookup_idx").on(table.baseCurrency, table.quoteCurrency, table.capturedAt)]);
export {
  currencies,
  exchangeRates
};
