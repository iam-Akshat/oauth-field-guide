import { ArrowUpRight, Bot, Braces, Building2, ChevronRight, CircleAlert, CircleCheck, FileText, Flag, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AgentAccess, type AccessTab } from "@/components/agent-access";
import { EvidenceChip, QualityBadge, TierBadge, UpdatedAt } from "@/components/badges";
import { CopyButton } from "@/components/copy-button";
import { Feedback } from "@/components/feedback";
import { OpenOnHash } from "@/components/guide/open-on-hash";
import { Plan } from "@/components/guide/plan";
import { Rich } from "@/components/guide/rich";
import { ResearchAgain } from "@/components/research-again";
import { daysSince, formatDate, formatDuration, isIssue, outcomeOf, REGISTRATION, reportParts, TIERS } from "@/lib/meta";
import type { Guide, Report, ScopeTier, SetupAttempt, Source } from "@/lib/types";

const LEVEL_STYLE: Record<ScopeTier["level"], string> = {
  basic: "text-muted",
  sensitive: "text-warn",
  restricted: "text-danger",
};

const RESULT_LABEL: Record<SetupAttempt["log"][number]["result"], [string, string]> = {
  ok: ["OK", "text-ok"],
  handoff: ["Handed off", "text-accent-strong"],
  blocked: ["Blocked", "text-danger"],
  corrected: ["Corrected", "text-warn"],
};

const SOURCE_KIND: Record<Source["kind"], string> = {
  official: "Official docs",
  composio: "Composio docs",
  community: "Community",
  search: "Search results",
  attempt: "Setup attempt",
};

