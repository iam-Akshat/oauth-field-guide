import { formatDuration, QUALITY, REGISTRATION, TIERS } from "@/lib/meta";
import { origin } from "@/lib/origin";
import { listCatalog, listGuides, listNoOAuth } from "@/lib/repo";

/** Index for agents, following the llms.txt convention (llmstxt.org). */
export async function GET() {
  const [base, guides, none, queued] = await Promise.all([origin(), listGuides(), listNoOAuth(), listCatalog()]);
  const lines = [
    "# OAuth Field Guide",
    "",
    "> How to register a provider's OAuth app and get it approved so your users can connect their accounts: difficulty, hands-on work vs approval wait, whether each customer registers the app, the OAuth grants it supports, steps tagged agent/human/provider, and sources.",
    "",
    "## Use from an agent",
    "",
    `- [MCP server](${base}/api/mcp): Streamable HTTP. Tools: list_guides, get_guide, research_app, research_status, report_problem, report_setup`,
    `- Guide as Markdown: ${base}/apps/{slug}.md`,
    `- Agent instructions: ${base}/api/guides/{slug}?format=prompt`,
    `- Research a new app: POST ${base}/api/research with {"query": "calendly.com"}`,
    `- Report a wrong guide: POST ${base}/api/reports with {"app": "slack", "step": 2, "message": "what you saw"} (step is optional)`,
    `- Say how a setup went: POST ${base}/api/reports with {"app": "slack", "outcome": "worked" | "waiting" | "stuck", "step": 3, "message": "what happened"}`,
    "",
    "## Guides",
    "",
    ...(guides.length
      ? guides.map(
          (g) =>
            `- [${g.name}](${base}/apps/${g.slug}.md): ${TIERS[g.tier].label}${g.registration?.model === "per-tenant" ? `, ${REGISTRATION["per-tenant"].label.toLowerCase()}` : ""}${g.quality === "verified" ? `, ${QUALITY.verified.label.toLowerCase()}` : ""}. Work ${formatDuration(g.totals.effort).toLowerCase()}, wait ${formatDuration(g.totals.wait).toLowerCase()}.`,
        )
      : ["None yet. Research one with the MCP tool research_app."]),
    "",
    ...(none.length
      ? ["## No OAuth (researched, no guide)", "", ...none.map((a) => `- [${a.name}](${base}/apps/${a.slug}.md)${a.alternative ? `: try ${a.alternative}` : ""}`), ""]
      : []),
    "## Queued (no guide yet)",
    "",
    queued.map((c) => c.name).join(", "),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
