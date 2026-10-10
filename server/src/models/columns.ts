import { integer, timestamp, varchar } from "drizzle-orm/pg-core";

/** Column helpers shared by every model. */
export const publicId = (name: string) => varchar(name, { length: 36 }).notNull().unique().$defaultFn(() => crypto.randomUUID());
export const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();
export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
export const createdAt = () => ts("createdAt").defaultNow().notNull();
export const updatedAt = () => ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date());