export function GuideView({ guide: g, brief, base, reports }: { guide: Guide; brief: string; base: string; reports: Report[] }) {
  const provider = g.name.split(" (")[0];
  const worked = reports.filter((r) => outcomeOf(r) === "worked").length;
  const issues = reports.filter(isIssue).length;
  const tabs: AccessTab[] = [
    { id: "prompt", label: "Prompt", code: brief, note: "Paste into Claude Code, Cursor or any agent." },
    {
      id: "mcp",
      label: "MCP",
      code: `claude mcp add --transport http oauth-guide ${base}/api/mcp`,
      note: `Then ask: “set up the ${provider} OAuth app”.`,
    },
    { id: "cli", label: "CLI", code: `npx oauth-guide ${g.slug} --prompt`, note: "Pipe it to claude -p, or drop --prompt for Markdown." },
    { id: "md", label: ".md", code: `curl ${base}/apps/${g.slug}.md`, note: "Or send Accept: text/markdown to the page URL." },
  ];

  return (
    <article className="page pt-6 pb-20">
      <OpenOnHash />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-12">
        <header className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/#library" className="hover:text-ink">
              Library
            </Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-ink-2">
              {provider}
            </span>
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-2xl">{g.name}</h1>
            <TierBadge tier={g.tier} size="base" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="font-mono text-xs text-muted">{g.domain ?? "domain not confirmed"}</span>
            <QualityBadge quality={g.quality} />
            {g.registration?.model === "per-tenant" && (
              <a href="#access" className="label-mono inline-flex items-center gap-1.5 whitespace-nowrap hover:!text-ink" title={REGISTRATION["per-tenant"].blurb}>
                <Building2 size={13} strokeWidth={2} aria-hidden="true" />
                {REGISTRATION["per-tenant"].label}
              </a>
            )}
            <UpdatedAt date={g.updatedAt} at={g.researchedAt} days={daysSince(g.researchedAt ?? g.updatedAt)} />
          </div>

          <p className="mt-5 max-w-[62ch] text-ink-2">{g.summary}</p>

          <dl className="mt-5 grid grid-cols-2 border-y border-rule sm:grid-cols-3">
            <Stat label="Your work" value={formatDuration(g.totals.effort)} />
            <Stat label={`Waiting on ${provider}`} value={formatDuration(g.totals.wait)} />
            <Stat label="First user connects" value={g.totals.firstConnection} small />
          </dl>

          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {g.unknowns.length > 0 && (
              <a href="#unknowns" className="link inline-flex items-center gap-1.5 !text-warn">
                <CircleAlert size={14} aria-hidden="true" />
                {g.unknowns.length} not confirmed
              </a>
            )}
            <a href="#sources" className="link">
              {g.sources.length} sources
            </a>
            {g.attempt && (
              <a href="#attempt" className="link">
                Setup attempt: {g.attempt.outcome}
              </a>
            )}
            <a href="#why" className="link">
              Why this tier
            </a>
            {worked > 0 && (
              <a href="#feedback" className="link inline-flex items-center gap-1.5 !text-ok">
                <CircleCheck size={14} aria-hidden="true" />
                {worked} setup{worked === 1 ? "" : "s"} worked
              </a>
            )}
            {issues > 0 && (
              <a href="#feedback" className="link inline-flex items-center gap-1.5 !text-warn">
                <Flag size={14} aria-hidden="true" />
                {issues} open report{issues === 1 ? "" : "s"}
              </a>
            )}
            {!worked && !issues && (
              <a href="#feedback" className="link inline-flex items-center gap-1.5">
                <MessageSquare size={14} aria-hidden="true" />
                How did it go?
              </a>
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <CopyButton value={brief} label="Copy agent prompt" icon={<Bot size={14} aria-hidden="true" />} className="btn btn-primary btn-sm" />
            <a href={`/apps/${g.slug}.md`} className="btn btn-quiet btn-sm">
              <FileText size={14} aria-hidden="true" />
              .md
            </a>
            <a href={`/api/guides/${g.slug}`} className="btn btn-quiet btn-sm">
              <Braces size={14} aria-hidden="true" />
              JSON
            </a>
            <ResearchAgain query={g.name} />
          </div>
        </header>

        <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-24">
            <AgentAccess tabs={tabs} />
          </div>
        </aside>

        <div className="min-w-0">
          <Plan slug={g.slug} stages={g.stages} requirements={g.requirements} steps={g.steps} sources={g.sources} />

          <div className="mt-10 border-t border-rule-2">
            <Fold id="why" title={`Why ${TIERS[g.tier].label.toLowerCase()}`}>
              <dl className="grid gap-4 text-sm">
                <Pair term="Tier">{g.tierReason}</Pair>
                <Pair term="Using Composio?">
                  {g.composio.note}
                  {g.composio.toolkit && <span className="mt-1 block font-mono text-xs text-muted">{g.composio.toolkit}</span>}
                </Pair>
                {g.stages.map((s) => (
                  <Pair key={s.id} term={s.name}>
                    Users see: {s.userSees}
                    {s.unlock && <span className="block text-muted">Next: {s.unlock}</span>}
                    <span className="mt-1.5 block">
                      <EvidenceChip evidence={s.evidence} sources={g.sources} />
                    </span>
                  </Pair>
                ))}
              </dl>
            </Fold>

            {g.registration && (
              <Fold id="access" title="Registration and grants" count={g.grants?.length}>
                <dl className="grid gap-4 text-sm">
                  <Pair term="Registration">
                    <span className="font-medium text-ink">{REGISTRATION[g.registration.model].label}.</span> {g.registration.note}
                    <span className="mt-1.5 block">
                      <EvidenceChip evidence={g.registration.evidence} sources={g.sources} />
                    </span>
                  </Pair>
                  {g.grants?.map((x) => (
                    <Pair key={x.name} term={x.name}>
                      {x.fits}
                      <span className="mt-1.5 block">
                        <EvidenceChip evidence={x.evidence} sources={g.sources} />
                      </span>
                    </Pair>
                  ))}
                </dl>
              </Fold>
            )}

            {g.scopes && (
              <Fold id="scopes" title="Scopes" count={g.scopes.tiers.length}>
                <p className="mb-3 text-sm text-muted">{g.scopes.intro}</p>
                <ul className="border-t border-rule">
                  {g.scopes.tiers.map((t) => (
                    <li
                      key={t.scope}
                      className="grid gap-x-4 gap-y-1 border-b border-rule py-3 text-sm md:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.5fr)]"
                    >
                      <code className="font-mono text-ink [overflow-wrap:anywhere]">{t.scope}</code>
                      <span className={`label-mono ${LEVEL_STYLE[t.level]}`}>{t.level}</span>
                      <span>
                        {t.grants}. <span className="text-muted">{t.consequence}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Fold>
            )}

            <Fold id="blockers" title="When you get stuck" count={g.blockers.length}>
              <ul className="grid gap-4">
                {g.blockers.map((b) => (
                  <li key={b.symptom} className="text-sm">
                    <p className="font-medium text-ink">
                      <Rich text={b.symptom} />
                    </p>
                    <p className="mt-1">{b.cause}</p>
                    <p className="mt-1 text-ink">
                      <span className="label-mono mr-2 !text-ok">Fix</span>
                      {b.fix}
                    </p>
                    <div className="mt-1.5">
                      <EvidenceChip evidence={b.evidence} sources={g.sources} />
                    </div>
                  </li>
                ))}
              </ul>
            </Fold>

            <Fold id="unknowns" title="Not confirmed" count={g.unknowns.length} warn={g.unknowns.length > 0}>
              <ul className="grid gap-4">
                {g.unknowns.map((u) => (
                  <li key={u.question} className="text-sm">
                    <p className="font-medium text-ink">{u.question}</p>
                    <p className="mt-1">{u.why}</p>
                    <p className="mt-1 text-ink">
                      <span className="label-mono mr-2">Resolve</span>
                      {u.resolve}
                    </p>
                  </li>
                ))}
              </ul>
            </Fold>

            {g.attempt && (
              <Fold id="attempt" title="Setup attempt" count={g.attempt.log.length}>
                <p className="text-sm">{g.attempt.summary}</p>
                <p className="mt-2 label-mono">
                  {formatDate(g.attempt.date)} · {g.attempt.outcome} · {g.attempt.by}
                </p>
                <ol className="mt-3 border-t border-rule">
                  {g.attempt.log.map((l) => {
                    const [label, color] = RESULT_LABEL[l.result];
                    return (
                      <li key={l.step} className="grid gap-x-4 gap-y-0.5 border-b border-rule py-2.5 text-sm sm:grid-cols-[6.5rem_minmax(0,12rem)_minmax(0,1fr)]">
                        <span className={`label-mono ${color}`}>{label}</span>
                        <span className="font-medium text-ink">{l.step}</span>
                        <span>{l.note}</span>
                      </li>
                    );
                  })}
                </ol>
              </Fold>
            )}

            <Fold id="sources" title="Sources" count={g.sources.length}>
              <ol className="grid gap-2.5">
                {g.sources.map((s, i) => (
                  <li
                    key={s.id}
                    id={`source-${s.id}`}
                    className="grid scroll-mt-24 grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 rounded-sm text-sm target:bg-accent-wash"
                  >
                    <span className="font-mono text-muted tnum">{i + 1}</span>
                    <span className="min-w-0">
                      <a
                        href={s.url}
                        {...(s.url.startsWith("#") ? {} : { target: "_blank", rel: "noreferrer" })}
                        className="link inline-flex items-baseline gap-1 font-medium [overflow-wrap:anywhere]"
                      >
                        {s.title}
                        {!s.url.startsWith("#") && <ArrowUpRight size={13} className="shrink-0 self-center" aria-hidden="true" />}
                      </a>
                      <span className="block text-xs text-muted">
                        {s.publisher} · {SOURCE_KIND[s.kind]} ·{" "}
                        <span className={s.checkedAt ? "text-ok" : ""}>
                          {s.checkedAt ? `checked ${formatDate(s.checkedAt)}` : "not yet checked"}
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </Fold>

          </div>

          <Feedback
            app={g.slug}
            name={provider}
            since={g.researchedAt ?? g.updatedAt}
            reports={reports}
            parts={reportParts(g)}
            ask="Followed this guide? How did it go?"
          />
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className={`py-3.5 pr-4 sm:border-l sm:border-rule sm:pl-4 sm:first:border-l-0 sm:first:pl-0 ${small ? "col-span-2 border-t border-rule sm:col-span-1 sm:border-t-0" : ""}`}>
      <dt className="label-mono">{label}</dt>
      <dd className={`mt-1 font-display font-semibold text-ink tnum ${small ? "text-base" : "text-lg"}`}>{value}</dd>
    </div>
  );
}

export function Fold({ id, title, count, warn = false, children }: { id: string; title: string; count?: number; warn?: boolean; children: ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-24 border-b border-rule">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 py-3 hover:text-accent-strong [&::-webkit-details-marker]:hidden">
        <ChevronRight size={16} className="shrink-0 text-muted transition-transform duration-[var(--dur-short)] group-open:rotate-90" aria-hidden="true" />
        <h2 className="text-base">{title}</h2>
        {count !== undefined && <span className={`font-mono text-xs tnum ${warn ? "text-warn" : "text-muted"}`}>{count}</span>}
      </summary>
      <div className="pb-6 pl-[1.625rem]">{children}</div>
    </details>
  );
}

function Pair({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="label-mono">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}
