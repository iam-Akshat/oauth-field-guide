/**
 * SQLite data layer. There are no built-in guides: every guide comes from a
 * research run and is saved here, beside the runs that found no OAuth (so
 * nobody pays for them twice) and the reports people file. Each record is one
 * JSON row, and the server holds them all in memory too: there's one process.
 *
 * `data/guides.json` and `data/no-oauth.json` are the library researched while
 * building this, committed with the repo. They seed the database, and a record
 * there that's newer than the stored one replaces it at startup. Mock runs use
 * the git-ignored `.data/` and no seed. DATABASE_FILE moves the database (to a
 * Fly volume, say).
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { connection } from "next/server";
import { ALIASES, CATALOG } from "./data/catalog";
import { appKey, closest, looksLikeUrl } from "./match";
import { slugify } from "./meta";
import { AGENT_MODE } from "./research/mode";
import type { CatalogEntry, Guide, GuideSummary, NoOAuthAnswer, Report } from "./types";

// Runtime data, not source: the turbopackIgnore comments below keep it out of build tracing.
const DATA_DIR = path.join(process.cwd(), AGENT_MODE === "mock" ? ".data" : "data");
const DB_FILE = process.env.DATABASE_FILE ?? path.join(DATA_DIR, "oauth-guide.db");

type Table = "guides" | "no_oauth";
type Store = { db: DatabaseSync; guides: Map<string, Guide>; answers: Map<string, NoOAuthAnswer>; reports: Report[] };

const stamp = (r: Guide | NoOAuthAnswer) => r.researchedAt ?? ("updatedAt" in r ? r.updatedAt : r.checkedAt);
/** A setup attempt recorded in the seed is newer than the research it tested. */
const seedStamp = (r: Guide | NoOAuthAnswer) => {
  const attempt = "attempt" in r ? r.attempt?.date : undefined;
  return attempt && attempt > stamp(r) ? attempt : stamp(r);
};

function seed<T>(file: string): T[] {
  if (AGENT_MODE === "mock") return [];
  try {
    return JSON.parse(readFileSync(/*turbopackIgnore: true*/ path.join(DATA_DIR, file), "utf8")) as T[];
  } catch {
    return [];
  }
}

function put(db: DatabaseSync, table: Table, record: Guide | NoOAuthAnswer) {
  db.prepare(`INSERT OR REPLACE INTO ${table} (slug, data) VALUES (?, ?)`).run(record.slug, JSON.stringify(record));
}

function load<T extends Guide | NoOAuthAnswer>(db: DatabaseSync, table: Table, seedFile: string): Map<string, T> {
  const rows = db.prepare(`SELECT data FROM ${table}`).all() as { data: string }[];
  const records = new Map(rows.map((r) => JSON.parse(r.data) as T).map((r) => [r.slug, r]));
  for (const s of seed<T>(seedFile)) {
    const stored = records.get(s.slug);
    if (stored && seedStamp(stored) >= seedStamp(s)) continue;
    records.set(s.slug, s);
    put(db, table, s);
  }
  return records;
}

