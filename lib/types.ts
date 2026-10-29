/**
 * Guide schema. The research agent fills this shape; the UI renders only this
 * shape. Every claim that could be wrong carries Evidence pointing at Sources.
 */

/** How hard it is to get from "registered" to "anyone can connect". */
export type Tier = "self-serve" | "capped" | "reviewed" | "gated" | "unknown";

/** Who performs a step. */
export type Actor = "agent" | "you" | "provider";

export type EvidenceKind = "tested" | "docs" | "community" | "inferred";
export type Confidence = "high" | "medium" | "low";

export type StageId = "build" | "beta" | "launch";

/** One registration serves every customer, or each customer's admin registers the app in their own tenant. */
export type Registration = "global" | "per-tenant";

/**
 * verified   – a setup attempt was run and a person reviewed the guide
 * researched – produced by the batch research agent, not attempted
 * generated  – produced live from a user's request, not reviewed
 */
export type GuideQuality = "verified" | "researched" | "generated";

/** Whether Composio provides the OAuth app for this toolkit. */
export type ComposioStatus = "managed" | "byo" | "unknown";

export type TimeUnit = "minutes" | "hours" | "days" | "weeks";

/** A time range. `null` means research could not establish it. */
export type Duration = { min: number; max: number; unit: TimeUnit } | null;

export interface Evidence {
  kind: EvidenceKind;
  /** Source ids from Guide.sources */
  sources: string[];
  confidence: Confidence;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: "official" | "composio" | "community" | "search" | "attempt";
  /** ISO date this source was last re-read to confirm the claims citing it. */
  checkedAt: string | null;
}

export interface Stage {
  id: StageId;
  name: string;
  whoCanConnect: string;
  userSees: string;
  /** Your hands-on work to complete this stage */
  effort: Duration;
  /** Calendar time spent waiting on the provider */
  wait: Duration;
  /** What moves you to the next stage, if anything */
  unlock: string | null;
  evidence: Evidence;
}

export interface Requirement {
  id: string;
  label: string;
  detail: string;
  stage: StageId;
  actor: Actor;
  evidence: Evidence;
}

export interface Step {
  id: string;
  title: string;
  actor: Actor;
  stage: StageId;
  /** Hands-on time, or waiting time when actor is "provider" */
  time: Duration;
  detail: string;
  actions?: string[];
  /** What an agent can do here, and where it hands back */
  agentNote?: string;
  gotcha?: string;
  link?: { label: string; url: string };
  /** A screenshot from the provider's docs, shown where it is (not copied) */
  image?: StepImage;
  evidence: Evidence;
}

export interface StepImage {
  url: string;
  alt: string;
  /** Id of the source page the image appears on */
  source: string;
}

export interface ScopeTier {
  scope: string;
  grants: string;
  level: "basic" | "sensitive" | "restricted";
  consequence: string;
}

/** An OAuth grant the provider supports, and the integration it fits. */
export interface Grant {
  name: string;
  fits: string;
  evidence: Evidence;
}

export interface Blocker {
  symptom: string;
  cause: string;
  fix: string;
  evidence: Evidence;
}

export interface Unknown {
  question: string;
  why: string;
  resolve: string;
}

export interface SetupAttempt {
  date: string;
  by: string;
  outcome: "completed" | "partial" | "blocked";
  summary: string;
  log: { step: string; result: "ok" | "handoff" | "blocked" | "corrected"; note: string }[];
}

export interface Guide {
  slug: string;
  name: string;
  domain: string | null;
  category: string;
  summary: string;
  tier: Tier;
  tierReason: string;
  quality: GuideQuality;
  updatedAt: string;
  composio: { status: ComposioStatus; toolkit?: string; note: string };
  /** Missing on guides researched before it was asked */
  registration?: { model: Registration; note: string; evidence: Evidence };
  grants?: Grant[];
  totals: { effort: Duration; wait: Duration; firstConnection: string };
  stages: Stage[];
  requirements: Requirement[];
  steps: Step[];
  scopes?: { intro: string; tiers: ScopeTier[] };
  blockers: Blocker[];
  unknowns: Unknown[];
  attempt?: SetupAttempt;
  handoff: { agentCan: string[]; youMust: string[] };
  sources: Source[];
  /** When research last saved it; reports filed before this were seen by that run */
  researchedAt?: string;
}

