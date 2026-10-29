import { origin } from "@/lib/origin";
import { submitReport } from "@/lib/report";
import type { Report } from "@/lib/types";

const VIA: Report["via"][] = ["web", "cli", "mcp"];

/**
 * Feedback on a guide or no-OAuth answer: outcome "wrong" (the default),
 * "stuck" (with the step), "worked", or "waiting" (setup done, waiting on the
 * provider's review). It shows on the guide; the next research run checks the
 * wrong and stuck ones.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const via = VIA.find((v) => v === body?.via) ?? "api";
  const step = body?.step === undefined || body.step === null || body.step === "" ? undefined : Number(body.step);
  const result = submitReport(str(body?.app), { outcome: str(body?.outcome), message: str(body?.message), part: str(body?.part), step, via });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  const url = `${await origin()}/apps/${result.report.slug}#feedback`;
  return Response.json({ id: result.report.id, slug: result.report.slug, outcome: result.report.outcome, part: result.report.part, url }, { status: 201 });
}
