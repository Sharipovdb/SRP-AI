import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  PROTOTYPE_CLICKABLE_WEB_PROMPT,
  PROTOTYPE_TECHNICAL_SUMMARY_PROMPT,
} from "./srp-system-prompt";

export async function generatePrototypeHtml(
  prototypeType: string,
  ideaSummary: string,
  primaryFeatures: string[],
  platform: string,
  productType: string,
  company: string | null
): Promise<string> {
  let prompt: string;

  if (prototypeType === "clickable_web") {
    prompt = PROTOTYPE_CLICKABLE_WEB_PROMPT(ideaSummary, primaryFeatures, platform, company);
  } else {
    prompt = PROTOTYPE_TECHNICAL_SUMMARY_PROMPT(ideaSummary, primaryFeatures, platform, productType);
  }

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
  if (html.startsWith("```html")) {
    html = html.slice(7);
  }
  if (html.startsWith("```")) {
    html = html.slice(3);
  }
  if (html.endsWith("```")) {
    html = html.slice(0, -3);
  }
  return html.trim();
}
