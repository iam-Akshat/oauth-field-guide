import { ArrowUpRight, Flag } from "lucide-react";
import Link from "next/link";
import { UpdatedAt } from "@/components/badges";
import { Fold } from "@/components/guide/guide-view";
import { OpenOnHash } from "@/components/guide/open-on-hash";
import { Feedback } from "@/components/feedback";
import { ResearchAgain, ResearchButton } from "@/components/research-again";
import { daysSince } from "@/lib/meta";
import type { NoOAuthAnswer, Report } from "@/lib/types";

/** A saved research result that found no OAuth: why, what to research instead, and where to say it's wrong. */
export function NoOAuthView({ answer: a, reports }: { answer: NoOAuthAnswer; reports: Report[] }) {
  return (
    <article className="page pt-6 pb-20">
      <OpenOnHash />
      <div className="max-w-[50rem]">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/#library" className="hover:text-ink">
            Library
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-ink-2">
            {a.name}
          </span>
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl [overflow-wrap:anywhere]">{a.name}</h1>
          <span className="label-mono !text-warn">No OAuth</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs text-muted">
          <span>{a.domain ?? "domain not confirmed"}</span>
          <UpdatedAt date={a.checkedAt} at={a.researchedAt} days={daysSince(a.researchedAt ?? a.checkedAt)} />
        </div>

        <p className="mt-5 max-w-[62ch] text-ink-2">{a.reason}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {a.alternative && <ResearchButton query={a.alternative} label={`Research ${a.alternative}`} primary small />}
          <ResearchAgain query={a.name} />
        </div>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="text-muted">Saved, so nobody researches it twice.</span>
          <a href="#feedback" className={`link inline-flex items-center gap-1.5 ${reports.length ? "!text-warn" : ""}`}>
            <Flag size={14} aria-hidden="true" />
            {reports.length ? `${reports.length} open report${reports.length === 1 ? "" : "s"}` : "Think it’s wrong?"}
          </a>
        </p>

        <div className="mt-10 border-t border-rule-2">
          {a.sources.length > 0 && (
            <Fold id="sources" title="Sources" count={a.sources.length}>
              <ol className="grid gap-2.5">
                {a.sources.map((s, i) => (
                  <li key={s.url} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 text-sm">
                    <span className="font-mono text-muted tnum">{i + 1}</span>
                    <a href={s.url} target="_blank" rel="noreferrer" className="link inline-flex items-baseline gap-1 font-medium [overflow-wrap:anywhere]">
                      {s.title}
                      <ArrowUpRight size={13} className="shrink-0 self-center" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
            </Fold>
          )}
        </div>

        <Feedback
          app={a.slug}
          name={a.name}
          since={a.researchedAt ?? a.checkedAt}
          reports={reports}
          outcomes={["wrong"]}
          ask={`Does ${a.name} offer OAuth after all? What did you find?`}
        />
      </div>
    </article>
  );
}
