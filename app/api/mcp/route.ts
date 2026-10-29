import { agentBrief, guideToMarkdown } from "@/lib/markdown";
import { formatDate, formatDuration, QUALITY, REGISTRATION, TIERS, tallyText } from "@/lib/meta";
import { origin } from "@/lib/origin";
import { submitReport } from "@/lib/report";
import { getGuide, getNoOAuth, listCatalog, listGuides, listNoOAuth, matchApp, reportsSince } from "@/lib/repo";
import { canonicalQuery } from "@/lib/research/canonical";
import { createJob, getJob, ResearchLimitError, startJob } from "@/lib/research/jobs";

/**
 * MCP server over Streamable HTTP, stateless, answering with plain JSON.
 *   claude mcp add --transport http oauth-guide <origin>/api/mcp
 */

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
type NoOAuth = NonNullable<Awaited<ReturnType<typeof getNoOAuth>>>;

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: "text", text: t }], ...(isError && { isError }) });

const APP = { type: "string", description: "App name, slug or website, e.g. \"gmail\" or \"slack.com\"" };

/** A saved no-OAuth answer, with what to do next. */
const noOAuthText = (a: NoOAuth, base: string) =>
  [
    `${a.name} has no OAuth for third-party apps (checked ${formatDate(a.checkedAt)}). ${a.reason}`,
    ...(a.alternative ? [`To research the alternative, call research_app with app ${JSON.stringify(a.alternative)}.`] : []),
    `Details: ${base}/apps/${a.slug}. If this is wrong, call report_problem; research_app with force: true researches it again.`,
  ].join("\n");

const feedback = (slug: string) => {
  const t = tallyText(reportsSince(slug));
  return t ? `; reports: ${t}` : "";
};

