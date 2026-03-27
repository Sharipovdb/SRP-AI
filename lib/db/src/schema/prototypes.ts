import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { leadsTable } from "./leads";

export const prototypesTable = pgTable("prototypes", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leadsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  htmlContent: text("html_content"),
  technicalSummaryHtml: text("technical_summary_html"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPrototypeSchema = createInsertSchema(prototypesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Prototype = typeof prototypesTable.$inferSelect;
export type InsertPrototype = z.infer<typeof insertPrototypeSchema>;
