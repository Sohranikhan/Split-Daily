import { integer, timestamp, varchar } from "drizzle-orm/pg-core";
const publicId = (name) => varchar(name, { length: 36 }).notNull().unique().$defaultFn(() => crypto.randomUUID());
const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();
const ts = (name) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("createdAt").defaultNow().notNull();
const updatedAt = () => ts("updatedAt").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date());
export {
  createdAt,
  id,
  publicId,
  ts,
  updatedAt
};