/** Opened on first use, not at import: `next build` imports this module too. */
function store(): Store {
  const g = globalThis as unknown as { __store?: Store };
  if (g.__store) return g.__store;
  mkdirSync(/*turbopackIgnore: true*/ path.dirname(DB_FILE), { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS guides (slug TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS no_oauth (slug TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, slug TEXT NOT NULL, at TEXT NOT NULL, data TEXT NOT NULL);
  `);
  const rows = db.prepare("SELECT data FROM reports ORDER BY at").all() as { data: string }[];
  return (g.__store = {
    db,
    guides: load<Guide>(db, "guides", "guides.json"),
    answers: load<NoOAuthAnswer>(db, "no_oauth", "no-oauth.json"),
    reports: rows.map((r) => JSON.parse(r.data) as Report),
  });
}

function summarize(g: Guide): GuideSummary {
  const { slug, name, domain, category, summary, tier, quality, updatedAt, totals, composio, registration } = g;
  return { slug, name, domain, category, summary, tier, quality, updatedAt, totals, composio, registration };
}

export async function listGuides(): Promise<GuideSummary[]> {
  await connection();
  return [...store().guides.values()].map(summarize);
}

export async function getGuide(slug: string): Promise<Guide | null> {
  await connection();
  return store().guides.get(slug) ?? null;
}

/** Catalog entries that don't have a guide or a no-OAuth answer yet. */
export async function listCatalog(): Promise<CatalogEntry[]> {
  await connection();
  const { guides, answers } = store();
  return CATALOG.filter((c) => !guides.has(c.slug) && !answers.has(c.slug));
}

export async function listNoOAuth(): Promise<NoOAuthAnswer[]> {
  await connection();
  return [...store().answers.values()];
}

export async function getNoOAuth(slug: string): Promise<NoOAuthAnswer | null> {
  await connection();
  return store().answers.get(slug) ?? null;
}

const sameApp = (a: { name: string }, b: { name: string }) => appKey(a.name) === appKey(b.name);

/**
 * Saves a guide and returns the slug it was saved under. When research turns
 * out to be about an app we already have (same site and name, as when someone
 * typed "calandly"), it replaces that guide instead of adding a duplicate.
 * A no-OAuth answer for the same app is dropped: research found OAuth after all.
 */
export function saveGuide(guide: Guide): string {
  const { db, guides, answers } = store();
  const twin = [...guides.values()].find((g) => g.slug !== guide.slug && g.domain && g.domain === guide.domain && sameApp(g, guide));
  let slug = twin?.slug ?? guide.slug;
  // Never overwrite a different company's guide that happens to share a slug (xAI's x.ai and X's "x").
  const taken = (s: string) => {
    const g = guides.get(s);
    return !!g && !!g.domain && !!guide.domain && g.domain !== guide.domain && !sameApp(g, guide);
  };
  if (!twin && taken(slug)) {
    slug = slugify(guide.domain!);
    for (let n = 2; taken(slug); n++) slug = `${slugify(guide.domain!)}-${n}`;
  }
  const saved = { ...guide, slug, researchedAt: new Date().toISOString() };
  guides.set(saved.slug, saved);
  put(db, "guides", saved);

  const stale = [...answers.values()].filter((a) => a.slug === saved.slug || a.slug === guide.slug || sameApp(a, saved));
  for (const a of stale) {
    answers.delete(a.slug);
    db.prepare("DELETE FROM no_oauth WHERE slug = ?").run(a.slug);
  }
  return saved.slug;
}

/**
 * Saves a no-OAuth answer and returns its slug. A saved guide for the same app
 * wins: one run finding no OAuth isn't enough to drop researched steps, so the
 * finding is filed as a report on the guide instead, and null is returned.
 */
export function saveNoOAuth(answer: NoOAuthAnswer): string | null {
  const { db, guides, answers } = store();
  const guide = guides.get(answer.slug) ?? [...guides.values()].find((g) => sameApp(g, answer));
  if (guide) {
    addReport({ slug: guide.slug, outcome: "wrong", message: `A later research run found no OAuth for third-party apps: ${answer.reason}`, via: "research" });
    return null;
  }
  const saved = { ...answer, researchedAt: new Date().toISOString() };
  answers.set(saved.slug, saved);
  put(db, "no_oauth", saved);
  return saved.slug;
}

/* ── Reports ───────────────────────────────────────────────────────────── */

export function addReport(input: Omit<Report, "id" | "at">): Report {
  const { db, reports } = store();
  const report: Report = { id: randomUUID().split("-")[0], ...input, at: new Date().toISOString() };
  db.prepare("INSERT INTO reports (id, slug, at, data) VALUES (?, ?, ?, ?)").run(report.id, report.slug, report.at, JSON.stringify(report));
  reports.push(report);
  return report;
}

/**
 * Reports filed since the guide or answer was last researched, newest first:
 * feedback on the version people see. Saving a new version starts a fresh list.
 */
export function reportsSince(slug: string): Report[] {
  const { guides, answers, reports } = store();
  const record = guides.get(slug) ?? answers.get(slug);
  if (!record) return [];
  const since = stamp(record);
  return reports.filter((r) => r.slug === slug && r.at > since).reverse();
}

/** Reports filed today, for the daily cap. */
export function reportsToday(): number {
  const today = new Date().toISOString().slice(0, 10);
  return store().reports.filter((r) => r.at.startsWith(today)).length;
}

/* ── Matching ──────────────────────────────────────────────────────────── */

type Named = { slug: string; name: string; domain: string | null };

const keysOf = (r: Named) => [appKey(r.name), r.slug.replace(/-/g, ""), r.domain ? appKey(r.domain) : ""];

function matchIn<T extends Named>(iterable: Iterable<T>, query: string, exact: boolean): { item: T; near: boolean } | null {
  const records = [...iterable];
  const q = query.trim().toLowerCase();
  const host = q.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const slug = ALIASES[slugify(q)] ?? slugify(q);
  for (const r of records) {
    if (r.slug === slug || r.name.toLowerCase() === q) return { item: r, near: false };
    if (r.domain && host.includes(".") && (host === r.domain || host.endsWith(`.${r.domain}`))) return { item: r, near: false };
  }
  const hit = exact ? null : closest(query, records, keysOf);
  // A website on another domain that only shares a name is a guess too.
  return hit ? { item: hit.item, near: hit.distance > 0 || looksLikeUrl(q) } : null;
}

/**
 * Match a free-text query (name, website or a near miss of either) to a saved
 * guide. `near` is true when it took a typo correction to get there. With
 * `exact`, near misses don't count.
 */
export function matchGuide(query: string, { exact = false } = {}): { guide: Guide; near: boolean } | null {
  const hit = matchIn(store().guides.values(), query, exact);
  return hit ? { guide: hit.item, near: hit.near } : null;
}

export function findExisting(query: string, options?: { exact?: boolean }): Guide | null {
  return matchGuide(query, options)?.guide ?? null;
}

export type AppMatch = { near: boolean } & ({ guide: Guide; answer?: never } | { answer: NoOAuthAnswer; guide?: never });

/** Like matchGuide, but also finds saved no-OAuth answers. An exact match of either beats a near miss. */
export function matchApp(query: string, { exact = false } = {}): AppMatch | null {
  const { guides, answers } = store();
  const guide = matchIn(guides.values(), query, exact);
  if (guide && !guide.near) return { guide: guide.item, near: false };
  const answer = matchIn(answers.values(), query, exact);
  if (answer && (!answer.near || !guide)) return { answer: answer.item, near: answer.near };
  return guide ? { guide: guide.item, near: true } : null;
}
