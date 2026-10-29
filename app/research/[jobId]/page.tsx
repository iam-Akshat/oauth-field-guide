import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DidYouMean } from "@/components/did-you-mean";
import { ResearchLive } from "@/components/research-live";
import { getJob } from "@/lib/research/jobs";

export async function generateMetadata({ params }: PageProps<"/research/[jobId]">): Promise<Metadata> {
  await connection();
  const { jobId } = await params;
  const job = getJob(jobId);
  return { title: job ? `Researching ${job.name}` : "Research not found" };
}

export default function ResearchPage({ params }: PageProps<"/research/[jobId]">) {
  return (
    <Suspense fallback={<div className="page pt-8" aria-label="Loading research" />}>
      <ResearchContent params={params} />
    </Suspense>
  );
}

async function ResearchContent({ params }: { params: PageProps<"/research/[jobId]">["params"] }) {
  await connection();
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) notFound();
  return (
    <>
      {job.corrected && <DidYouMean name={job.name} query={job.query} doing="researching" />}
      <ResearchLive job={job} />
    </>
  );
}
