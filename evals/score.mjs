#!/usr/bin/env node
/**
 * node evals/score.mjs [--file guides.json] [--json]
 *
 * Scores saved guides against claims checked by hand against provider pages
 * (claims.jsonl) and known doc screenshots (screenshots.jsonl). A claim passes
 * when the guide mentions every `mention` pattern and none of the `forbid` ones
 * (stale or wrong statements). Run it after
 * changing the research prompt or model, on guides researched with the change.
 *
 * Guides come from the server's JSON API (OAUTH_GUIDE_URL, default
 * http://localhost:3000), or from a guides file with --file.
 */
import { readFileSync } from "node:fs";

const here = new URL(".", import.meta.url);
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const base = (process.env.OAUTH_GUIDE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const lines = (name) =>
  readFileSync(new URL(name, here), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

async function loadGuides() {
  const file = flag("--file");
  if (file) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return new Map((Array.isArray(data) ? data : Object.values(data)).map((g) => [g.slug, g]));
  }
  const { guides } = await fetch(`${base}/api/guides`).then((r) => r.json());
  const full = await Promise.all(guides.map((g) => fetch(`${base}/api/guides/${g.slug}`).then((r) => r.json())));
  return new Map(full.map((g) => [g.slug, g]));
}

const guides = await loadGuides();
const claims = lines("claims.jsonl");
const shots = lines("screenshots.jsonl");

/** The guide's own words, without source titles, which would match too easily. */
const textOf = (g) => JSON.stringify({ ...g, sources: undefined }).toLowerCase();

const results = [];
for (const app of [...new Set([...claims.map((c) => c.app), ...shots.map((s) => s.app)])]) {
  const g = guides.get(app);
  if (!g) {
    results.push({ app, missing: true });
    continue;
  }
  const text = textOf(g);
  const row = { app, tier: null, facts: [], images: { steps: 0, known: 0, expected: 0 } };
  for (const c of claims.filter((c) => c.app === app)) {
    if (c.kind === "tier") {
      row.tier = { expected: c.expect.tier, actual: g.tier, ok: g.tier === c.expect.tier };
    } else {
      const ok =
        (c.expect.mention ?? []).every((p) => new RegExp(p, "i").test(text)) &&
        !(c.expect.forbid ?? []).some((p) => new RegExp(p, "i").test(text));
      row.facts.push({ id: c.id, ok });
    }
  }
  const known = new Set(shots.filter((s) => s.app === app).map((s) => s.url));
  const used = g.steps.filter((s) => s.image).map((s) => s.image.url);
  row.images = { steps: used.length, known: used.filter((u) => known.has(u)).length, expected: known.size };
  results.push(row);
}

if (args.includes("--json")) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

const scored = results.filter((r) => !r.missing);
const tiers = scored.filter((r) => r.tier);
const facts = scored.flatMap((r) => r.facts);
console.log("app          tier                     facts   screenshots (steps · known/expected)");
for (const r of results) {
  if (r.missing) {
    console.log(`${r.app.padEnd(12)} no guide`);
    continue;
  }
  const tier = r.tier ? `${r.tier.ok ? "ok " : "BAD"} ${r.tier.actual}${r.tier.ok ? "" : ` (want ${r.tier.expected})`}` : "-";
  const hit = r.facts.filter((f) => f.ok).length;
  console.log(
    `${r.app.padEnd(12)} ${tier.padEnd(24)} ${`${hit}/${r.facts.length}`.padEnd(7)} ${r.images.steps} · ${r.images.known}/${r.images.expected}`,
  );
  for (const f of r.facts.filter((f) => !f.ok)) console.log(`${"".padEnd(13)}missed ${f.id}`);
}
console.log(
  `\nTier accuracy ${tiers.filter((r) => r.tier.ok).length}/${tiers.length} · ` +
    `fact recall ${facts.filter((f) => f.ok).length}/${facts.length} · ` +
    `guides with a screenshot ${scored.filter((r) => r.images.steps > 0).length}/${scored.length}`,
);
