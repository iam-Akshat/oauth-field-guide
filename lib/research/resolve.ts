import { ALIASES, CATALOG } from "../data/catalog";
import { appKey, closest, looksLikeUrl } from "../match";
import { slugify } from "../meta";
import type { CatalogEntry, ResearchEvent } from "../types";

/** A research event before the job runner stamps its time. */
export type EventBody = {
  [K in ResearchEvent["type"]]: Omit<Extract<ResearchEvent, { type: K }>, "at">;
}[ResearchEvent["type"]];

export interface ResolvedQuery {
  query: string;
  name: string;
  slug: string;
  domain: string | null;
  /** How it matched a catalog app: as written (allowing for case, filler words or a URL), as a near miss, or not at all */
  match: "exact" | "near" | null;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Names a catalog app answers to: its name, slug, site and aliases. */
const catalogKeys = (c: CatalogEntry) => [
  appKey(c.name.replace(/\(.*?\)/g, "")),
  c.slug.replace(/-/g, ""),
  appKey(c.domain),
  ...Object.entries(ALIASES)
    .filter(([, slug]) => slug === c.slug)
    .map(([alias]) => alias.replace(/-/g, "")),
];

const known = (q: string, c: CatalogEntry, near = false): ResolvedQuery => ({
  query: q,
  name: c.name,
  slug: c.slug,
  domain: c.domain,
  match: near ? "near" : "exact",
});

/**
 * Turn a free-text app name or website into a name, slug and (if known) domain.
 * Exact catalog matches win; then typos and filler words ("calandly", "calendly api"),
 * unless `exact` asks for the query to be taken as written.
 */
export function resolveQuery(query: string, { exact = false } = {}): ResolvedQuery {
  const q = query.trim();
  // A website that only shares a name with a known app (x.ai and X) is a guess, so it's always "near".
  const fuzzy = (url = false): ResolvedQuery | null => {
    const hit = exact ? null : closest(q, CATALOG, catalogKeys);
    return hit ? known(q, hit.item, url || hit.distance > 0) : null;
  };

  if (looksLikeUrl(q)) {
    const host = q
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
    const hit = CATALOG.find((c) => host === c.domain || host.endsWith(`.${c.domain}`));
    if (hit) return known(q, hit);
    const near = fuzzy(true);
    if (near) return near;
    const name = titleCase(appKey(q));
    return { query: q, name, slug: slugify(name), domain: host, match: null };
  }

  const slug = ALIASES[slugify(q)] ?? slugify(q);
  const hit = CATALOG.find((c) => c.name.toLowerCase() === q.toLowerCase() || c.slug === slug);
  if (hit) return known(q, hit);
  const near = fuzzy();
  if (near) return near;
  const name = q === q.toLowerCase() ? titleCase(q) : q;
  return { query: q, name, slug: slugify(name), domain: null, match: null };
}