const TOOLS = [
  {
    name: "list_guides",
    description: "List saved OAuth app guides with difficulty, hands-on work, approval wait, whether each customer must register your app themselves, and whether a setup attempt tested the guide.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_guide",
    description:
      "How to register an app's OAuth app and get it approved for public users: steps, the OAuth grants it supports, and who registers it. Use format \"prompt\" for steps you can act on; it marks where to stop for a human.",
    inputSchema: {
      type: "object",
      properties: { app: APP, format: { type: "string", enum: ["markdown", "prompt"], default: "markdown" } },
      required: ["app"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "research_app",
    description:
      "Research an app that has no guide yet. Takes one to three minutes; poll research_status with the job_id. Typos and nicknames are matched to known apps unless exact is true. Apps already researched return the saved result.",
    inputSchema: {
      type: "object",
      properties: {
        app: APP,
        exact: { type: "boolean", description: "Research the name exactly as written, with no matching." },
        force: { type: "boolean", description: "Research again even though a result is saved. Only when it looks wrong or out of date: each run costs money." },
      },
      required: ["app"],
    },
  },
  {
    name: "research_status",
    description: "Check a research job. Returns the guide when it's finished.",
    inputSchema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "report_problem",
    description:
      "Report that a guide, or an answer that an app has no OAuth, is wrong or out of date: a page, field, requirement or wait that differs from what you see. Reports show on the guide and the next research run checks them. Never include secrets or personal data.",
    inputSchema: {
      type: "object",
      properties: {
        app: APP,
        message: { type: "string", description: "What's wrong and what you saw instead, in one to three sentences." },
        step: { type: "integer", description: "The step number it's about, if it's one step." },
        part: { type: "string", description: "Or another part: \"Tier\", \"Requirements\" or \"Sources\"." },
      },
      required: ["app", "message"],
    },
  },
  {
    name: "report_setup",
    description:
      "When setup from a guide ends, or you can't get past a step, say how it went: worked (users can connect), waiting (your part is done and the provider is reviewing), or stuck (with the step). Handing a step to a human isn't stuck. It shows on the guide; stuck reports are checked by the next research run. Never include secrets or personal data.",
    inputSchema: {
      type: "object",
      properties: {
        app: APP,
        outcome: { type: "string", enum: ["worked", "waiting", "stuck"] },
        step: { type: "integer", description: "The step number you got stuck on." },
        message: { type: "string", description: "What happened, in one to three sentences. Required when stuck." },
      },
      required: ["app", "outcome"],
    },
  },
];


async function callTool(name: string, args: Record<string, unknown>, base: string): Promise<ToolResult | null> {
  const app = typeof args.app === "string" ? args.app.trim() : "";
  switch (name) {
    case "list_guides": {
      const [guides, none, queued] = await Promise.all([listGuides(), listNoOAuth(), listCatalog()]);
      if (!guides.length && !none.length) return text(`No guides yet. ${queued.length} apps are queued. Call research_app to create one.`);
      return text(
        [
          ...guides.map(
            (g) =>
              `- ${g.name} (${g.slug}): ${TIERS[g.tier].label}${g.registration?.model === "per-tenant" ? `, ${REGISTRATION["per-tenant"].label.toLowerCase()}` : ""}${g.quality === "verified" ? `, ${QUALITY.verified.label.toLowerCase()}` : ""}, work ${formatDuration(g.totals.effort).toLowerCase()}, wait ${formatDuration(g.totals.wait).toLowerCase()}, updated ${g.updatedAt}${feedback(g.slug)}`,
          ),
          ...none.map((a) => `- ${a.name} (${a.slug}): no OAuth for third-party apps${a.alternative ? `; try ${a.alternative}` : ""}`),
        ].join("\n"),
      );
    }
    case "get_guide": {
      if (!app) return text("Pass an app name, slug or website.", true);
      const hit = matchApp(app);
      if (hit?.answer) return text(noOAuthText(hit.answer, base));
      if (!hit?.guide) return text(`No guide for “${app}” yet. Call research_app to create one.`);
      const url = `${base}/apps/${hit.guide.slug}`;
      const reports = reportsSince(hit.guide.slug);
      return text(args.format === "prompt" ? agentBrief(hit.guide, url, reports) : guideToMarkdown(hit.guide, url, reports));
    }
    case "research_app": {
      if (!app || app.length > 120) return text("Pass an app name or website (120 characters at most).", true);
      const exact = args.exact === true;
      const target = exact ? app : await canonicalQuery(app);
      const hit = args.force === true ? null : matchApp(target, { exact });
      const existing = hit?.guide ?? hit?.answer;
      const matched =
        existing && existing.name.toLowerCase() !== app.toLowerCase() ? ` “${app}” matched ${existing.name}; pass exact: true to research “${app}” itself.` : "";
      if (hit?.answer) return text(noOAuthText(hit.answer, base) + matched);
      if (hit?.guide) {
        return text(`A guide already exists: ${base}/apps/${hit.guide.slug}. Call get_guide with app "${hit.guide.slug}".${matched}`);
      }
      let job;
      try {
        job = createJob(app, { target, exact, corrected: !exact && target !== app });
      } catch (err) {
        if (err instanceof ResearchLimitError) return text(err.message, true);
        throw err;
      }
      startJob(job.id);
      return text(
        `Research started for ${job.name}.\njob_id: ${job.id}\nWatch live: ${base}/research/${job.id}\nCall research_status with this job_id in about a minute.`,
      );
    }
    case "research_status": {
      const id = String(args.job_id ?? "");
      const job = getJob(id);
      if (!job) return text(`No research job “${id}”.`, true);
      if (job.status === "done" && job.slug) {
        const g = await getGuide(job.slug);
        if (g) return text(guideToMarkdown(g, `${base}/apps/${g.slug}`));
      }
      if (job.status === "no-oauth") {
        const answer = job.slug ? await getNoOAuth(job.slug) : null;
        return text(answer ? noOAuthText(answer, base) : `No OAuth found for ${job.name}. ${job.message ?? ""}`.trim());
      }
      if (job.status === "failed") return text(`Research failed. ${job.message ?? ""}`.trim(), true);
      return text(`Still ${job.status}. Watch: ${base}/research/${id}. Check again in 30 seconds.`);
    }
    case "report_problem":
    case "report_setup": {
      if (name === "report_setup" && typeof args.outcome !== "string") return text("Pass outcome: worked, waiting or stuck.", true);
      const result = submitReport(app, {
        outcome: name === "report_problem" ? "wrong" : typeof args.outcome === "string" ? args.outcome : "",
        message: typeof args.message === "string" ? args.message : "",
        part: typeof args.part === "string" ? args.part : undefined,
        step: typeof args.step === "number" ? args.step : undefined,
        via: "mcp",
      });
      if (!result.ok) return text(result.error, true);
      const checked = result.report.outcome === "wrong" || result.report.outcome === "stuck" ? ", and the next research run checks it" : "";
      return text(`Thanks. Filed on ${result.name}. It shows at ${base}/apps/${result.report.slug}#feedback${checked}.`);
    }
    default:
      return null;
  }
}

async function handle(msg: Rpc, base: string) {
  if (msg.id === undefined || msg.id === null) return null; // notification: no reply
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });

  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok({
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "oauth-field-guide", version: "0.1.0" },
        instructions:
          "Guides for registering a provider's OAuth app (Google, Slack, …) and getting it approved so your users can connect their accounts. Call get_guide before setting up an integration's OAuth app. If a guide turns out wrong while you follow it, call report_problem. When setup ends or you can't get past a step, call report_setup with how it went.",
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await callTool(name, args, base);
      return result ? ok(result) : fail(-32602, `Unknown tool: ${name}`);
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => undefined)) as Rpc | Rpc[] | undefined;
  if (!body || typeof body !== "object") {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const base = await origin();
  const replies = (await Promise.all((Array.isArray(body) ? body : [body]).map((m) => handle(m, base)))).filter(Boolean);
  if (!replies.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0]);
}

export function GET() {
  return new Response("This MCP server answers POST requests only.", { status: 405, headers: { Allow: "POST" } });
}
