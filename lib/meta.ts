import type {
  Actor,
  Confidence,
  Duration,
  EvidenceKind,
  GuideQuality,
  Guide,
  PhaseId,
  Registration,
  Report,
  ReportOutcome,
  SectionId,
  StageId,
  Tier,
} from "./types";

export const TIERS: Record<Tier, { label: string; level: 0 | 1 | 2 | 3 | 4; blurb: string }> = {
  "self-serve": {
    label: "Self-serve",
    level: 1,
    blurb: "Create the app, get keys, go live. No provider review stands between you and your users.",
  },
  capped: {
    label: "Capped",
    level: 2,
    blurb: "Works today, but with a user, connection or rate cap until you apply for more.",
  },
  reviewed: {
    label: "Reviewed",
    level: 3,
    blurb: "Someone at the provider reviews your app before the public can connect.",
  },
  gated: {
    label: "Gated",
    level: 4,
    blurb: "Needs a paid security audit, business eligibility, a partnership or a paid API tier.",
  },
  unknown: {
    label: "Unconfirmed",
    level: 0,
    blurb: "Research couldn’t establish the path. Plan as if it’s Reviewed until you confirm.",
  },
};

export const REGISTRATION: Record<Registration, { label: string; blurb: string }> = {
  global: { label: "One app for every customer", blurb: "You register once and every customer connects to that app." },
  "per-tenant": {
    label: "Per-customer setup",
    blurb: "Each customer’s admin registers your app in their own tenant and sends you its credentials.",
  },
};

export const TIER_ORDER: Tier[] = ["self-serve", "capped", "reviewed", "gated"];

export const ACTORS: Record<Actor, { label: string; blurb: string }> = {
  agent: { label: "Agent", blurb: "An agent can do this once you’re signed in." },
  you: { label: "You", blurb: "Needs a person: sign-in, legal, payment or judgement." },
  provider: { label: "Provider", blurb: "Out of your hands. You’re waiting on the provider." },
};

export const EVIDENCE: Record<EvidenceKind, { label: string; blurb: string }> = {
  tested: { label: "Tested", blurb: "Observed during a setup attempt." },
  docs: { label: "Docs", blurb: "Stated in the provider’s official documentation, on a page the agent read." },
  community: { label: "Community", blurb: "Reported by developers; not confirmed by the provider." },
  inferred: { label: "Inferred", blurb: "Reasoned from related facts. Treat as a hypothesis." },
};

export const CONFIDENCE: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export const QUALITY: Record<GuideQuality, { label: string; blurb: string }> = {
  verified: { label: "Tested", blurb: "The agent attempted setup. What happened is in the attempt log." },
  researched: { label: "Sourced", blurb: "Claims cite provider docs. Setup wasn’t attempted." },
  generated: { label: "Partial", blurb: "Research found little. Most claims are inferred." },
};

export const OUTCOMES: Record<ReportOutcome, { label: string; tally: string }> = {
  worked: { label: "It worked", tally: "worked" },
  waiting: { label: "Done, waiting on review", tally: "waiting on review" },
  stuck: { label: "Got stuck", tally: "stuck" },
  wrong: { label: "Something’s wrong", tally: "wrong" },
};

export const OUTCOME_ORDER: ReportOutcome[] = ["worked", "waiting", "stuck", "wrong"];

export const outcomeOf = (r: Report): ReportOutcome => r.outcome ?? "wrong";

/** Stuck and wrong reports need checking; the others confirm the guide. */
export const isIssue = (r: Report) => outcomeOf(r) === "stuck" || outcomeOf(r) === "wrong";

/** Reports per outcome, skipping outcomes with none. */
export const tally = (reports: Report[]) =>
  OUTCOME_ORDER.map((o) => ({ outcome: o, count: reports.filter((r) => outcomeOf(r) === o).length })).filter((t) => t.count > 0);

/** E.g. "worked 3×, stuck 1×". */
export const tallyText = (reports: Report[]) => tally(reports).map((t) => `${OUTCOMES[t.outcome].tally} ${t.count}×`).join(", ");

/** What a report can be about. Steps link to #report-s-<id> to pick theirs. */
export const reportParts = (g: Guide) => [
  { id: "tier", label: "Tier and summary" },
  { id: "requirements", label: "Requirements" },
  ...g.steps.map((s, i) => ({ id: `s-${s.id}`, label: `Step ${i + 1}: ${s.title}` })),
  { id: "sources", label: "Sources" },
];

export const STAGES: Record<StageId, string> = {
  build: "Build",
  beta: "Beta",
  launch: "Launch",
};

export const PHASES: { id: PhaseId; label: string }[] = [
  { id: "identify", label: "Identify the app" },
  { id: "portal", label: "Find the developer portal" },
  { id: "review", label: "Research review and verification" },
  { id: "limits", label: "Research caps, scopes and pricing" },
  { id: "community", label: "Read developer reports" },
  { id: "draft", label: "Draft the guide" },
  { id: "verify", label: "Check claims against sources" },
];

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "verdict", label: "Verdict" },
  { id: "stages", label: "Path to launch" },
  { id: "requirements", label: "Before you start" },
  { id: "steps", label: "Steps" },
  { id: "blockers", label: "When you get stuck" },
  { id: "unknowns", label: "Not confirmed yet" },
  { id: "sources", label: "Sources" },
];

const UNIT: Record<NonNullable<Duration>["unit"], [string, string]> = {
  minutes: ["min", "min"],
  hours: ["h", "h"],
  days: ["day", "days"],
  weeks: ["week", "weeks"],
};

/** "20–40 min", "None", "Unknown" */
export function formatDuration(d: Duration): string {
  if (!d) return "Unknown";
  if (d.max === 0) return "None";
  const [one, many] = UNIT[d.unit];
  if (d.min === d.max) return `${d.min} ${d.min === 1 ? one : many}`;
  return `${d.min}–${d.max} ${many}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic, locale-free: "24 Oct 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Guides older than this are flagged: provider policies change, often more than once a year. */
export const STALE_AFTER_DAYS = 90;

/** Whole days since a date or timestamp, counted in UTC. Server-side: it reads the clock. */
export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 86_400_000));
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago" */
export function formatAge(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** "28 Oct 2026, 05:44 UTC" from an ISO timestamp. Locale-free, so server and browser agree. */
export const formatTime = (iso: string) => `${formatDate(iso)}, ${iso.slice(11, 16)} UTC`;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