export type GuideSummary = Pick<
  Guide,
  "slug" | "name" | "domain" | "category" | "summary" | "tier" | "quality" | "updatedAt" | "totals" | "composio" | "registration"
>;

/**
 * What research saves when an app has no OAuth flow for third-party apps, so
 * nobody pays to research it again.
 */
export interface NoOAuthAnswer {
  slug: string;
  name: string;
  domain: string | null;
  /** What research found and how users would connect instead */
  reason: string;
  /** A related API that does use OAuth, to research instead (e.g. the replacement for a shut-down API) */
  alternative?: string;
  sources: { title: string; url: string }[];
  checkedAt: string;
  researchedAt?: string;
}

/**
 * How following a guide went. "wrong" and "stuck" are open issues the next
 * research run checks; "worked" and "waiting" (setup done, waiting on the
 * provider's review) confirm the guide.
 */
export type ReportOutcome = "worked" | "waiting" | "stuck" | "wrong";

/** Feedback from someone, or an agent, following a guide. */
export interface Report {
  id: string;
  /** The guide or no-OAuth answer it's about */
  slug: string;
  /** Missing on reports filed before outcomes existed: those said it was wrong */
  outcome?: ReportOutcome;
  /** Can be empty when it worked */
  message: string;
  /** Which part, e.g. "Step 3: Create the app" */
  part?: string;
  /** Where it came from; "research" is a later run that disagreed */
  via: "web" | "mcp" | "cli" | "api" | "research";
  at: string;
}

/** An app we know supports OAuth but haven't researched yet. */
export interface CatalogEntry {
  slug: string;
  name: string;
  domain: string;
  composio: ComposioStatus;
}

/* ── Live research ─────────────────────────────────────────────────────── */

export type PhaseId =
  | "identify"
  | "portal"
  | "review"
  | "limits"
  | "community"
  | "draft"
  | "verify";

export type SectionId = "verdict" | "stages" | "requirements" | "steps" | "blockers" | "unknowns" | "sources";

/** `at` is milliseconds since the job started. */
export type ResearchEvent =
  | { type: "phase"; phase: PhaseId; at: number }
  | { type: "log"; text: string; tone?: "info" | "warn"; at: number }
  | { type: "source"; title: string; url: string; at: number }
  | { type: "finding"; text: string; evidence: EvidenceKind; at: number }
  | { type: "section"; section: SectionId; at: number }
  | { type: "done"; slug: string; at: number }
  /** `slug` is where the answer was saved; missing when a saved guide for the app was kept instead */
  | { type: "no-oauth"; message: string; slug?: string; alternative?: string; at: number }
  | { type: "error"; message: string; at: number };

export type JobStatus = "queued" | "running" | "done" | "no-oauth" | "failed";

export interface ResearchJob {
  id: string;
  query: string;
  name: string;
  status: JobStatus;
  createdAt: string;
  slug?: string;
  /** Why research ended without a guide (no-oauth or error) */
  message?: string;
  /** The query was taken as written, with no matching to known apps */
  exact?: boolean;
  /** Matching mapped a typo or nickname to a known app; the page offers "Did you mean" */
  corrected?: boolean;
}

export type StartResearchResponse =
  | { kind: "job"; jobId: string }
  /** `corrected`: reached through a typo or nickname match, so show "Did you mean" */
  | { kind: "existing"; slug: string; corrected?: boolean }
  /** Research already found no OAuth for this app; `force` researches it again */
  | ({ kind: "no-oauth"; corrected?: boolean } & NoOAuthAnswer);
