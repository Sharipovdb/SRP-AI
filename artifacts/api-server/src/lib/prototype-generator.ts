import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  PROTOTYPE_CLICKABLE_WEB_PROMPT,
  PROTOTYPE_TECHNICAL_SUMMARY_PROMPT,
} from "./srp-system-prompt";

async function callClaude(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from prototype generation");
  }

  let html = content.text.trim();
  if (html.startsWith("```html")) html = html.slice(7);
  if (html.startsWith("```")) html = html.slice(3);
  if (html.endsWith("```")) html = html.slice(0, -3);
  return html.trim();
}

export async function generatePrototypeHtml(
  prototypeType: string,
  ideaSummary: string,
  primaryFeatures: string[],
  platform: string,
  productType: string,
  company: string | null
): Promise<string> {
  const prompt =
    prototypeType === "clickable_web"
      ? PROTOTYPE_CLICKABLE_WEB_PROMPT(ideaSummary, primaryFeatures, platform, company)
      : PROTOTYPE_TECHNICAL_SUMMARY_PROMPT(ideaSummary, primaryFeatures, platform, productType);

  return callClaude(prompt);
}

export async function generateBothPrototypes(
  ideaSummary: string,
  primaryFeatures: string[],
  platform: string,
  productType: string,
  company: string | null
): Promise<{ prototypeHtml: string; technicalSummaryHtml: string }> {
  const [prototypeHtml, technicalSummaryHtml] = await Promise.all([
    callClaude(PROTOTYPE_CLICKABLE_WEB_PROMPT(ideaSummary, primaryFeatures, platform, company)),
    callClaude(PROTOTYPE_TECHNICAL_SUMMARY_PROMPT(ideaSummary, primaryFeatures, platform, productType)),
  ]);

  return { prototypeHtml, technicalSummaryHtml };
}
