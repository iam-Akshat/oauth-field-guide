/**
 * In-memory research jobs. A job runs once; every viewer replays its events
 * from the start, so a link to a running job can be shared. Jobs live in the
 * server process, so this needs a long-running server, not serverless.
 */
import { randomUUID } from "node:crypto";
import { isIssue } from "../meta";
import { matchApp, reportsSince, saveGuide, saveNoOAuth } from "../repo";
import type { ResearchEvent, ResearchJob } from "../types";
import { AGENT_MODE } from "./mode";
import { planResearch } from "./mock-agent";
import { type EventBody, resolveQuery } from "./resolve";

type Listener = (e: ResearchEvent) => void;

interface JobRecord {
  job: ResearchJob;
  /** What to research: the query, or the known app it was matched to */
  target: string;
  events: ResearchEvent[];
  listeners: Set<Listener>;
  started: boolean;
}

const store = globalThis as unknown as {
  __researchJobs?: Map<string, JobRecord>;
  __researchDay?: { day: string; count: number };
  __researchRunning?: { count: number; waiting: (() => void)[] };
};
const jobs = (store.__researchJobs ??= new Map<string, JobRecord>());

/** 1 = realistic pacing. Set MOCK_AGENT_SPEED=4 to run four times faster. */
const SPEED = Number(process.env.MOCK_AGENT_SPEED ?? 1) || 1;
/** Real research runs at once; the rest wait their turn. */
const CONCURRENCY = Number(process.env.RESEARCH_CONCURRENCY ?? 2) || 2;
/** Research runs allowed per UTC day, a backstop on spend. */
const DAILY_LIMIT = Number(process.env.RESEARCH_DAILY_LIMIT ?? 50) || 50;

export class ResearchLimitError extends Error {}

export const isTerminal = (e: ResearchEvent) => e.type === "done" || e.type === "no-oauth" || e.type === "error";

type JobOptions = {
  /** What to research, when matching mapped the query to a known app. Defaults to the query. */
  target?: string;
  /** Take the query as written: no typo or nickname matching */
  exact?: boolean;
  /** Matching changed what was typed; the live page offers "Did you mean" */
  corrected?: boolean;
};

/**
 * `query` is what the person typed and is shown on the live page.
 * Returns the job already researching the same app, if there is one, so it isn't paid for twice.
 * Throws ResearchLimitError once today's research allowance is used up.
 */
export function createJob(query: string, { target = query, exact = false, corrected = false }: JobOptions = {}): ResearchJob {
  const slug = resolveQuery(target, { exact }).slug;
  for (const record of jobs.values()) {
    const active = record.job.status === "queued" || record.job.status === "running";
    if (active && resolveQuery(record.target, { exact: record.job.exact }).slug === slug) return record.job;
  }

  if (AGENT_MODE === "claude") {
    const today = new Date().toISOString().slice(0, 10);
    const usage = store.__researchDay?.day === today ? store.__researchDay : (store.__researchDay = { day: today, count: 0 });
    if (usage.count >= DAILY_LIMIT) {
      throw new ResearchLimitError("Today’s research limit is used up. Try again tomorrow, or browse the library.");
    }
    usage.count++;
  }

  const job: ResearchJob = {
    id: randomUUID().split("-")[0],
    query,
    name: resolveQuery(target, { exact }).name,
    status: "queued",
    createdAt: new Date().toISOString(),
    ...(exact ? { exact } : {}),
    ...(corrected ? { corrected } : {}),
  };
  jobs.set(job.id, { job, target, events: [], listeners: new Set(), started: false });
  return job;
}

export function getJob(id: string): ResearchJob | null {
  return jobs.get(id)?.job ?? null;
}

/** Replays past events, then streams new ones. Returns an unsubscribe function. */
export function subscribe(id: string, listener: Listener): () => void {
  const record = jobs.get(id);
  if (!record) return () => {};
  for (const e of record.events) listener(e);
  record.listeners.add(listener);
  return () => record.listeners.delete(listener);
}

