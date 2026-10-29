import { Bot } from "lucide-react";
import { FeedbackForm } from "@/components/feedback-form";
import { OUTCOME_STYLE } from "@/components/outcome-style";
import { formatDate, OUTCOME_ORDER, OUTCOMES, outcomeOf } from "@/lib/meta";
import type { Report, ReportOutcome } from "@/lib/types";

type Part = { id: string; label: string };

/**
 * Feedback on the version on the page: how setups went, what people reported,
 * and a form to add to it. `outcomes` is what the form offers; a no-OAuth
 * answer has no steps to follow, so only "wrong".
 */
export function Feedback({
  app,
  name,
  since,
  reports,
  parts,
  outcomes = OUTCOME_ORDER,
  ask,
}: {
  app: string;
  name: string;
  since: string;
  reports: Report[];
  parts?: Part[];
  outcomes?: ReportOutcome[];
  ask: string;
}) {
  return (
    <section id="feedback" aria-labelledby="feedback-title" className="mt-12 scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="feedback-title" className="text-lg">
          Feedback
        </h2>
        <span className="font-mono text-xs text-muted">On the version researched {formatDate(since)}</span>
      </div>

      {outcomes.length > 1 && (
        <dl className="mt-4 grid grid-cols-2 border-y border-rule sm:grid-cols-4">
          {outcomes.map((o) => {
            const n = reports.filter((r) => outcomeOf(r) === o).length;
            const { Icon, color } = OUTCOME_STYLE[o];
            return (
              <div key={o} className="py-3 pr-4 sm:border-l sm:border-rule sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
                <dt className="label-mono inline-flex items-center gap-1.5">
                  <Icon size={13} className={n ? color : ""} aria-hidden="true" />
                  {OUTCOMES[o].tally}
                </dt>
                <dd className={`mt-0.5 font-display text-lg font-semibold tnum ${n ? "text-ink" : "text-muted"}`}>{n}</dd>
              </div>
            );
          })}
        </dl>
      )}

      <InProduction name={name} what={outcomes.length > 1 ? "guide" : "answer"} />

      <div className="mt-6">
        <FeedbackForm app={app} parts={parts} reports={reports} outcomes={outcomes} ask={ask} />
      </div>
    </section>
  );
}

/** What this demo does with feedback, and what a production deployment would. */
function InProduction({ name, what }: { name: string; what: "guide" | "answer" }) {
  return (
    <aside aria-label="How feedback is used" className="mt-5 flex gap-3 rounded-md border border-rule bg-paper-2 p-4 text-sm">
      <Bot size={18} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden="true" />
      <div className="grid gap-1.5">
        <p className="font-medium text-ink">In production, an agent keeps improving this {what}</p>
        <p className="text-ink-2">
          Each report goes to an agent that checks it against {name}’s own pages, researches the {what} again when the report holds
          up, and publishes the fix.{what === "guide" ? " Setups that worked tell it what to keep." : ""}
        </p>
        <p className="text-muted">In this demo, that check runs the next time someone researches {name} again.</p>
      </div>
    </aside>
  );
}
