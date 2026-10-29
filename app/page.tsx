import { Suspense } from "react";
import { AgentAccess } from "@/components/agent-access";
import { LibraryIndex } from "@/components/library-index";
import { ResearchForm } from "@/components/research-form";
import { origin } from "@/lib/origin";
import { listCatalog, listGuides, listNoOAuth } from "@/lib/repo";

export default function Home() {
  return (
    <>
      <section className="band-graphite" aria-labelledby="intro-title">
        <div className="page grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-16 lg:py-16">
          <div className="reveal" style={{ "--i": 0 } as React.CSSProperties}>
            <h1 id="intro-title" className="text-2xl sm:text-display">
              How long until your users can connect?
            </h1>
            <p className="mt-4 max-w-[52ch] text-graphite-muted">
              Name an app. An agent maps its OAuth approval path and saves a guide your agent can follow.
            </p>
            <div className="mt-8 max-w-[36rem]">
              <ResearchForm />
            </div>
          </div>
          <div className="reveal min-w-0" style={{ "--i": 1 } as React.CSSProperties}>
            <Suspense fallback={<div className="skeleton h-44 rounded-lg" />}>
              <HomeAccess />
            </Suspense>
          </div>
        </div>
      </section>

      <div id="library" className="page pt-12 pb-20">
        <Suspense fallback={<LibrarySkeleton />}>
          <Library />
        </Suspense>
      </div>
    </>
  );
}

async function HomeAccess() {
  const base = await origin();
  return (
    <AgentAccess
      nested
      tabs={[
        {
          id: "mcp",
          label: "MCP",
          code: `claude mcp add --transport http oauth-guide ${base}/api/mcp`,
          note: "Tools: get_guide, research_app, research_status, list_guides, report_problem.",
        },
        { id: "cli", label: "CLI", code: "npx oauth-guide spotify --prompt", note: "Researches the app first if there's no guide. Pipe it to claude -p." },
        { id: "llms", label: "llms.txt", code: `curl ${base}/llms.txt`, note: "Index of every guide, as Markdown links." },
      ]}
    />
  );
}

async function Library() {
  const [guides, noOAuth, catalog] = await Promise.all([listGuides(), listNoOAuth(), listCatalog()]);
  return <LibraryIndex guides={guides} noOAuth={noOAuth} catalog={catalog} />;
}

function LibrarySkeleton() {
  return (
    <div aria-label="Loading library" className="grid gap-3">
      <div className="skeleton h-7 w-32" />
      <div className="mt-4 grid gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-12" />
        ))}
      </div>
    </div>
  );
}
