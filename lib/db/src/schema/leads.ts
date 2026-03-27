import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  json,
  uuid,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

  status: text("status").notNull().default("started"),

  email: text("email"),
  name: text("name"),
  company: text("company"),
  roleTitle: text("role_title"),
  phone: text("phone"),
  country: text("country"),
  industry: text("industry"),

  ideaSummary: text("idea_summary"),
  ideaRaw: text("idea_raw"),
  productType: text("product_type"),
  primaryFeatures: json("primary_features").$type<string[]>(),
  platform: text("platform"),
  existingSystems: json("existing_systems").$type<string[]>(),
  budgetSignal: text("budget_signal"),
  urgencySignal: text("urgency_signal"),

  qualificationScore: integer("qualification_score"),
  qualificationSegment: text("qualification_segment"),

  prototypeType: text("prototype_type"),
  prototypeUrl: text("prototype_url"),
  prototypeGeneratedAt: timestamp("prototype_generated_at", { withTimezone: true }),

  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  emailOpened: boolean("email_opened").default(false),
  emailOpenedAt: timestamp("email_opened_at", { withTimezone: true }),
  emailCtaClicked: boolean("email_cta_clicked").default(false),

  consultantRequested: boolean("consultant_requested").notNull().default(false),
  consultantRequestedAt: timestamp("consultant_requested_at", { withTimezone: true }),
  assignedConsultant: text("assigned_consultant"),

  dropOffStage: text("drop_off_stage"),
  dropOffReason: text("drop_off_reason"),

  conversationMessageCount: integer("conversation_message_count").notNull().default(0),
  conversationDurationSeconds: integer("conversation_duration_seconds"),

  source: text("source"),
  referrerUrl: text("referrer_url"),
  ipAddress: text("ip_address"),

  notes: text("notes"),
  nextAction: text("next_action"),

  converted: boolean("converted").notNull().default(false),
  conversionDate: timestamp("conversion_date", { withTimezone: true }),
  dealValue: decimal("deal_value", { precision: 10, scale: 2 }),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
