import Link from "next/link";
import { connection } from "next/server";
import { CommandPalette } from "@/components/command-palette";
import { AGENT_MODE } from "@/lib/research/mode";

/** Shown only when the mock agent is running. Read per request, so the deployed env decides. */
export async function SampleBanner() {
  await connection();
  if (AGENT_MODE !== "mock") return null;
  return (
    <div className="border-b border-rule bg-paper-2">
      <p className="page flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-xs text-ink-2">
        <span className="label-mono !text-warn">Mock backend</span>
        <span>
          The research agent is simulated and guide content is sample data. Don’t act on it. Set ANTHROPIC_API_KEY to run real research.
        </span>
      </p>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-rule bg-paper/90 backdrop-blur-md">
      <div className="page flex h-16 items-center gap-3 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-base font-semibold whitespace-nowrap text-ink">
          <span className="size-2.5 rounded-[2px] bg-accent" aria-hidden="true" />
          OAuth Field Guide
        </Link>
        <div className="flex flex-1 justify-end sm:justify-center">
          <CommandPalette />
        </div>
        <nav aria-label="Primary" className="flex shrink-0 items-center gap-1 sm:gap-4">
          <Link href="/method" className="hidden px-2 text-sm whitespace-nowrap text-ink-2 hover:text-ink md:inline">
            How guides work
          </Link>
          <Link href="/#research" className="btn btn-primary btn-sm hidden sm:inline-flex">
            Research an app
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="page flex flex-col gap-3 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Every claim cites a source. Check the provider’s current docs before you submit.</p>
        <nav aria-label="Footer" className="flex shrink-0 gap-5">
          <Link href="/method" className="whitespace-nowrap hover:text-ink">
            How guides work
          </Link>
          <a href="/llms.txt" className="whitespace-nowrap hover:text-ink">
            llms.txt
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- JSON endpoint, not a page */}
          <a href="/api/guides" className="whitespace-nowrap hover:text-ink">
            JSON API
          </a>
        </nav>
      </div>
    </footer>
  );
}
