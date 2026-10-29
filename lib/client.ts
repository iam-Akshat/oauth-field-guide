import type { StartResearchResponse } from "./types";

/**
 * Start research, or get the slug of a guide that already covers the query.
 * `force` re-researches an existing guide; `exact` skips typo and nickname matching.
 */
export async function startResearch(query: string, { force = false, exact = false } = {}): Promise<StartResearchResponse> {
  const res = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, force, exact }),
  });
  const body = (await res.json().catch(() => null)) as (StartResearchResponse & { error?: string }) | null;
  if (!res.ok || !body) {
    throw new Error(body?.error ?? `The research service didn’t respond (HTTP ${res.status}). Try again.`);
  }
  return body;
}

/** Where to send the person after startResearch resolves. A corrected match carries the query, for "Did you mean". */
export function researchHref(r: StartResearchResponse, query: string): string {
  if (r.kind === "job") return `/research/${r.jobId}`;
  return r.corrected ? `/apps/${r.slug}?q=${encodeURIComponent(query)}` : `/apps/${r.slug}`;
}
