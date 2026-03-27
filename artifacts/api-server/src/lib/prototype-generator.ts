import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  PROTOTYPE_SYSTEM_PROMPT,
  PROTOTYPE_CLICKABLE_WEB_PROMPT,
  PROTOTYPE_TECHNICAL_SUMMARY_PROMPT,
} from "./srp-system-prompt";

/** Strip markdown code fences that Claude sometimes wraps around HTML. */
function stripCodeFences(raw: string): string {
  let html = raw.trim();
  if (html.startsWith("```html")) html = html.slice(7);
  if (html.startsWith("```")) html = html.slice(3);
  if (html.endsWith("```")) html = html.slice(0, -3);
  return html.trim();
}

/**
 * Ensure the generated HTML has a working showPage() function.
 * If Claude forgot to include it (or the output was truncated), we inject a
 * minimal navigation script so buttons / sidebar links still work.
 */
function ensureNavigation(html: string): string {
  if (html.includes("function showPage")) return html;

  // Minified fallback — readable version lives in PROTOTYPE_CLICKABLE_WEB_PROMPT
  const fallbackScript = `
<script>
function showPage(n){document.querySelectorAll("[data-page]").forEach(function(e){e.style.display="none"});var t=document.querySelector('[data-page="'+n+'"]');if(t)t.style.display="block";document.querySelectorAll("[data-nav]").forEach(function(l){l.classList.toggle("active",l.getAttribute("data-nav")===n)});window.scrollTo(0,0)}
function toggleModal(id){var m=document.getElementById(id);if(!m)return;m.style.display=m.style.display==="flex"?"none":"flex"}
function showToast(msg){var t=document.getElementById("toast");if(!t){t=document.createElement("div");t.id="toast";t.style.cssText="position:fixed;bottom:24px;right:24px;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;font-weight:600;z-index:9999;transition:opacity .3s;box-shadow:0 4px 12px rgba(0,0,0,.15)";document.body.appendChild(t)}t.textContent=msg;t.style.display="block";t.style.opacity="1";setTimeout(function(){t.style.opacity="0";setTimeout(function(){t.style.display="none"},300)},2500)}
function showTab(g,n){document.querySelectorAll('[data-tab-group="'+g+'"]').forEach(function(e){e.style.display="none"});var t=document.querySelector('[data-tab-group="'+g+'"][data-tab="'+n+'"]');if(t)t.style.display="block";document.querySelectorAll('[data-tab-btn-group="'+g+'"]').forEach(function(b){b.classList.toggle("tab-active",b.getAttribute("data-tab-btn")===n)})}
document.addEventListener("DOMContentLoaded",function(){showPage("dashboard");document.querySelectorAll("form[data-form]").forEach(function(f){f.addEventListener("submit",function(e){e.preventDefault();showToast("Saved successfully!");var r=f.getAttribute("data-return")||"list";setTimeout(function(){showPage(r)},800)})})});
</script>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", fallbackScript + "\n</body>");
  }
  if (html.includes("</html>")) {
    return html.replace("</html>", fallbackScript + "\n</html>");
  }
  return html + fallbackScript;
}

async function callClaude(prompt: string, systemPrompt?: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16384,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from prototype generation");
  }

  return stripCodeFences(content.text);
}

export async function generatePrototypeHtml(
  prototypeType: string,
  ideaSummary: string,
  primaryFeatures: string[],
  platform: string,
  productType: string,
  company: string | null
): Promise<string> {
  const isClickable = prototypeType === "clickable_web";
  const prompt = isClickable
    ? PROTOTYPE_CLICKABLE_WEB_PROMPT(ideaSummary, primaryFeatures, platform, company)
    : PROTOTYPE_TECHNICAL_SUMMARY_PROMPT(ideaSummary, primaryFeatures, platform, productType);

  const html = await callClaude(prompt, isClickable ? PROTOTYPE_SYSTEM_PROMPT : undefined);
  return isClickable ? ensureNavigation(html) : html;
}

export async function generateBothPrototypes(
  ideaSummary: string,
  primaryFeatures: string[],
  platform: string,
  productType: string,
  company: string | null
): Promise<{ prototypeHtml: string; technicalSummaryHtml: string }> {
  const [rawPrototype, technicalSummaryHtml] = await Promise.all([
    callClaude(
      PROTOTYPE_CLICKABLE_WEB_PROMPT(ideaSummary, primaryFeatures, platform, company),
      PROTOTYPE_SYSTEM_PROMPT,
    ),
    callClaude(PROTOTYPE_TECHNICAL_SUMMARY_PROMPT(ideaSummary, primaryFeatures, platform, productType)),
  ]);

  return { prototypeHtml: ensureNavigation(rawPrototype), technicalSummaryHtml };
}
