import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ActorTag, QualityBadge, TierBadge } from "@/components/badges";
import { ACTORS, EVIDENCE, QUALITY, REGISTRATION, TIER_ORDER, TIERS } from "@/lib/meta";
import type { Actor, EvidenceKind, GuideQuality } from "@/lib/types";

export const metadata: Metadata = {
  title: "How guides work",
  description: "How guides rate difficulty, separate effort from waiting, tag who does each step and cite evidence.",
};

export default function MethodPage() {
  return (
    <div className="page pt-10">
      <div className="max-w-[46rem]">
        <h1 className="text-2xl">How guides work</h1>
        <p className="mt-3 text-ink-2">
          Users connect through an OAuth app you register with each provider. A guide says how far that app is from
          “anyone can connect”, and what stands in the way.
        </p>

        <Block title="Difficulty" intro="The path to public launch, not the coding. Depends on the scopes you request.">
          <dl className="grid gap-5 border-t border-rule pt-5">
            {TIER_ORDER.map((t) => (
              <Def key={t} term={<TierBadge tier={t} size="base" />}>
                {TIERS[t].blurb}
              </Def>
            ))}
            <Def term={<TierBadge tier="unknown" size="base" />}>{TIERS.unknown.blurb}</Def>
            <Def term={<span className="label-mono">{REGISTRATION["per-tenant"].label}</span>}>
              {REGISTRATION["per-tenant"].blurb} Separate from difficulty: ServiceNow is self-serve, but every customer sets you up.
            </Def>
          </dl>
        </Block>

        <Block title="Time">
          <dl className="grid gap-5 border-t border-rule pt-5">
            <Def term="Your work">Hands-on time. Agents can shrink it.</Def>
            <Def term="Waiting">Provider review time. You can’t shrink it much.</Def>
            <Def term="Unknown">Shown instead of a guess.</Def>
          </dl>
        </Block>

        <Block title="Who does each step">
          <dl className="grid gap-5 border-t border-rule pt-5">
            {(Object.keys(ACTORS) as Actor[]).map((a) => (
              <Def key={a} term={<ActorTag actor={a} />}>
                {ACTORS[a].blurb}
              </Def>
            ))}
          </dl>
        </Block>

        <Block
          title="Evidence"
          intro="Every claim is tagged. Numbers link to sources; low confidence is marked. A tag needs a page the agent actually read, or the claim drops to Inferred."
        >
          <dl className="grid gap-5 border-t border-rule pt-5">
            {(Object.keys(EVIDENCE) as EvidenceKind[]).map((k) => (
              <Def key={k} term={<span className="label-mono">{EVIDENCE[k].label}</span>}>
                {EVIDENCE[k].blurb}
              </Def>
            ))}
          </dl>
        </Block>

        <Block title="Guide quality">
          <dl className="grid gap-5 border-t border-rule pt-5">
            {(Object.keys(QUALITY) as GuideQuality[]).map((q) => (
              <Def key={q} term={<QualityBadge quality={q} />}>
                {QUALITY[q].blurb}
              </Def>
            ))}
          </dl>
        </Block>

        <Block title="For agents">
          <dl className="grid gap-5 border-t border-rule pt-5">
            <Def term={<code className="font-mono text-sm">/api/mcp</code>}>
              MCP server. Tools: <code className="font-mono">get_guide</code>, <code className="font-mono">research_app</code>,{" "}
              <code className="font-mono">research_status</code>, <code className="font-mono">list_guides</code>,{" "}
              <code className="font-mono">report_problem</code>, <code className="font-mono">report_setup</code>.
            </Def>
            <Def term={<code className="font-mono text-sm">/apps/:slug.md</code>}>The guide as Markdown. Or send <code className="font-mono">Accept: text/markdown</code>.</Def>
            <Def term={<code className="font-mono text-sm">/llms.txt</code>}>Index of every guide.</Def>
            <Def term={<code className="font-mono text-sm">?format=prompt</code>}>
              On <code className="font-mono">/api/guides/:slug</code>: steps an agent can act on, with stops for you.
            </Def>
          </dl>
          <p className="mt-6 text-sm">
            <Link href="/#library" className="link">
              Back to the library
            </Link>
          </p>
        </Block>
      </div>
    </div>
  );
}

function Block({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="pt-10">
      <h2 className="text-xl">{title}</h2>
      {intro && <p className="mt-2 mb-5 text-sm text-muted">{intro}</p>}
      <div className={intro ? "" : "mt-5"}>{children}</div>
    </section>
  );
}

function Def({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="font-medium text-ink">{term}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