export function startJob(id: string): void {
  const record = jobs.get(id);
  if (!record || record.started) return;
  record.started = true;
  void run(record);
}

async function run(record: JobRecord) {
  const t0 = Date.now();
  const emit = (body: EventBody) => {
    const event = { ...body, at: Date.now() - t0 } as ResearchEvent;
    if (event.type === "no-oauth" || event.type === "error") {
      record.job.status = event.type === "error" ? "failed" : "no-oauth";
      record.job.message = event.message;
      if (event.type === "no-oauth" && event.slug) record.job.slug = event.slug;
    }
    record.events.push(event);
    for (const listener of record.listeners) listener(event);
  };

  if (AGENT_MODE === "mock") return replayMock(record, emit);

  const release = await slot(() => emit({ type: "log", text: "Waiting for a free research slot" }));
  record.job.status = "running";
  try {
    const { runResearch } = await import("./agent");
    // Re-research checks what people reported about the saved version, and keeps what setups confirmed.
    const saved = matchApp(record.target, { exact: true });
    const feedback = saved ? reportsSince((saved.guide ?? saved.answer).slug) : [];
    const reports = feedback.filter(isIssue).map(({ outcome, message, part }) => ({ outcome, message, part }));
    const confirmed = feedback.length - reports.length;
    if (reports.length) emit({ type: "log", text: `Checking ${reports.length} report${reports.length === 1 ? "" : "s"} on the saved version` });
    const result = await runResearch(record.target, emit, { exact: record.job.exact, reports, confirmed });
    if (result.kind === "no-oauth") {
      emit({ type: "no-oauth", message: result.reason, ...noOAuth(record, result.reason, result.alternative, result.sources) });
    } else {
      const slug = saveGuide(result.guide);
      record.job.slug = slug;
      record.job.status = "done";
      emit({ type: "done", slug });
    }
  } catch (err) {
    emit({ type: "error", message: err instanceof Error ? err.message : "Research failed. Nothing was saved." });
  } finally {
    release();
  }
}

/** Waits for one of CONCURRENCY research slots. Returns the release function. */
async function slot(onWait: () => void): Promise<() => void> {
  const running = (store.__researchRunning ??= { count: 0, waiting: [] });
  if (running.count >= CONCURRENCY) {
    onWait();
    await new Promise<void>((resolve) => running.waiting.push(resolve));
  }
  running.count++;
  return () => {
    running.count--;
    running.waiting.shift()?.();
  };
}

/**
 * Saves a no-OAuth answer and returns the event's extra fields. No slug when a
 * saved guide for the app was kept instead. An alternative that's the same app is dropped.
 */
function noOAuth(record: JobRecord, reason: string, alternative: string | null | undefined, sources: { title: string; url: string }[]) {
  const r = resolveQuery(record.target, { exact: record.job.exact });
  const instead = alternative && resolveQuery(alternative).slug !== r.slug ? alternative : undefined;
  const slug = saveNoOAuth({
    slug: r.slug,
    name: r.name,
    domain: r.domain,
    reason,
    ...(instead ? { alternative: instead } : {}),
    sources,
    checkedAt: new Date().toISOString().slice(0, 10),
  });
  return { ...(slug ? { slug } : {}), ...(instead ? { alternative: instead } : {}) };
}

async function replayMock(record: JobRecord, emit: (e: EventBody) => void) {
  record.job.status = "running";
  const { script, guide } = planResearch(record.target, record.job.exact);
  for (const step of script) {
    await new Promise((r) => setTimeout(r, step.delay / SPEED));
    if (step.event.type === "done" && guide) {
      record.job.slug = saveGuide(guide);
      record.job.status = "done";
      emit({ type: "done", slug: record.job.slug });
      continue;
    }
    if (step.event.type === "no-oauth") {
      emit({ ...step.event, ...noOAuth(record, step.event.message, step.event.alternative, []) });
      continue;
    }
    emit(step.event);
  }
}
