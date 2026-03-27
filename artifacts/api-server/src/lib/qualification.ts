import { anthropic } from "@workspace/integrations-anthropic-ai";
import { QUALIFICATION_SYSTEM_PROMPT } from "./srp-system-prompt";

export interface QualificationResult {
  qualificationScore: number;
  qualificationSegment: string;
  businessSignals: number;
  urgencySignals: number;
  fitSignals: number;
  engagementQuality: number;
  ideaSummary: string;
  productType: string;
  platform: string;
  primaryFeatures: string[];
  existingSystems: string[];
  budgetSignal: string;
  urgencySignal: string;
  prototypeType: string;
  company: string | null;
  roleTitle: string | null;
  industry: string | null;
  consultantRecommended: boolean;
}

export async function qualifyLead(
  transcript: string,
  email: string | null
): Promise<QualificationResult> {
  const prompt = `Analyze this conversation transcript and provide qualification data.\n\nEmail provided: ${email || 'Not provided'}\n\nTRANSCRIPT:\n${transcript}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: QUALIFICATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from qualification");
  }

  try {
    const result = JSON.parse(content.text) as QualificationResult;
    if (email) {
      const domain = email.split("@")[1]?.toLowerCase() || "";
      const consumerDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com", "aol.com", "mail.com", "protonmail.com", "proton.me"];
      if (!consumerDomains.includes(domain)) {
        result.engagementQuality = Math.min(15, result.engagementQuality + 8);
        result.qualificationScore = Math.min(100, result.qualificationScore + 8);
      }
    }
    return result;
  } catch {
    return {
      qualificationScore: 20,
      qualificationSegment: "low_fit",
      businessSignals: 5,
      urgencySignals: 5,
      fitSignals: 5,
      engagementQuality: 5,
      ideaSummary: "Idea not fully captured",
      productType: "other",
      platform: "unclear",
      primaryFeatures: [],
      existingSystems: [],
      budgetSignal: "no_signal",
      urgencySignal: "no_urgency",
      prototypeType: "technical_summary",
      company: null,
      roleTitle: null,
      industry: null,
      consultantRecommended: false,
    };
  }
}
