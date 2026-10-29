"use client";

import { ArrowRight, LoaderCircle, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { researchHref, startResearch } from "@/lib/client";

type Props = { query: string; label: string; force?: boolean; primary?: boolean; small?: boolean };

/**
 * Starts research for `query` and goes to the live run, or straight to the
 * saved result when there is one (unless `force`).
 */
export function ResearchButton({ query, label, force = false, primary = false, small = false }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");

  async function run() {
    setState("pending");
    try {
      router.push(researchHref(await startResearch(query, { force }), query));
    } catch {
      setState("failed");
    }
  }

  const Icon = force ? RotateCw : ArrowRight;
  return (
    <button
      type="button"
      className={`btn max-w-full ${primary ? "btn-primary" : "btn-quiet"} ${small ? "btn-sm" : ""}`}
      onClick={run}
      disabled={state === "pending"}
    >
      {state === "pending" && <LoaderCircle size={14} className="spin shrink-0" aria-hidden="true" />}
      {force && state !== "pending" && <Icon size={14} className="shrink-0" aria-hidden="true" />}
      <span className="min-w-0 truncate">{state === "pending" ? "Starting" : state === "failed" ? "Couldn’t start. Retry" : label}</span>
      {!force && state !== "pending" && <Icon size={14} className="shrink-0" aria-hidden="true" />}
    </button>
  );
}

/** Re-run research and replace this guide or answer when it finishes. */
export function ResearchAgain({ query }: { query: string }) {
  return <ResearchButton query={query} label="Research again" force small />;
}
