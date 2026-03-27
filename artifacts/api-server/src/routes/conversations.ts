import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, leadsTable, chatMessagesTable, prototypesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { SRP_SYSTEM_PROMPT } from "../lib/srp-system-prompt";
import { checkRateLimit, incrementRateLimit } from "../lib/rate-limiter";
import { qualifyLead } from "../lib/qualification";
import { generatePrototypeHtml } from "../lib/prototype-generator";

const router: IRouter = Router();

router.post("/conversations", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";

  const rateLimitCheck = checkRateLimit(ip);
  if (!rateLimitCheck.allowed) {
    res.status(429).json({ error: "Rate limit exceeded. You can start up to 3 conversations per day." });
    return;
  }

  const { source, referrerUrl } = req.body as { source?: string; referrerUrl?: string };

  const sessionId = crypto.randomUUID();

  const [lead] = await db
    .insert(leadsTable)
    .values({
      sessionId,
      status: "started",
      source: source || null,
      referrerUrl: referrerUrl || null,
      ipAddress: ip,
    })
    .returning();

  incrementRateLimit(ip);

  const openingMessage = "Welcome to Silk Road Professionals. I help turn rough software ideas into visual concepts you can see and share. Tell me — what are you thinking about building?";

  await db.insert(chatMessagesTable).values({
    leadId: lead.id,
    role: "assistant",
    content: openingMessage,
  });

  await db
    .update(leadsTable)
    .set({ conversationMessageCount: 1, status: "clarifying", updatedAt: new Date() })
    .where(eq(leadsTable.id, lead.id));

  res.status(201).json({
    sessionId,
    leadId: lead.id,
    status: "started",
    createdAt: lead.createdAt,
    initialMessage: openingMessage,
  });
});

router.get("/conversations/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  const lead = await db.query.leadsTable.findFirst({
    where: eq(leadsTable.sessionId, sessionId),
  });

  if (!lead) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.leadId, lead.id))
    .orderBy(chatMessagesTable.createdAt);

  res.json({
    sessionId: lead.sessionId,
    leadId: lead.id,
    status: lead.status,
    messageCount: messages.length,
    emailCaptured: !!lead.email,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
});

router.post("/conversations/:sessionId/messages", async (req, res) => {
  const { sessionId } = req.params;
  const { content } = req.body as { content: string };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Message content is required" });
    return;
  }

  const sanitized = content.trim().slice(0, 2000);

  const lead = await db.query.leadsTable.findFirst({
    where: eq(leadsTable.sessionId, sessionId),
  });

  if (!lead) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const existingMessages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.leadId, lead.id))
    .orderBy(chatMessagesTable.createdAt);

  if (existingMessages.length >= 30) {
    res.status(400).json({ error: "Conversation has reached the maximum length." });
    return;
  }

  await db.insert(chatMessagesTable).values({
    leadId: lead.id,
    role: "user",
    content: sanitized,
  });

  const allMessages = [...existingMessages, { role: "user", content: sanitized }];
  const chatHistory = allMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SRP_SYSTEM_PROMPT,
      messages: chatHistory,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullResponse += event.delta.text;
        res.write(
          `data: ${JSON.stringify({ content: event.delta.text })}\n\n`
        );
      }
    }

    await db.insert(chatMessagesTable).values({
      leadId: lead.id,
      role: "assistant",
      content: fullResponse,
    });

    const newCount = existingMessages.length + 2;
    await db
      .update(leadsTable)
      .set({
        conversationMessageCount: newCount,
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, lead.id));

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Error streaming message");
    res.write(`data: ${JSON.stringify({ error: "An error occurred" })}\n\n`);
    res.end();
  }
});

router.post("/conversations/:sessionId/contact", async (req, res) => {
  const { sessionId } = req.params;
  const { email, name, company } = req.body as {
    email: string;
    name?: string;
    company?: string;
  };

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const lead = await db.query.leadsTable.findFirst({
    where: eq(leadsTable.sessionId, sessionId),
  });

  if (!lead) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db
    .update(leadsTable)
    .set({
      email: email.toLowerCase(),
      name: name || null,
      company: company || null,
      status: "contact_captured",
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, lead.id));

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.leadId, lead.id))
    .orderBy(chatMessagesTable.createdAt);

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  let qualScore = 20;
  let segment = "low_fit";
  let prototypeId: string | null = null;

  try {
    await db
      .update(leadsTable)
      .set({ status: "generating_prototype", updatedAt: new Date() })
      .where(eq(leadsTable.id, lead.id));

    const qualification = await qualifyLead(transcript, email);

    qualScore = qualification.qualificationScore;
    segment = qualification.qualificationSegment;

    await db
      .update(leadsTable)
      .set({
        qualificationScore: qualification.qualificationScore,
        qualificationSegment: qualification.qualificationSegment,
        ideaSummary: qualification.ideaSummary,
        productType: qualification.productType,
        platform: qualification.platform,
        primaryFeatures: qualification.primaryFeatures,
        existingSystems: qualification.existingSystems,
        budgetSignal: qualification.budgetSignal,
        urgencySignal: qualification.urgencySignal,
        prototypeType: qualification.prototypeType,
        company: qualification.company || company || null,
        roleTitle: qualification.roleTitle,
        industry: qualification.industry,
        consultantRequested: qualification.consultantRecommended,
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, lead.id));

    const [prototype] = await db
      .insert(prototypesTable)
      .values({
        leadId: lead.id,
        type: qualification.prototypeType,
        status: "generating",
      })
      .returning();

    prototypeId = prototype.id;

    const htmlContent = await generatePrototypeHtml(
      qualification.prototypeType,
      qualification.ideaSummary,
      qualification.primaryFeatures,
      qualification.platform,
      qualification.productType,
      qualification.company
    );

    await db
      .update(prototypesTable)
      .set({
        htmlContent,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(prototypesTable.id, prototype.id));

    const prototypeUrl = `/preview/${prototype.id}`;

    await db
      .update(leadsTable)
      .set({
        prototypeUrl,
        prototypeGeneratedAt: new Date(),
        status: "prototype_sent",
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, lead.id));
  } catch (err) {
    req.log.error({ err }, "Error during qualification/prototype generation");
    await db
      .update(leadsTable)
      .set({ status: "contact_captured", updatedAt: new Date() })
      .where(eq(leadsTable.id, lead.id));
  }

  res.json({
    leadId: lead.id,
    email: email.toLowerCase(),
    prototypeId,
    qualificationScore: qualScore,
    segment,
    message: prototypeId
      ? "Your concept is being prepared! You can view it at the link provided."
      : "Thank you! Our team will be in touch shortly.",
  });
});

router.get("/conversations/:sessionId/score", async (req, res) => {
  const { sessionId } = req.params;

  const lead = await db.query.leadsTable.findFirst({
    where: eq(leadsTable.sessionId, sessionId),
  });

  if (!lead) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.json({
    score: lead.qualificationScore ?? 0,
    segment: lead.qualificationSegment ?? "not_qualified",
    businessSignals: 0,
    urgencySignals: 0,
    fitSignals: 0,
    engagementQuality: 0,
  });
});

export default router;
