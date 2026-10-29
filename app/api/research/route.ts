import { matchApp } from "@/lib/repo";
import { canonicalQuery } from "@/lib/research/canonical";
import { createJob, ResearchLimitError, startJob } from "@/lib/research/jobs";
import { resolveQuery } from "@/lib/research/resolve";
import type { StartResearchResponse } from "@/lib/types";

/**
 * Start research for an app name or website. Returns the existing guide's slug,
 * or the saved answer when research already found no OAuth, unless `force` is
 * set. Typos and nicknames are matched to known apps (`corrected` says so)
 * unless `exact` is set.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { query?: unknown; force?: unknown; exact?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (!query) {
    return Response.json({ error: "Enter an app name or website." }, { status: 400 });
  }
  if (query.length > 120) {
    return Response.json({ error: "That’s too long. Enter just an app name or a website." }, { status: 400 });
  }

  // Near misses ("calandly", "calendly.com", "gcal") go to the app they mean, unless `exact` asks for the query as written.
  const exact = body?.exact === true;
  const target = exact ? query : await canonicalQuery(query);
  const hit = matchApp(target, { exact });
  // Typos and nicknames get a "Did you mean"; tidy-ups like "calendly.com" or "Calendly API" don't.
  const corrected = !exact && (target !== query || (hit ? hit.near : resolveQuery(query).match === "near"));

  if (hit?.guide && body?.force !== true) {
    return Response.json({ kind: "existing", slug: hit.guide.slug, ...(corrected ? { corrected } : {}) } satisfies StartResearchResponse);
  }
  if (hit?.answer && body?.force !== true) {
    return Response.json({ kind: "no-oauth", ...hit.answer, ...(corrected ? { corrected } : {}) } satisfies StartResearchResponse);
  }

  try {
    const job = createJob(query, { target, exact, corrected });
    // Start now, so API callers that poll GET /api/research/:id don't wait on a viewer.
    startJob(job.id);
    return Response.json({ kind: "job", jobId: job.id } satisfies StartResearchResponse, { status: 201 });
  } catch (err) {
    if (err instanceof ResearchLimitError) return Response.json({ error: err.message }, { status: 429 });
    throw err;
  }
}
