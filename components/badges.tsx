import { Bot, Building2, CircleCheck, FileText, Sparkles, User } from "lucide-react";
import { ACTORS, CONFIDENCE, EVIDENCE, formatAge, formatDate, formatTime, QUALITY, STALE_AFTER_DAYS, TIERS } from "@/lib/meta";
import type { Actor, Evidence, GuideQuality, Source, Tier } from "@/lib/types";

/** Four bars; filled count = difficulty level. Never colour alone: always beside a label. */
export function DifficultyMeter({ tier }: { tier: Tier }) {
  const { level } = TIERS[tier];
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className="w-[5px] rounded-[1px]"
          style={{
            height: `${6 + n * 2}px`,
            background: n <= level ? `var(--color-tier-${level})` : "var(--color-rule-2)",
          }}
        />
      ))}
    </span>
  );
}

export function TierBadge({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "base" }) {
  const t = TIERS[tier];
  return (
    <span
      className={`inline-flex items-center gap-2 font-medium whitespace-nowrap text-ink ${size === "sm" ? "text-sm" : "text-base"}`}
      title={t.blurb}
    >
      <DifficultyMeter tier={tier} />
      <span>
        <span className="sr-only">Difficulty: </span>
        {t.label}
      </span>
    </span>
  );
}

/**
 * "Updated 28 Oct 2026 · today", amber past STALE_AFTER_DAYS. `at` (the exact
 * save time, when known) goes in the tooltip; `days` comes from the server.
 */
export function UpdatedAt({ date, at, days }: { date: string; at?: string; days: number }) {
  const stale = days > STALE_AFTER_DAYS;
  return (
    <time
      dateTime={at ?? date}
      title={at ? `Researched ${formatTime(at)}` : undefined}
      className={`font-mono text-xs tnum ${stale ? "text-warn" : "text-muted"}`}
    >
      Updated {formatDate(date)} · {formatAge(days)}
      {stale && ". May be out of date: research it again"}
    </time>
  );
}

const QUALITY_ICON = { verified: CircleCheck, researched: FileText, generated: Sparkles } as const;

export function QualityBadge({ quality }: { quality: GuideQuality }) {
  const Icon = QUALITY_ICON[quality];
  return (
    <span
      className={`label-mono inline-flex items-center gap-1.5 whitespace-nowrap ${quality === "verified" ? "!text-ok" : ""}`}
      title={QUALITY[quality].blurb}
    >
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {QUALITY[quality].label}
    </span>
  );
}

const ACTOR_ICON = { agent: Bot, you: User, provider: Building2 } as const;
const ACTOR_STYLE: Record<Actor, string> = {
  agent: "bg-accent-wash text-accent-strong border-transparent",
  you: "bg-paper-3 text-ink border-transparent",
  provider: "bg-paper text-muted border-rule-2",
};

export function ActorTag({ actor }: { actor: Actor }) {
  const Icon = ACTOR_ICON[actor];
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 font-mono text-xs font-medium tracking-wide whitespace-nowrap uppercase ${ACTOR_STYLE[actor]}`}
      title={ACTORS[actor].blurb}
    >
      <Icon size={12} strokeWidth={2.25} aria-hidden="true" />
      {ACTORS[actor].label}
    </span>
  );
}

/** "DOCS 1, 3 · LOW" linking to the cited sources. */
export function EvidenceChip({ evidence, sources }: { evidence: Evidence; sources: Source[] }) {
  const refs = evidence.sources
    .map((id) => ({ id, n: sources.findIndex((s) => s.id === id) + 1 }))
    .filter((r) => r.n > 0);
  const label = EVIDENCE[evidence.kind].label;
  const low = evidence.confidence !== "high";
  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-1.5 font-mono text-xs tracking-wide text-muted uppercase"
      title={`${EVIDENCE[evidence.kind].blurb} ${CONFIDENCE[evidence.confidence]}.`}
    >
      <span>{label}</span>
      {refs.length > 0 && (
        <span className="tnum">
          {refs.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <a href={`#source-${r.id}`} className="link !text-muted hover:!text-accent-strong" aria-label={`Source ${r.n}`}>
                {r.n}
              </a>
            </span>
          ))}
        </span>
      )}
      {low && (
        <span className={evidence.confidence === "low" ? "text-warn" : ""}>
          · {evidence.confidence}
          <span className="sr-only"> confidence</span>
        </span>
      )}
    </span>
  );
}
