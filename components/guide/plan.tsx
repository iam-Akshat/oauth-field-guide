"use client";

import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ActorTag, EvidenceChip } from "@/components/badges";
import { Rich } from "@/components/guide/rich";
import { ACTORS, formatDuration, STAGES } from "@/lib/meta";
import type { Actor, Requirement, Source, Stage, Step, StepImage } from "@/lib/types";

type Filter = "all" | Actor;

type Props = { slug: string; stages: Stage[]; requirements: Requirement[]; steps: Step[]; sources: Source[] };

/** Requirements and steps as one checklist, grouped by stage. Ticks are saved in this browser. */
export function Plan({ slug, stages, requirements, steps, sources }: Props) {
  const key = `plan:${slug}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
      if (saved) setDone(new Set(JSON.parse(saved) as string[]));
    } catch {
      // Storage unavailable: ticks just won't persist.
    }
  }, [key]);

  const flip = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  function tick(id: string) {
    setDone((prev) => {
      const next = flip(prev, id);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  const ids = [...requirements.map((r) => `r:${r.id}`), ...steps.map((s) => `s:${s.id}`)];
  const total = ids.length;
  const doneCount = ids.filter((id) => done.has(id)).length;
  const count = (f: Filter) =>
    f === "all" ? total : requirements.filter((r) => r.actor === f).length + steps.filter((s) => s.actor === f).length;
  const shown = (a: Actor) => filter === "all" || filter === a;
  const filters: Filter[] = ["all", "agent", "you", "provider"];

  const task = (id: string, actor: Actor, title: string, time: string | null, body: ReactNode) => (
    <Task
      key={id}
      id={id}
      actor={actor}
      title={title}
      time={time}
      checked={done.has(id)}
      expanded={open.has(id)}
      onCheck={() => tick(id)}
      onExpand={() => setOpen((prev) => flip(prev, id))}
    >
      {body}
    </Task>
  );

  const reqs = requirements.filter((r) => shown(r.actor));
  // Requirements show up where they're first needed; only build-stage ones (or orphans) come before everything.
  const later = new Set(stages.filter((s) => s.id !== "build").map((s) => s.id));
  const upfront = reqs.filter((r) => !later.has(r.stage));
  const requirementTask = (r: Requirement) =>
    task(
      `r:${r.id}`,
      r.actor,
      r.label,
      null,
      <>
        <p>{r.detail}</p>
        <Meta>
          <span className="label-mono">Needed for {STAGES[r.stage]}</span>
          <EvidenceChip evidence={r.evidence} sources={sources} />
        </Meta>
      </>,
    );

  return (
    <section id="plan" aria-labelledby="plan-title" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 id="plan-title" className="text-lg">
            Plan
          </h2>
          <span className="label-mono tnum" aria-live="polite">
            {doneCount > 0 ? `${doneCount} of ${total} done` : `${total} tasks`}
          </span>
        </div>
        <div role="group" aria-label="Show tasks for" className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              disabled={count(f) === 0}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm whitespace-nowrap transition-colors duration-[var(--dur-micro)] disabled:cursor-not-allowed disabled:opacity-50 ${
                filter === f ? "border-accent bg-accent-wash text-accent-strong" : "border-rule bg-paper text-ink-2 hover:border-rule-2"
              }`}
            >
              {f === "all" ? "All" : ACTORS[f].label}
              <span className="tnum text-xs text-muted">{count(f)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-rule-2">
        {upfront.length > 0 && (
          <Group label="Setup" title="Before you start">
            {upfront.map(requirementTask)}
          </Group>
        )}

        {stages.map((stage) => {
          const items = steps.filter((s) => s.stage === stage.id && shown(s.actor));
          const needs = later.has(stage.id) ? reqs.filter((r) => r.stage === stage.id) : [];
          if (!items.length && !needs.length && filter !== "all") return null;
          return (
            <Group
              key={stage.id}
              label={STAGES[stage.id]}
              title={stage.name}
              meta={`work ${formatDuration(stage.effort).toLowerCase()} · wait ${formatDuration(stage.wait).toLowerCase()}`}
              sub={stage.whoCanConnect}
            >
              {needs.map(requirementTask)}
              {items.map((s) =>
                task(
                  `s:${s.id}`,
                  s.actor,
                  s.title,
                  s.actor === "provider" ? `wait ${formatDuration(s.time).toLowerCase()}` : formatDuration(s.time),
                  <StepBody step={s} sources={sources} />,
                ),
              )}
            </Group>
          );
        })}
      </div>
    </section>
  );
}

