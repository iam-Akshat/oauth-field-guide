import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { GuideView } from "@/components/guide/guide-view";
import { agentBrief } from "@/lib/markdown";
import { origin } from "@/lib/origin";
import { DidYouMean } from "@/components/did-you-mean";
import { NoOAuthView } from "@/components/no-oauth-view";
import { getGuide, getNoOAuth, matchApp, reportsSince } from "@/lib/repo";

export async function generateMetadata({ params }: PageProps<"/apps/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (guide) return { title: `${guide.name} OAuth setup`, description: guide.summary };
  const answer = await getNoOAuth(slug);
  if (answer) return { title: `${answer.name}: no OAuth`, description: answer.reason };
  return { title: "Guide not found" };
}

export default function GuidePage({ params, searchParams }: PageProps<"/apps/[slug]">) {
  return (
    <Suspense fallback={<GuideSkeleton />}>
      <GuideContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function GuideContent({ params, searchParams }: Pick<PageProps<"/apps/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  const answer = guide ? null : await getNoOAuth(slug);
  if (!guide && !answer) {
    // A near miss such as /apps/calandly goes to the guide (or answer) it nearly names.
    const hit = matchApp(slug);
    if (hit) redirect(`/apps/${(hit.guide ?? hit.answer).slug}${hit.near ? `?q=${encodeURIComponent(slug)}` : ""}`);
    notFound();
  }
  // Set when search matched a typo or nickname to this guide.
  const q = (await searchParams).q;
  const typed = typeof q === "string" ? q.trim().slice(0, 120) : "";
  const name = (guide ?? answer)!.name;
  const reports = reportsSince(slug);
  const base = await origin();
  return (
    <>
      {typed && <DidYouMean name={name} query={typed} doing="showing" />}
      {guide ? (
        <GuideView guide={guide} base={base} brief={agentBrief(guide, `${base}/apps/${guide.slug}`, reports)} reports={reports} />
      ) : (
        <NoOAuthView answer={answer!} reports={reports} />
      )}
    </>
  );
}

function GuideSkeleton() {
  return (
    <div className="page pt-8" aria-label="Loading guide">
      <div className="skeleton h-4 w-40" />
      <div className="mt-8 max-w-[50rem]">
        <div className="skeleton h-12 w-2/3" />
        <div className="mt-3 skeleton h-4 w-48" />
        <div className="mt-8 flex gap-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10 w-28" />
          ))}
        </div>
        <div className="mt-12 skeleton h-6 w-full" />
        <div className="mt-2 skeleton h-6 w-4/5" />
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      </div>
    </div>
  );
}
