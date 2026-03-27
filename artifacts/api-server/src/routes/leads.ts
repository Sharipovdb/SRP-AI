import { Router, type IRouter } from "express";
import { eq, desc, asc, count, and, sql } from "drizzle-orm";
import { db, leadsTable, chatMessagesTable, prototypesTable } from "@workspace/db";

const router: IRouter = Router();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "srp-admin-2024";

function requireAdmin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const tokenFromQuery = req.query.token as string;
  const tokenFromHeader = req.headers["x-admin-token"] as string;

  if (tokenFromQuery !== ADMIN_TOKEN && tokenFromHeader !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/leads", requireAdmin, async (req, res) => {
  const {
    segment,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
    limit = "50",
    offset = "0",
  } = req.query as {
    segment?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    limit?: string;
    offset?: string;
  };

  const limitNum = Math.min(parseInt(limit) || 50, 200);
  const offsetNum = parseInt(offset) || 0;

  const conditions = [];
  if (segment && segment !== "all") {
    conditions.push(eq(leadsTable.qualificationSegment, segment));
  }
  if (status && status !== "all") {
    conditions.push(eq(leadsTable.status, status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderBy;
  if (sortBy === "qualificationScore") {
    orderBy = sortOrder === "asc"
      ? asc(leadsTable.qualificationScore)
      : desc(leadsTable.qualificationScore);
  } else {
    orderBy = sortOrder === "asc"
      ? asc(leadsTable.createdAt)
      : desc(leadsTable.createdAt);
  }

  const [leads, totalResult] = await Promise.all([
    db
      .select()
      .from(leadsTable)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limitNum)
      .offset(offsetNum),
    db.select({ count: count() }).from(leadsTable).where(whereClause),
  ]);

  const total = totalResult[0]?.count ?? 0;

  res.json({
    leads: leads.map((lead) => ({
      id: lead.id,
      sessionId: lead.sessionId,
      email: lead.email,
      name: lead.name,
      company: lead.company,
      status: lead.status,
      qualificationScore: lead.qualificationScore,
      qualificationSegment: lead.qualificationSegment,
      ideaSummary: lead.ideaSummary,
      productType: lead.productType,
      platform: lead.platform,
      prototypeType: lead.prototypeType,
      prototypeUrl: lead.prototypeUrl,
      consultantRequested: lead.consultantRequested,
      conversationMessageCount: lead.conversationMessageCount,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    })),
    total,
    limit: limitNum,
    offset: offsetNum,
  });
});

router.get("/leads/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const lead = await db.query.leadsTable.findFirst({
    where: eq(leadsTable.id, id),
  });

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const [messages, prototypes] = await Promise.all([
    db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.leadId, lead.id))
      .orderBy(chatMessagesTable.createdAt),
    db
      .select()
      .from(prototypesTable)
      .where(eq(prototypesTable.leadId, lead.id))
      .orderBy(desc(prototypesTable.createdAt))
      .limit(1),
  ]);

  const prototype = prototypes[0] || null;

  res.json({
    id: lead.id,
    sessionId: lead.sessionId,
    email: lead.email,
    name: lead.name,
    company: lead.company,
    roleTitle: lead.roleTitle,
    status: lead.status,
    qualificationScore: lead.qualificationScore,
    qualificationSegment: lead.qualificationSegment,
    ideaSummary: lead.ideaSummary,
    ideaRaw: lead.ideaRaw,
    productType: lead.productType,
    platform: lead.platform,
    primaryFeatures: lead.primaryFeatures,
    existingSystems: lead.existingSystems,
    budgetSignal: lead.budgetSignal,
    urgencySignal: lead.urgencySignal,
    prototypeType: lead.prototypeType,
    prototypeUrl: lead.prototypeUrl,
    prototypeGeneratedAt: lead.prototypeGeneratedAt,
    consultantRequested: lead.consultantRequested,
    dropOffStage: lead.dropOffStage,
    conversationMessageCount: lead.conversationMessageCount,
    source: lead.source,
    notes: lead.notes,
    nextAction: lead.nextAction,
    converted: lead.converted,
    dealValue: lead.dealValue ? parseFloat(lead.dealValue) : null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
    prototype: prototype
      ? {
          id: prototype.id,
          leadId: prototype.leadId,
          type: prototype.type,
          status: prototype.status,
          htmlContent: prototype.htmlContent,
          createdAt: prototype.createdAt,
        }
      : null,
  });
});

router.patch("/leads/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, notes, nextAction, converted, dealValue, assignedConsultant } = req.body as {
    status?: string;
    notes?: string;
    nextAction?: string;
    converted?: boolean;
    dealValue?: number;
    assignedConsultant?: string;
  };

  const lead = await db.query.leadsTable.findFirst({
    where: eq(leadsTable.id, id),
  });

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const updateData: Partial<typeof leadsTable.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (nextAction !== undefined) updateData.nextAction = nextAction;
  if (converted !== undefined) {
    updateData.converted = converted;
    if (converted && !lead.conversionDate) {
      updateData.conversionDate = new Date();
    }
  }
  if (dealValue !== undefined) updateData.dealValue = dealValue.toString();
  if (assignedConsultant !== undefined) updateData.assignedConsultant = assignedConsultant;

  const [updated] = await db
    .update(leadsTable)
    .set(updateData)
    .where(eq(leadsTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    sessionId: updated.sessionId,
    email: updated.email,
    name: updated.name,
    company: updated.company,
    roleTitle: updated.roleTitle,
    status: updated.status,
    qualificationScore: updated.qualificationScore,
    qualificationSegment: updated.qualificationSegment,
    ideaSummary: updated.ideaSummary,
    ideaRaw: updated.ideaRaw,
    productType: updated.productType,
    platform: updated.platform,
    primaryFeatures: updated.primaryFeatures,
    existingSystems: updated.existingSystems,
    budgetSignal: updated.budgetSignal,
    urgencySignal: updated.urgencySignal,
    prototypeType: updated.prototypeType,
    prototypeUrl: updated.prototypeUrl,
    prototypeGeneratedAt: updated.prototypeGeneratedAt,
    consultantRequested: updated.consultantRequested,
    dropOffStage: updated.dropOffStage,
    conversationMessageCount: updated.conversationMessageCount,
    source: updated.source,
    notes: updated.notes,
    nextAction: updated.nextAction,
    converted: updated.converted,
    dealValue: updated.dealValue ? parseFloat(updated.dealValue) : null,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    messages: [],
    prototype: null,
  });
});

export default router;