function Group({ label, title, meta, sub, children }: { label: string; title: string; meta?: string; sub?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-rule bg-paper-2 px-3 py-2.5">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="label-mono">{label}</span>
          {title}
        </h3>
        {meta && <span className="font-mono text-xs text-muted tnum">{meta}</span>}
        {sub && <p className="w-full text-xs text-muted">{sub}</p>}
      </div>
      <ul>{children}</ul>
    </div>
  );
}

type TaskProps = {
  id: string;
  actor: Actor;
  title: string;
  time: string | null;
  checked: boolean;
  expanded: boolean;
  onCheck: () => void;
  onExpand: () => void;
  children: ReactNode;
};

function Task({ id, actor, title, time, checked, expanded, onCheck, onExpand, children }: TaskProps) {
  const panel = `task-${id.replace(":", "-")}`;
  return (
    <li className="border-b border-rule">
      <div className="flex items-start gap-3 px-3">
        <span className="relative mt-3.5 grid size-5 shrink-0 place-items-center">
          <input
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            aria-label={`Done: ${title}`}
            className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-sm border border-rule-2 bg-paper transition-colors duration-[var(--dur-micro)] checked:border-accent checked:bg-accent"
          />
          <Check size={14} strokeWidth={3} className="pointer-events-none relative text-accent-ink opacity-0 peer-checked:opacity-100" aria-hidden="true" />
        </span>
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-controls={panel}
          className="group grid min-h-12 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-1.5 py-2.5 text-left sm:grid-cols-[6.5rem_minmax(0,1fr)_8rem_1rem]"
        >
          <span className="order-3 col-span-2 flex items-center gap-2.5 sm:order-none sm:col-span-1">
            <ActorTag actor={actor} />
            {time && <span className="font-mono text-xs text-muted tnum sm:hidden">{time}</span>}
          </span>
          <span
            className={`order-1 font-medium sm:order-none ${time ? "" : "sm:col-span-2"} ${checked ? "text-muted line-through decoration-rule-2" : "text-ink group-hover:text-accent-strong"}`}
          >
            {title}
          </span>
          {time && <span className="hidden text-right font-mono text-xs whitespace-nowrap text-muted tnum sm:block">{time}</span>}
          <ChevronDown
            size={16}
            className={`order-2 text-muted transition-transform duration-[var(--dur-short)] sm:order-none ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {expanded && (
        <div id={panel} className="grid gap-3 pr-3 pb-4 pl-11 text-sm sm:pl-[calc(2.75rem+6.5rem+0.75rem)]">
          {children}
        </div>
      )}
    </li>
  );
}

function StepBody({ step: s, sources }: { step: Step; sources: Source[] }) {
  return (
    <>
      <p className="max-w-[var(--measure)]">
        <Rich text={s.detail} />
      </p>
      {s.actions && (
        <ul className="grid gap-1.5">
          {s.actions.map((a) => (
            <li key={a} className="flex gap-2.5">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
              <span>
                <Rich text={a} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {s.agentNote && (
        <p>
          <span className="label-mono mr-2 !text-accent-strong">Agent</span>
          {s.agentNote}
        </p>
      )}
      {s.gotcha && (
        <p>
          <span className="label-mono mr-2 !text-warn">Watch out</span>
          <Rich text={s.gotcha} />
        </p>
      )}
      {s.image && <Screenshot image={s.image} source={sources.find((x) => x.id === s.image?.source)} />}
      <Meta>
        <EvidenceChip evidence={s.evidence} sources={sources} />
        {s.link && (
          <a href={s.link.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
            {s.link.label}
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        )}
        <a href={`#report-s-${s.id}`} className="text-xs text-muted underline decoration-rule-2 underline-offset-2 hover:text-ink">
          Stuck here?
        </a>
      </Meta>
    </>
  );
}

/** Shown from the provider's docs, not copied, and credited. Hidden if it stops loading. */
function Screenshot({ image, source }: { image: StepImage; source?: Source }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="grid max-w-[var(--measure)] gap-1.5">
      <a href={image.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--radius-sm)] border border-rule bg-paper-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote doc hosts vary per guide, so no next/image allowlist */}
        <img
          src={image.url}
          alt={image.alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-80 w-full object-contain object-top-left"
        />
      </a>
      <figcaption className="text-xs text-muted">
        {image.alt}. From{" "}
        <a href={source?.url ?? image.url} target="_blank" rel="noreferrer" className="link">
          {source?.publisher ?? new URL(image.url).hostname}
        </a>
      </figcaption>
    </figure>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>;
}
