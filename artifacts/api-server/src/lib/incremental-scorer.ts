export interface IncrementalScore {
  qualificationScore: number;
  qualificationSegment: string;
  businessSignals: number;
  urgencySignals: number;
  fitSignals: number;
  engagementQuality: number;
}

const BUSINESS_TERMS = [
  "company", "business", "enterprise", "startup", "client", "customer",
  "revenue", "team", "employees", "staff", "organization", "industry",
  "b2b", "saas", "platform", "product", "service", "solution",
];

const URGENCY_TERMS = [
  "urgent", "asap", "soon", "immediately", "quickly", "deadline",
  "quarter", "q1", "q2", "q3", "q4", "launch", "release", "month",
  "week", "timeline", "milestone", "shipping", "need it",
];

const FIT_TERMS = [
  "budget", "invest", "spend", "cost", "funding", "funded",
  "approved", "stakeholder", "cto", "ceo", "coo", "vp", "director",
  "decision", "approve", "sign off", "purchase", "hire", "build",
];

const COMPLEXITY_TERMS = [
  "integration", "api", "database", "dashboard", "analytics", "report",
  "workflow", "automation", "notification", "permission", "role",
  "mobile", "ios", "android", "web app", "portal", "admin",
];

function countMatches(content: string, terms: string[]): number {
  return terms.filter((t) => content.includes(t)).length;
}

export function estimateLeadScore(
  messages: Array<{ role: string; content: string }>
): IncrementalScore {
  const userMessages = messages.filter((m) => m.role === "user");
  const allUserContent = userMessages.map((m) => m.content.toLowerCase()).join(" ");

  const businessMatches = countMatches(allUserContent, BUSINESS_TERMS);
  const urgencyMatches = countMatches(allUserContent, URGENCY_TERMS);
  const fitMatches = countMatches(allUserContent, FIT_TERMS);
  const complexityMatches = countMatches(allUserContent, COMPLEXITY_TERMS);
  const totalUserChars = allUserContent.length;

  const engagementDepth = Math.min(15, userMessages.length * 2);
  const ideaSpecificity = totalUserChars > 800 ? 15 : totalUserChars > 400 ? 10 : totalUserChars > 100 ? 5 : 0;

  const businessSignals = Math.min(25, businessMatches * 5 + complexityMatches * 2);
  const urgencySignals = Math.min(20, urgencyMatches * 5);
  const fitSignals = Math.min(25, fitMatches * 6);
  const engagementQuality = Math.min(15, engagementDepth + ideaSpecificity);

  const qualificationScore = Math.min(
    100,
    businessSignals + urgencySignals + fitSignals + engagementQuality
  );

  const qualificationSegment =
    qualificationScore >= 70
      ? "high_fit"
      : qualificationScore >= 40
      ? "medium_fit"
      : qualificationScore >= 15
      ? "low_fit"
      : "not_qualified";

  return {
    qualificationScore,
    qualificationSegment,
    businessSignals,
    urgencySignals,
    fitSignals,
    engagementQuality,
  };
}
