import { OUTCOME_ORDER, reportParts } from "./meta";
import { addReport, matchApp, reportsToday } from "./repo";
import type { Guide, Report, ReportOutcome } from "./types";

/** Reports accepted per UTC day across all apps, a backstop on spam. */
const DAILY_LIMIT = Number(process.env.REPORTS_DAILY_LIMIT ?? 300) || 300;

type Submitted = { ok: true; report: Report; name: string } | { ok: false; status: 400 | 404 | 429; error: string };

export type ReportInput = { outcome?: string; message: string; part?: string; step?: number; via: Report["via"] };

const ASK: Record<ReportOutcome, string> = {
  worked: "",
  waiting: "",
  stuck: "Say where you got stuck and what you saw, in a sentence or two.",
  wrong: "Say what's wrong, in a sentence or two.",
};

/**
 * Files feedback on a guide or no-OAuth answer: that it's wrong, that
 * following it got stuck, or that it worked. Shared by the API, the MCP tools
 * and the CLI (through the API), so they validate the same way.
 */
export function submitReport(app: string, input: ReportInput): Submitted {
  const outcome = (input.outcome || "wrong") as ReportOutcome;
  if (!OUTCOME_ORDER.includes(outcome)) return { ok: false, status: 400, error: `outcome is one of ${OUTCOME_ORDER.join(", ")}.` };
  const message = input.message.trim();
  if (!app.trim()) return { ok: false, status: 400, error: "Say which app: its name, slug or website." };
  if (ASK[outcome] && message.length < 5) return { ok: false, status: 400, error: ASK[outcome] };
  if (message.length > 1000) return { ok: false, status: 400, error: "Keep the report under 1,000 characters." };

  const hit = matchApp(app);
  if (!hit) return { ok: false, status: 404, error: `There's no guide or saved answer for “${app}” to report on.` };
  const record = hit.guide ?? hit.answer;
  // Don't file on a guess: say what it matched and let the caller confirm.
  if (hit.near) return { ok: false, status: 404, error: `No exact match for “${app}”. Did you mean ${record.name}? Report on “${record.slug}”.` };
  if (!hit.guide && outcome !== "wrong") {
    return { ok: false, status: 400, error: `${record.name} has no guide to follow. If it does offer OAuth after all, report that it's wrong.` };
  }
  const part = hit.guide ? partOf(hit.guide, input) : { part: input.part?.trim().slice(0, 120) };
  if ("error" in part) return { ok: false, status: 400, error: part.error };
  if (reportsToday() >= DAILY_LIMIT) return { ok: false, status: 429, error: "Too many reports today. Try again tomorrow." };

  const report = addReport({ slug: record.slug, outcome, message, ...(part.part ? { part: part.part } : {}), via: input.via });
  return { ok: true, report, name: record.name };
}

/**
 * The guide's own label for the part, so "step 3" and "Step 3: Create the app"
 * file the same way. Text that names no known part is kept as written.
 */
function partOf(g: Guide, { part, step }: ReportInput): { part?: string } | { error: string } {
  const parts = reportParts(g);
  if (step !== undefined && !Number.isInteger(step)) return { error: "step is the step's number, e.g. 3." };
  const n = step ?? Number(part?.match(/^\s*step\s*(\d+)/i)?.[1] ?? NaN);
  if (!Number.isNaN(n)) {
    const label = parts.find((p) => p.label.startsWith(`Step ${n}:`))?.label;
    return label ? { part: label } : { error: `There's no step ${n}: the ${g.name} guide has ${g.steps.length} steps.` };
  }
  const text = part?.trim();
  if (!text) return {};
  return { part: parts.find((p) => p.label.toLowerCase() === text.toLowerCase())?.label ?? text.slice(0, 120) };
}
