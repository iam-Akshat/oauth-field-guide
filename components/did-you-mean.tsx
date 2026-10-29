"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { researchHref, startResearch } from "@/lib/client";

type Props = {
  /** The known app the query was matched to */
  name: string;
  /** What the person typed */
  query: string;
  doing: "showing" | "researching";
};

/** Shown when search matched a typo or nickname to a known app. Offers the query exactly as typed. */
export function DidYouMean({ name, query, doing }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");
  const label = query.length > 40 ? `${query.slice(0, 39)}…` : query;

  async function searchInstead() {
    setState("pending");
    try {
      router.push(researchHref(await startResearch(query, { exact: true }), query));
    } catch {
      setState("failed");
    }
  }

  return (
    <aside aria-label="Search correction" className="border-b border-rule bg-accent-wash">
      <p className="page flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-sm">
        <span className="font-medium text-ink">Did you mean {name}?</span>
        <span className="min-w-0 text-ink-2 [overflow-wrap:anywhere]">
          {doing === "showing" ? "Showing its guide" : "Researching it"} for “{label}”.
        </span>
        <button
          type="button"
          onClick={searchInstead}
          disabled={state === "pending"}
          className="link inline-flex max-w-full items-center gap-1.5 disabled:cursor-wait disabled:opacity-60"
        >
          {state === "pending" && <LoaderCircle size={13} className="spin shrink-0" aria-hidden="true" />}
          <span className="truncate">
            {state === "failed" ? `Couldn’t start. Retry “${label}”` : `Search for “${label}” instead`}
          </span>
        </button>
      </p>
    </aside>
  );
}
