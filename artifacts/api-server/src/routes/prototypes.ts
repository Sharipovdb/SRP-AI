import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, prototypesTable } from "@workspace/db";
import { qualifyLead } from "../lib/qualification";
import { generatePrototypeHtml } from "../lib/prototype-generator";
import { chatMessagesTable, leadsTable } from "@workspace/db";

const router: IRouter = Router();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "srp-admin-2024";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/prototypes/:id", async (req, res) => {
  const id = String(req.params.id);

  const prototype = await db.query.prototypesTable.findFirst({
    where: eq(prototypesTable.id, id),
  });

  if (!prototype) {
    res.status(404).json({ error: "Prototype not found" });
    return;
  }

  res.json({
    id: prototype.id,
    leadId: prototype.leadId,
    type: prototype.type,
    status: prototype.status,
    htmlContent: prototype.htmlContent,
    technicalSummaryHtml: prototype.technicalSummaryHtml,
    createdAt: prototype.createdAt,
  });
});

router.post("/prototypes/:id/generate", requireAdmin, async (req, res) => {
  const id = String(req.params.id);

  const prototype = await db.query.prototypesTable.findFirst({
    where: eq(prototypesTable.id, id),
  });

  if (!prototype) {
    res.status(404).json({ error: "Prototype not found" });
    return;
  }

  if (prototype.status === "ready" && prototype.htmlContent) {
    res.json({
      id: prototype.id,
      leadId: prototype.leadId,
      type: prototype.type,
      status: prototype.status,
      htmlContent: prototype.htmlContent,
      createdAt: prototype.createdAt,
    });
    return;
  }

  try {
    const lead = await db.query.leadsTable.findFirst({
      where: eq(leadsTable.id, prototype.leadId),
    });

    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    await db
      .update(prototypesTable)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(prototypesTable.id, id));

    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.leadId, lead.id))
      .orderBy(chatMessagesTable.createdAt);

    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const qualification = await qualifyLead(transcript, lead.email || "");

    const htmlContent = await generatePrototypeHtml(
      qualification.prototypeType,
      qualification.ideaSummary,
      qualification.primaryFeatures,
      qualification.platform,
      qualification.productType,
      qualification.company
    );

    const [updated] = await db
      .update(prototypesTable)
      .set({
        htmlContent,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(prototypesTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      leadId: updated.leadId,
      type: updated.type,
      status: updated.status,
      htmlContent: updated.htmlContent,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating prototype");
    await db
      .update(prototypesTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(prototypesTable.id, id));
    res.status(500).json({ error: "Prototype generation failed" });
  }
});

export default router;
