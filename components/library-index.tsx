"use client";

import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DifficultyMeter, QualityBadge, TierBadge } from "@/components/badges";
import { researchHref, startResearch } from "@/lib/client";
import { formatDate, formatDuration, TIER_ORDER, TIERS } from "@/lib/meta";
import type { CatalogEntry, GuideSummary, NoOAuthAnswer, Tier } from "@/lib/types";

type Filter = "all" | Tier;

const COLS = "md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]";

export function LibraryIndex({ guides, noOAuth, catalog }: { guides: GuideSummary[]; noOAuth: NoOAuthAnswer[]; catalog: CatalogEntry[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = text.trim().toLowerCase();
  const sorted = useMemo(
    // Unconfirmed (level 0) sorts last, not first.
    () => [...guides].sort((a, b) => (TIERS[a.tier].level || 9) - (TIERS[b.tier].level || 9) || a.name.localeCompare(b.name)),
    [guides],
  );
  const visible = sorted.filter(
    (g) =>
      (filter === "all" || g.tier === filter) &&
      (!q || g.name.toLowerCase().includes(q) || g.domain?.includes(q) || g.category.toLowerCase().includes(q)),
  );
  const queued = catalog.filter((c) => !q || c.name.toLowerCase().includes(q) || c.domain.includes(q));
  const none = noOAuth.filter((a) => !q || a.name.toLowerCase().includes(q) || a.domain?.includes(q));
  const lastUpdated = guides.reduce<string | null>((latest, g) => (!latest || g.updatedAt > latest ? g.updatedAt : latest), null);
  const counts = useMemo(() => {
    const c: Partial<Record<Filter, number>> = { all: guides.length };
    for (const g of guides) c[g.tier] = (c[g.tier] ?? 0) + 1;
    return c;
  }, [guides]);

  async function research(key: string, query: string) {
    if (pending) return;
    setPending(key);
    setError(null);
    try {
      router.push(researchHref(await startResearch(query), query));
    } catch (err) {
      setPending(null);
      setError(err instanceof Error ? err.message : "Research couldn’t start. Try again.");
    }
  }

  const filters: Filter[] = ["all", ...TIER_ORDER];

  return (
    <div className="grid gap-12">
      <section aria-labelledby="library-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="library-title" className="text-xl">
              Library
            </h2>
            <p className="mt-1 font-mono text-xs text-muted tnum">
              {guides.length} guide{guides.length === 1 ? "" : "s"} · {catalog.length} queued
              {lastUpdated && ` · last updated ${formatDate(lastUpdated)}`}
            </p>
          </div>
          {guides.length > 0 && (
            <label className="relative block sm:w-60">
              <span className="sr-only">Filter by name</span>
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Filter by name"
                className="input !min-h-9 !pl-9 text-sm"
              />
            </label>
          )}
        </div>
        {guides.length > 0 && (
          <div className="mt-5">
            <div role="group" aria-label="Filter by difficulty" className="flex flex-wrap gap-1.5">
              {filters.map((f) => {
                const selected = filter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilter(f)}
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-colors duration-[var(--dur-micro)] ${
                      selected
                        ? "border-accent bg-accent-wash text-accent-strong"
                        : "border-rule bg-paper text-ink-2 hover:border-rule-2"
                    }`}
                  >
                    {f !== "all" && <DifficultyMeter tier={f} />}
                    {f === "all" ? "All" : TIERS[f].label}
                    <span className="tnum text-xs text-muted">{counts[f] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-danger-wash px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 border-t border-rule-2">
          <div className={`hidden gap-4 border-b border-rule px-3 py-2.5 md:grid ${COLS}`} aria-hidden="true">
            {["App", "Difficulty", "Your work", "Waiting", "Guide"].map((h) => (
              <span key={h} className="label-mono">
                {h}
              </span>
            ))}
          </div>

          {guides.length === 0 ? (
            <p className="px-3 py-8 text-sm text-muted">
              No guides yet. Research an app above, or pick one from the queue.
            </p>
          ) : visible.length > 0 ? (
            <ul>
              {visible.map((g, i) => (
                <li key={g.slug} className="reveal border-b border-rule" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                  <Link
                    href={`/apps/${g.slug}`}
                    className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-3 py-4 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2 ${COLS}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                        <span className="truncate">{g.name}</span>
                        <ArrowRight
                          size={14}
                          className="shrink-0 -translate-x-1 text-accent opacity-0 transition-[opacity,transform] duration-[var(--dur-short)] group-hover:translate-x-0 group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="block truncate font-mono text-xs text-muted">
                        {g.domain ?? "domain not confirmed"} · {g.category}
                      </span>
                    </span>
                    <span className="justify-self-end md:justify-self-start">
                      <TierBadge tier={g.tier} />
                    </span>
                    <Metric label="Your work" value={formatDuration(g.totals.effort)} />
                    <Metric label="Waiting" value={formatDuration(g.totals.wait)} />
                    <span className="md:hidden">
                      <Metric label="Updated" value={formatDate(g.updatedAt)} />
                    </span>
                    <span className="hidden gap-1 md:grid">
                      <QualityBadge quality={g.quality} />
                      <span className="font-mono text-xs text-muted tnum">{formatDate(g.updatedAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid justify-items-start gap-3 px-3 py-10">
              <p className="font-medium text-ink">{q ? `No guides match “${text.trim()}”.` : "No guides at this difficulty yet."}</p>
              <div className="flex flex-wrap gap-2">
                {q && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => research("empty", text.trim())}>
                    {pending === "empty" && <LoaderCircle size={14} className="spin" aria-hidden="true" />}
                    Research “{text.trim()}”
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => {
                    setFilter("all");
                    setText("");
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </div>

      </section>

      {none.length > 0 && (
        <section aria-labelledby="no-oauth-title">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="no-oauth-title" className="text-lg">
              No OAuth
            </h2>
            <span className="font-mono text-xs text-muted tnum">{none.length === 1 ? "1 app" : `${none.length} apps`} research found no OAuth flow for</span>
          </div>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] border-t border-l border-rule sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]">
            {none.map((a) => (
              <li key={a.slug} className="border-r border-b border-rule">
                <Link
                  href={`/apps/${a.slug}`}
                  className="group flex h-full items-center justify-between gap-2 px-3 py-2.5 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink group-hover:text-accent-strong">{a.name}</span>
                    <span className="block truncate text-xs text-muted">{a.alternative ? `Try ${a.alternative}` : (a.domain ?? "No public OAuth")}</span>
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-muted group-hover:text-accent" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {queued.length > 0 && (
        <section aria-labelledby="queue-title">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="queue-title" className="text-lg">
              Queue
            </h2>
            <span className="font-mono text-xs text-muted tnum">{queued.length} OAuth apps without a guide</span>
          </div>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] border-t border-l border-rule sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]">
            {queued.map((c) => (
              <li key={c.slug} className="border-r border-b border-rule">
                <button
                  type="button"
                  onClick={() => research(c.slug, c.name)}
                  disabled={pending !== null}
                  aria-label={`Research ${c.name}`}
                  className="group flex h-full w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors duration-[var(--dur-micro)] hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink group-hover:text-accent-strong">{c.name}</span>
                    <span className="block truncate font-mono text-xs text-muted">{c.domain}</span>
                  </span>
                  {pending === c.slug ? (
                    <LoaderCircle size={14} className="spin shrink-0 text-accent" aria-hidden="true" />
                  ) : (
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-muted transition-[color,transform] duration-[var(--dur-short)] group-hover:translate-x-0.5 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-sm text-ink-2 tnum">
      <span className="text-muted md:sr-only">{label}: </span>
      {value}
    </span>
  );
}
