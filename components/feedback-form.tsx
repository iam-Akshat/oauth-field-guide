"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OUTCOME_STYLE } from "@/components/outcome-style";
import { formatDate, OUTCOMES, outcomeOf } from "@/lib/meta";
import type { Report, ReportOutcome } from "@/lib/types";

const VIA: Record<Report["via"], string> = {
  web: "On this page",
  mcp: "From an agent",
  cli: "From the CLI",
  api: "From the API",
  research: "From a later research run",
};

const PLACEHOLDER: Record<ReportOutcome, string> = {
  worked: "Optional: anything that differed, or took longer than the guide says.",
  waiting: "Optional: what you submitted, and when.",
  stuck: "Where you got stuck and what you saw. A link helps.",
  wrong: "What you saw, and where. A link helps.",
};

type Part = { id: string; label: string };

/**
 * A form to say how following the guide went, then what's been filed on this
 * version. A link to #report-<part id> (from a step, say) opens the form at
 * that part.
 */
export function FeedbackForm({
  app,
  parts = [],
  reports,
  outcomes,
  ask,
}: {
  app: string;
  parts?: Part[];
  reports: Report[];
  outcomes: ReportOutcome[];
  ask: string;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<ReportOutcome | null>(outcomes.length === 1 ? outcomes[0] : null);
  const [part, setPart] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const focusField = useRef(false);
  // Read through refs so a refresh (new props) doesn't re-run the hash handling.
  const partsRef = useRef(parts);
  const outcomesRef = useRef(outcomes);
  useEffect(() => {
    partsRef.current = parts;
    outcomesRef.current = outcomes;
  }, [parts, outcomes]);

  useEffect(() => {
    const reveal = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash.startsWith("report")) return;
      const picked = partsRef.current.find((p) => hash === `report-${p.id}`);
      if (picked) {
        setPart(picked.label);
        // From a step: "Stuck here?"
        const fromStep = picked.id.startsWith("s-") && outcomesRef.current.includes("stuck");
        setOutcome(fromStep ? "stuck" : "wrong");
      }
      document.getElementById("report")?.scrollIntoView({ block: "start" });
      focusField.current = true;
      field.current?.focus({ preventScroll: true });
    };
    // Same-hash clicks don't fire hashchange, so also check after in-page link clicks.
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('a[href^="#report"]')) requestAnimationFrame(reveal);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", reveal);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // The field only renders once an outcome is picked; focus it then if a link asked to.
  useEffect(() => {
    if (outcome && focusField.current) {
      focusField.current = false;
      field.current?.focus({ preventScroll: true });
    }
  }, [outcome]);

  const needsText = outcome === "stuck" || outcome === "wrong";
  const ready = outcome !== null && (!needsText || message.trim().length >= 5);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome) return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app, outcome, message, part: needsText ? part : "", via: "web" }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `That wasn’t saved (HTTP ${res.status}). Try again.`);
      setState("sent");
      setMessage("");
      setPart("");
      if (outcomes.length > 1) setOutcome(null);
      router.refresh();
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "That wasn’t saved. Try again.");
    }
  }

  return (
    <div className="grid gap-6">
      <form id="report" onSubmit={send} className="grid max-w-[var(--measure)] scroll-mt-24 gap-3">
        {outcomes.length > 1 && (
          <fieldset className="grid gap-2">
            <legend className="label-mono mb-2">{ask}</legend>
            <div className="flex flex-wrap gap-1.5">
              {outcomes.map((o) => {
                const { Icon, color } = OUTCOME_STYLE[o];
                const selected = outcome === o;
                return (
                  <label
                    key={o}
                    className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-colors duration-[var(--dur-micro)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-focus)] ${
                      selected ? "border-accent bg-accent-wash text-accent-strong" : "border-rule bg-paper text-ink-2 hover:border-rule-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="outcome"
                      value={o}
                      checked={selected}
                      onChange={() => {
                        setOutcome(o);
                        if (state === "sent") setState("idle");
                      }}
                      className="sr-only"
                    />
                    <Icon size={14} className={selected ? "" : color} aria-hidden="true" />
                    {OUTCOMES[o].label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {outcome && (
          <>
            {needsText && parts.length > 0 && (
              <label className="grid gap-1.5 text-sm">
                <span className="label-mono">Which part</span>
                <select value={part} onChange={(e) => setPart(e.target.value)} className="input text-sm">
                  <option value="">The whole guide</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1.5 text-sm">
              <span className="label-mono">{outcomes.length > 1 ? (needsText ? "What happened" : "Notes") : ask}</span>
              <textarea
                ref={field}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (state === "sent") setState("idle");
                }}
                required={needsText}
                minLength={needsText ? 5 : undefined}
                maxLength={1000}
                rows={3}
                placeholder={PLACEHOLDER[outcome]}
                aria-invalid={error ? true : undefined}
                className="input resize-y py-2.5 text-sm leading-relaxed"
              />
            </label>
            <p className="text-xs text-muted">Shown on this page. Don’t include secrets or personal details.</p>
          </>
        )}
        {error && (
          <p role="alert" className="form-error text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {outcome && (
            <button type="submit" className="btn btn-quiet btn-sm" disabled={state === "sending" || !ready}>
              {state === "sending" && <LoaderCircle size={14} className="spin" aria-hidden="true" />}
              {state === "sending" ? "Sending" : "Send"}
            </button>
          )}
          {state === "sent" && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-ok">
              <Check size={14} aria-hidden="true" />
              Thanks. It’s on this page now.
            </span>
          )}
        </div>
      </form>

      {reports.length > 0 && (
        <ul className="border-t border-rule">
          {reports.map((r) => {
            const o = outcomeOf(r);
            const { Icon, color } = OUTCOME_STYLE[o];
            return (
              <li key={r.id} className="grid gap-1 border-b border-rule py-3 text-sm">
                <p className="label-mono inline-flex flex-wrap items-center gap-x-1.5">
                  <Icon size={13} className={color} aria-hidden="true" />
                  <span className={color}>{OUTCOMES[o].label}</span>
                  {r.part && <span>· {r.part}</span>}
                  <span>
                    · {VIA[r.via]} · {formatDate(r.at)}
                  </span>
                </p>
                {r.message && <p className="text-ink [overflow-wrap:anywhere]">{r.message}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
