"use client";

import { ArrowRight, ArrowUpRight, Check, CircleDashed, CircleX, LoaderCircle, Minus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ResearchButton } from "@/components/research-again";
import { researchHref, startResearch } from "@/lib/client";
import { EVIDENCE, formatTime, PHASES, SECTIONS } from "@/lib/meta";
import type { PhaseId, ResearchEvent, ResearchJob } from "@/lib/types";

type Terminal = Extract<ResearchEvent, { type: "done" | "no-oauth" | "error" }>;

const clock = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

export function ResearchLive({ job }: { job: ResearchJob }) {
  const router = useRouter();
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [lost, setLost] = useState(false);
  const [now, setNow] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const es = new EventSource(`/api/research/${job.id}/events`);
    // The server replays the whole job on every (re)connect, so start clean.
    es.onopen = () => {
      setEvents([]);
      setLost(false);
    };
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as ResearchEvent;
      setStartedAt((t) => t ?? Date.now() - e.at);
      setEvents((prev) => [...prev, e]);
      if (e.type === "done" || e.type === "no-oauth" || e.type === "error") es.close();
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setLost(true);
    };
    return () => es.close();
  }, [job.id]);

  const terminal = events.find((e): e is Terminal => e.type === "done" || e.type === "no-oauth" || e.type === "error");

  // Tick the elapsed clock while the agent is working.
  useEffect(() => {
    if (terminal) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [terminal]);

  // Follow the log unless the reader has scrolled up.
  useEffect(() => {
    const el = logRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [events]);

  const view = useMemo(() => {
    const phases = events.filter((e) => e.type === "phase").map((e) => e.phase);
    const current = phases.at(-1);
    const drafted = new Set(events.flatMap((e) => (e.type === "section" ? [e.section] : [])));
    const findings = events.filter((e) => e.type === "finding");
    const sources = events.filter((e) => e.type === "source");
    return { phases, current, drafted, findings, sources };
  }, [events]);

  const elapsed = terminal ? terminal.at : startedAt && now ? now - startedAt : 0;

  function phaseState(id: PhaseId): "done" | "active" | "failed" | "pending" | "unreported" {
    // The real agent works in its own order and may fold a phase into another.
    if (!view.phases.includes(id)) return terminal ? "unreported" : "pending";
    if (id !== view.current) return "done";
    if (terminal?.type === "done") return "done";
    if (terminal) return "failed";
    return "active";
  }

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      router.push(researchHref(await startResearch(job.query, { force: true, exact: job.exact }), job.query));
    } catch (err) {
      setRetrying(false);
      setRetryError(err instanceof Error ? err.message : "Research couldn’t start. Try again.");
    }
  }

  const status = terminal?.type === "done" ? "Guide ready" : terminal?.type === "no-oauth" ? "No OAuth found" : terminal ? "Stopped" : "Researching";
  const currentLabel = PHASES.find((p) => p.id === view.current)?.label;

  return (
    <div className="page pt-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/#library" className="hover:text-ink">
          Library
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page" className="text-ink-2">
          Research
        </span>
      </nav>

      <header className="mt-6 flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl">
            {terminal?.type === "done"
              ? `${job.name}: guide ready`
              : terminal?.type === "no-oauth"
                ? `${job.name}: no OAuth found`
                : terminal
                  ? `${job.name}: research stopped`
                  : `Researching ${job.name}`}
          </h1>
          <p className="mt-2 font-mono text-xs text-muted">
            “{job.query}” · started {formatTime(job.createdAt)} · shareable: others see the same run
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span className="label-mono inline-flex items-center gap-2">
            {!terminal && <LoaderCircle size={13} className="spin text-accent" aria-hidden="true" />}
            {terminal?.type === "done" && <Check size={13} className="text-ok" aria-hidden="true" />}
            {terminal && terminal.type !== "done" && <CircleX size={13} className="text-warn" aria-hidden="true" />}
            {status}
          </span>
          <span className="font-mono text-sm text-ink tnum" aria-label="Elapsed time">
            {clock(elapsed)}
          </span>
          <CopyButton label="Copy link" />
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {terminal ? status : currentLabel ? `Now: ${currentLabel}` : "Connecting to the research agent"}
      </p>

      {lost && !terminal && (
        <p role="alert" className="mt-6 rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          Connection dropped. The run continues on the server; reload to reconnect.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Agent panel: the page's one dark beat */}
        <section aria-labelledby="agent-title" className="band-graphite on-graphite min-w-0 overflow-hidden rounded-lg">
          <div className="border-b border-graphite-rule p-5">
            <h2 id="agent-title" className="label-mono">
              Agent
            </h2>
            <ol className="mt-4 grid gap-2.5">
              {PHASES.map((p) => {
                const state = phaseState(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    {state === "done" && <Check size={15} className="shrink-0 text-graphite-accent" aria-hidden="true" />}
                    {state === "active" && <LoaderCircle size={15} className="spin shrink-0 text-graphite-accent" aria-hidden="true" />}
                    {state === "failed" && <CircleX size={15} className="shrink-0 text-danger-on-dark" aria-hidden="true" />}
                    {state === "pending" && <CircleDashed size={15} className="shrink-0 text-graphite-rule" aria-hidden="true" />}
                    {state === "unreported" && <Minus size={15} className="shrink-0 text-graphite-rule" aria-hidden="true" />}
                    <span className={state === "pending" || state === "unreported" ? "text-graphite-muted" : "text-graphite-ink"}>
                      {p.label}
                      <span className="sr-only"> ({state === "unreported" ? "not reported" : state})</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div
            ref={logRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
            className="h-[22rem] overflow-y-auto p-5 font-mono text-xs leading-relaxed lg:h-[26rem]"
            role="log"
            aria-label="Agent activity"
          >
            {events.length === 0 && !lost && (
              <div className="grid gap-2">
                <div className="skeleton h-3.5 w-3/4" />
                <div className="skeleton h-3.5 w-1/2" />
              </div>
            )}
            {events.map((e, i) => (
              <LogLine key={i} event={e} />
            ))}
          </div>
        </section>

        {/* Draft panel */}
        <section aria-labelledby="draft-title" className="min-w-0">
          {terminal && (
            <Outcome
              terminal={terminal}
              name={job.name}
              onRetry={retry}
              retrying={retrying}
              retryError={retryError}
            />
          )}

          <h2 id="draft-title" className="text-lg">
            Guide draft
          </h2>
          <ul className="mt-4 grid gap-2.5">
            {SECTIONS.map((s) => {
              const drafted = view.drafted.has(s.id);
              return (
                <li key={s.id} className="grid grid-cols-[1.25rem_9.5rem_minmax(0,1fr)] items-center gap-3 text-sm">
                  {drafted ? (
                    <Check size={15} className="text-ok" aria-hidden="true" />
                  ) : (
                    <CircleDashed size={15} className="text-rule-2" aria-hidden="true" />
                  )}
                  <span className={drafted ? "text-ink" : "text-muted"}>
                    {s.label}
                    <span className="sr-only">{drafted ? " drafted" : " not drafted yet"}</span>
                  </span>
                  <span className={`h-2 rounded-sm ${drafted ? "bg-accent-wash" : "skeleton"}`} aria-hidden="true" />
                </li>
              );
            })}
          </ul>

          <h3 className="mt-10 text-base">Findings so far</h3>
          {view.findings.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing yet. Findings appear here as the agent confirms them.</p>
          ) : (
            <ul className="mt-3 border-t border-rule">
              {view.findings.map((f, i) => (
                <li key={i} className="log-line grid gap-1 border-b border-rule py-3 text-sm">
                  <span className="label-mono">{EVIDENCE[f.evidence].label}</span>
                  <span className="text-ink">{f.text}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-10 text-base">
            Sources read <span className="text-sm font-normal text-muted tnum">{view.sources.length}</span>
          </h3>
          <ul className="mt-3 grid gap-2">
            {view.sources.map((s, i) => (
              <li key={i} className="log-line min-w-0 text-sm">
                <a href={s.url} target="_blank" rel="noreferrer" className="link inline-flex max-w-full items-center gap-1">
                  <span className="truncate">{s.title}</span>
                  <ArrowUpRight size={13} className="shrink-0" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function LogLine({ event: e }: { event: ResearchEvent }) {
  const time = <span className="text-graphite-muted tnum">{clock(e.at)}</span>;
  const row = (tag: string, tagClass: string, body: React.ReactNode) => (
    <div className="log-line grid grid-cols-[4.25rem_4.5rem_minmax(0,1fr)] gap-2 py-0.5">
      {time}
      <span className={tagClass}>{tag}</span>
      <span className="min-w-0 [overflow-wrap:anywhere] text-graphite-ink">{body}</span>
    </div>
  );

  switch (e.type) {
    case "phase":
      return (
        <div className="log-line mt-3 mb-1 grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2 first:mt-0">
          {time}
          <span className="font-medium text-graphite-accent">▸ {PHASES.find((p) => p.id === e.phase)?.label}</span>
        </div>
      );
    case "log":
      return row(e.tone === "warn" ? "note" : "info", e.tone === "warn" ? "text-tier-3" : "text-graphite-muted", e.text);
    case "source":
      return row(
        "read",
        "text-graphite-muted",
        <a href={e.url} target="_blank" rel="noreferrer" className="underline decoration-graphite-rule underline-offset-2 hover:decoration-graphite-accent">
          {e.title}
        </a>,
      );
    case "finding":
      return row("found", "text-graphite-accent", e.text);
    case "section":
      return row("draft", "text-graphite-muted", `${SECTIONS.find((s) => s.id === e.section)?.label} written`);
    case "done":
      return row("done", "text-graphite-accent", "Guide saved to the library");
    case "no-oauth":
      return row("stop", "text-tier-3", "No OAuth flow found");
    case "error":
      return row("error", "text-danger-on-dark", e.message);
  }
}

function Outcome({
  terminal,
  name,
  onRetry,
  retrying,
  retryError,
}: {
  terminal: Terminal;
  name: string;
  onRetry: () => void;
  retrying: boolean;
  retryError: string | null;
}) {
  if (terminal.type === "done") {
    return (
      <div className="log-line mb-10 rounded-lg border border-rule-2 p-5">
        <p className="font-display text-lg font-semibold text-ink">The {name} guide is in the library</p>
        <p className="mt-1.5 text-sm">Unconfirmed claims are marked in the guide.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/apps/${terminal.slug}`} className="btn btn-primary">
            Open guide
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }
  if (terminal.type === "no-oauth") {
    return (
      <div className="log-line mb-10 rounded-lg border border-rule-2 p-5">
        <p className="font-display text-lg font-semibold text-ink">{name} doesn’t look like an OAuth app</p>
        <p className="mt-1.5 text-sm">{terminal.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {terminal.alternative && <ResearchButton query={terminal.alternative} label={`Research ${terminal.alternative}`} primary />}
          <Link href={terminal.slug ? `/apps/${terminal.slug}` : "/#library"} className="btn btn-quiet">
            {terminal.slug ? "Saved answer" : "Back to the library"}
          </Link>
        </div>
        {terminal.slug && (
          <p className="mt-3 text-sm text-muted">
            Saved, so nobody pays to research it again.{" "}
            <Link href={`/apps/${terminal.slug}#report`} className="link">
              Think it’s wrong?
            </Link>
          </p>
        )}
      </div>
    );
  }
  return (
    <div role="alert" className="log-line mb-10 rounded-lg border border-danger bg-danger-wash p-5">
      <p className="font-display text-lg font-semibold text-ink">Research stopped</p>
      <p className="mt-1.5 text-sm text-ink-2">{terminal.message}</p>
      {retryError && <p className="form-error mt-2 text-sm">{retryError}</p>}
      <div className="mt-4">
        <button type="button" className="btn btn-quiet" onClick={onRetry} disabled={retrying}>
          {retrying ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}
          {retrying ? "Starting" : "Try again"}
        </button>
      </div>
    </div>
  );
}
