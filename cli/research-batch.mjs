#!/usr/bin/env node
/**
 * research-batch [--queue] [--force] [app ...]
 *
 * Researches many apps at once: the names given, and with --queue every
 * catalog app that has no guide yet. The server runs them a few at a time
 * (RESEARCH_CONCURRENCY) and skips apps that already have a guide, or were
 * found to have no OAuth, unless --force is set. Prints each result as it finishes, then a summary.
 *
 * OAUTH_GUIDE_URL sets the server (default http://localhost:3000).
 */
const base = (process.env.OAUTH_GUIDE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const args = process.argv.slice(2);
const force = args.includes("--force");
const apps = args.filter((a) => !a.startsWith("--"));

if (args.includes("--queue")) {
  const { guides, catalog } = await fetch(`${base}/api/guides`).then((r) => r.json());
  const have = new Set(guides.map((g) => g.slug));
  apps.push(...catalog.filter((c) => !have.has(c.slug)).map((c) => c.name));
}
if (!apps.length) {
  console.error("Usage: research-batch [--queue] [--force] [app ...]");
  process.exit(1);
}

const jobs = new Map();
for (const app of new Set(apps)) {
  const res = await fetch(`${base}/api/research`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: app, force }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.kind === "job") jobs.set(body.jobId, app);
  else if (body.kind === "existing") console.log(`${app.padEnd(24)} has a guide (${body.slug})`);
  else if (body.kind === "no-oauth") console.log(`${app.padEnd(24)} no OAuth (checked ${body.checkedAt})`);
  else console.log(`${app.padEnd(24)} not started: ${body.error ?? res.status}`);
}
console.error(`${jobs.size} research jobs started\n`);

const results = { done: 0, "no-oauth": 0, failed: 0 };
const started = Date.now();
while (jobs.size) {
  await new Promise((r) => setTimeout(r, 10_000));
  for (const [id, app] of jobs) {
    const job = await fetch(`${base}/api/research/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!job || job.status === "queued" || job.status === "running") continue;
    jobs.delete(id);
    results[job.status] = (results[job.status] ?? 0) + 1;
    const mins = ((Date.now() - started) / 60_000).toFixed(1);
    console.log(`${app.padEnd(24)} ${job.status === "done" ? `done → ${base}/apps/${job.slug}` : `${job.status}: ${job.message ?? ""}`}  (${mins} min, ${jobs.size} left)`);
  }
}
console.log(`\n${results.done} guides, ${results["no-oauth"]} without OAuth, ${results.failed} failed`);
