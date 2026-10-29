/**
 * Mock research agent. Produces the same event stream and Guide shape the real
 * agent will, on a timer, so the live UI can be built and demoed end to end.
 *
 * Test inputs:
 *   - a name or website           → generated guide, mostly "unconfirmed"
 *   - "notion", "zoom", "linkedin" → generated guide with a preset verdict
 *   - "openai", "anthropic"        → no-OAuth outcome
 *   - anything containing "fail"   → error mid-run
 *   - github, slack, xero, docusign, gmail, spotify
 *                                  → replays a run, then saves a detailed sample guide
 */
import { CATALOG } from "../data/catalog";
import { COMPOSIO_SOURCES, d, ev, NONE } from "../data/helpers";
import { formatDuration } from "../meta";
import type { ComposioStatus, EvidenceKind, Guide, SectionId, Source, Tier } from "../types";
import { docusign } from "./fixtures/docusign";
import { github } from "./fixtures/github";
import { google } from "./fixtures/google";
import { slack } from "./fixtures/slack";
import { spotify } from "./fixtures/spotify";
import { xero } from "./fixtures/xero";
import { type EventBody, type ResolvedQuery, resolveQuery } from "./resolve";

/** Detailed sample output for six apps. Written from memory and unverified: mock data only. */
const FIXTURES = new Map([github, slack, xero, docusign, google, spotify].map((g) => [g.slug, g]));

export type ScriptedEvent = { delay: number; event: EventBody };

export type ResearchPlan = {
  script: ScriptedEvent[];
  /** Saved just before the `done` event is emitted */
  guide: Guide | null;
};

type Preset = {
  tier: Tier;
  tierReason: string;
  summary: string;
  findings: { text: string; evidence: EvidenceKind }[];
};

const PRESETS: Record<string, Preset> = {
  notion: {
    tier: "self-serve",
    tierReason: "Public integrations need listing details but no review. Only the integration gallery is reviewed.",
    summary:
      "Public integrations are self-serve once you add company details and policies. Notion reviews only integrations that want a gallery listing.",
    findings: [
      { text: "Public integrations need a company name, website, privacy policy, terms and support email", evidence: "docs" },
      { text: "Users choose which pages to share during consent. Your agent sees only those", evidence: "docs" },
    ],
  },
  zoom: {
    tier: "reviewed",
    tierReason: "Other Zoom accounts can install only after a Marketplace review.",
    summary:
      "Build and test in your own Zoom account right away. Other accounts can install only after the app passes Zoom Marketplace review.",
    findings: [
      { text: "Unpublished apps can be used by your own account only", evidence: "docs" },
      { text: "Publishing requires a Marketplace submission with a security and functional review", evidence: "docs" },
    ],
  },
  linkedin: {
    tier: "gated",
    tierReason: "Most APIs beyond sign-in need product approval, and several require a registered business.",
    summary:
      "Sign In with LinkedIn is self-serve. Posting or reading organization data needs product approval, and some products require a registered business and a company page.",
    findings: [
      { text: "Each API product is requested separately in the developer portal", evidence: "docs" },
      { text: "Developers report long or unanswered access requests for marketing APIs", evidence: "community" },
    ],
  },
};

const NO_OAUTH: Record<string, { message: string; alternative?: string }> = {
  openai: {
    message:
      "We found no OAuth flow that lets a third-party app act on a user’s OpenAI account. The API uses API keys, so users would paste a key instead of connecting.",
  },
  anthropic: {
    message: "We found no OAuth flow for third-party apps. The Claude API uses API keys, so users would paste a key instead of connecting.",
  },
  "instagram-basic-display": {
    message:
      "Meta shut down the Instagram Basic Display API on 4 December 2024, so personal accounts can no longer be connected. Business and creator accounts connect through the Instagram API with Instagram Login.",
    alternative: "Instagram API with Instagram Login",
  },
};

const ddg = (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
const reddit = (q: string) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`;

function composioFinding(name: string, status: ComposioStatus): EventBody {
  if (status === "managed")
    return {
      type: "finding",
      text: `Composio provides a managed OAuth app for ${name}. You can build before registering your own`,
      evidence: "docs",
    };
  if (status === "byo")
    return {
      type: "finding",
      text: `${name} is on Composio’s bring-your-own list. You need your own OAuth app to test`,
      evidence: "docs",
    };
  return { type: "log", text: `${name} isn’t on Composio’s managed-auth list. The guide will be provider-only`, tone: "warn" };
}

/** A plausible run whose sources and findings come from the sample guide it ends with. */
function planFromFixture(r: ResolvedQuery, g: Guide): ResearchPlan {
  const script: ScriptedEvent[] = [];
  const at = (delay: number, event: EventBody) => script.push({ delay, event });
  const cite = (s: Source) => at(550, { type: "source", title: s.title, url: s.url });
  const official = g.sources.filter((s) => s.kind === "official");
  const community = g.sources.filter((s) => s.kind === "community" || s.kind === "search");
  const provider = g.name.split(" (")[0];
  const beta = g.stages[1];
  const launch = g.stages.at(-1)!;

  at(400, { type: "phase", phase: "identify" });
  at(500, { type: "log", text: `Resolving “${r.query}”` });
  at(900, { type: "finding", text: `${g.name}, at ${g.domain}`, evidence: "inferred" });

  g.sources.filter((s) => s.kind === "composio").forEach(cite);
  at(900, composioFinding(provider, g.composio.status));

  at(600, { type: "phase", phase: "portal" });
  official.slice(0, 3).forEach(cite);
  at(1000, { type: "log", text: "Found app registration docs" });

  at(600, { type: "phase", phase: "review" });
  official.slice(3).forEach(cite);
  at(1300, { type: "finding", text: g.tierReason, evidence: launch.evidence.kind });

  at(600, { type: "phase", phase: "limits" });
  if (beta) at(1300, { type: "finding", text: `${beta.name}: ${beta.whoCanConnect}`, evidence: beta.evidence.kind });

  at(600, { type: "phase", phase: "community" });
  community.forEach(cite);
  at(1300, {
    type: "finding",
    text: `Waiting on ${provider}: ${formatDuration(g.totals.wait).toLowerCase()}`,
    evidence: community.length ? "community" : launch.evidence.kind,
  });

  at(600, { type: "phase", phase: "draft" });
  for (const section of ["verdict", "stages", "requirements", "steps", "blockers", "unknowns", "sources"] as SectionId[])
    at(650, { type: "section", section });

  at(600, { type: "phase", phase: "verify" });
  at(900, { type: "log", text: `Re-reading ${g.sources.length} sources` });
  if (g.attempt) at(1200, { type: "log", text: `Setup attempt: ${g.attempt.outcome}` });

  at(700, { type: "done", slug: g.slug });
  return { script, guide: { ...g, updatedAt: new Date().toISOString().slice(0, 10) } };
}

export function planResearch(query: string, exact = false): ResearchPlan {
  const r = resolveQuery(query, { exact });
  const fixture = FIXTURES.get(r.slug);
  if (fixture && !query.toLowerCase().includes("fail")) return planFromFixture(r, fixture);

  const preset = PRESETS[r.slug];
  const composio: ComposioStatus = CATALOG.find((c) => c.slug === r.slug)?.composio ?? "unknown";
  const script: ScriptedEvent[] = [];
  const at = (delay: number, event: EventBody) => script.push({ delay, event });

  /* identify */
  at(400, { type: "phase", phase: "identify" });
  at(500, { type: "log", text: `Resolving “${r.query}”` });
  if (r.domain) {
    at(900, { type: "finding", text: `${r.name}, at ${r.domain}`, evidence: "inferred" });
  } else {
    at(900, { type: "log", text: `No website given. Treating “${r.name}” as the product name`, tone: "warn" });
  }

  at(500, { type: "source", title: COMPOSIO_SOURCES.managedList.title, url: COMPOSIO_SOURCES.managedList.url });
  at(900, composioFinding(r.name, composio));

  /* portal */
  at(600, { type: "phase", phase: "portal" });
  if (r.domain) at(500, { type: "source", title: `${r.name} homepage`, url: `https://${r.domain}` });
  at(700, { type: "source", title: `Search: ${r.name} developer OAuth app`, url: ddg(`${r.name} developer OAuth app`) });

  if (query.toLowerCase().includes("fail")) {
    at(1400, { type: "log", text: "Developer portal returned HTTP 403 to three requests in a row", tone: "warn" });
    at(800, {
      type: "error",
      message: `The agent couldn’t read ${r.name}’s developer portal: every request was refused (HTTP 403). Nothing was saved.`,
    });
    return { script, guide: null };
  }

  const noOauth = NO_OAUTH[r.slug];
  if (noOauth) {
    at(1200, { type: "log", text: "No OAuth authorization endpoint in the API reference", tone: "warn" });
    at(800, { type: "no-oauth", ...noOauth });
    return { script, guide: null };
  }

  at(1200, { type: "log", text: "Found app registration docs" });

  /* review */
  at(600, { type: "phase", phase: "review" });
  at(700, {
    type: "source",
    title: `Search: ${r.name} OAuth app review`,
    url: ddg(`${r.name} OAuth app review verification`),
  });
  if (preset) {
    for (const f of preset.findings) at(1300, { type: "finding", ...f });
  } else {
    at(1600, { type: "log", text: "No documented review requirement in the pages read", tone: "warn" });
    at(600, { type: "log", text: "Marking review as unconfirmed rather than assuming there is none" });
  }

  /* limits */
  at(600, { type: "phase", phase: "limits" });
  at(700, { type: "source", title: `Search: ${r.name} API user limits`, url: ddg(`${r.name} API OAuth user limit`) });
  at(1500, { type: "log", text: "No user or connection cap documented", tone: "warn" });

  /* community */
  at(600, { type: "phase", phase: "community" });
  at(700, { type: "source", title: `Developer reports: ${r.name} OAuth`, url: reddit(`${r.name} oauth app`) });
  at(1600, { type: "log", text: "Read 6 threads. None describe a review wait" });

  /* draft */
  at(600, { type: "phase", phase: "draft" });
  const sections: SectionId[] = ["verdict", "stages", "requirements", "steps", "blockers", "unknowns", "sources"];
  for (const section of sections) at(650, { type: "section", section });

  /* verify */
  at(600, { type: "phase", phase: "verify" });
  at(900, { type: "log", text: "Re-reading 4 sources to check 9 claims" });
  at(1500, { type: "log", text: "7 supported. 2 downgraded to low confidence" });

  const guide = buildGuide(r, preset, composio);
  at(700, { type: "done", slug: guide.slug });
  return { script, guide };
}

function buildGuide(r: ResolvedQuery, preset: Preset | undefined, composio: ComposioStatus): Guide {
  const sources: Source[] = [];
  const add = (s: Omit<Source, "id">) => {
    const id = `s${sources.length + 1}`;
    sources.push({ id, ...s });
    return id;
  };

  const home = r.domain
    ? add({ title: `${r.name} homepage`, url: `https://${r.domain}`, publisher: r.domain, kind: "official", checkedAt: null })
    : null;
  const portal = add({
    title: `Search: ${r.name} developer OAuth app`,
    url: ddg(`${r.name} developer OAuth app`),
    publisher: "Web search",
    kind: "search",
    checkedAt: null,
  });
  const review = add({
    title: `Search: ${r.name} OAuth app review`,
    url: ddg(`${r.name} OAuth app review verification`),
    publisher: "Web search",
    kind: "search",
    checkedAt: null,
  });
  const reports = add({
    title: `Developer reports: ${r.name} OAuth`,
    url: reddit(`${r.name} oauth app`),
    publisher: "Reddit search",
    kind: "search",
    checkedAt: null,
  });
  const catalog = add(COMPOSIO_SOURCES.managedList);
  const portalRefs = home ? [portal, home] : [portal];

  const composioNote: Record<ComposioStatus, string> = {
    managed: `Composio has a managed ${r.name} app, so you can build today. Register your own before launch to put your name on the consent screen.`,
    byo: `Composio has no managed ${r.name} app. You need your own before you can test.`,
    unknown: `${r.name} wasn’t on Composio’s managed-auth list. Check whether a Composio toolkit exists before building on it.`,
  };

  return {
    slug: r.slug,
    name: r.name,
    domain: r.domain,
    category: "Uncategorized",
    summary:
      preset?.summary ??
      `Registering a ${r.name} OAuth app looks self-serve, but the agent couldn’t confirm whether ${r.name} reviews apps before other people can connect. Plan for a review until you confirm otherwise.`,
    tier: preset?.tier ?? "unknown",
    tierReason: preset?.tierReason ?? "No documentation either way on review, user caps or verification.",
    quality: "generated",
    updatedAt: new Date().toISOString().slice(0, 10),
    composio: { status: composio, note: composioNote[composio] },
    totals: { effort: null, wait: null, firstConnection: "Likely today, with your own account" },
    stages: [
      {
        id: "build",
        name: "Your account",
        whoCanConnect: "Your own account",
        userSees: `${r.name}’s consent screen`,
        effort: d(30, 60, "minutes"),
        wait: NONE,
        unlock: "Unconfirmed. Test with a second account you don’t own",
        evidence: ev("inferred", portalRefs, "low"),
      },
      {
        id: "beta",
        name: "Other accounts",
        whoCanConnect: "Unconfirmed",
        userSees: "Unconfirmed",
        effort: null,
        wait: null,
        unlock: null,
        evidence: ev("inferred", [review], "low"),
      },
      {
        id: "launch",
        name: "Public launch",
        whoCanConnect: "Unconfirmed",
        userSees: "Unconfirmed",
        effort: null,
        wait: null,
        unlock: null,
        evidence: ev("inferred", [review, reports], "low"),
      },
    ],
    requirements: [
      {
        id: "account",
        label: `A ${r.name} developer account`,
        detail: "Use a company login, so the app doesn’t belong to one person.",
        stage: "build",
        actor: "you",
        evidence: ev("inferred", portalRefs, "medium"),
      },
      {
        id: "redirect",
        label: "Redirect URI from your Composio auth config",
        detail: "Copy it exactly.",
        stage: "build",
        actor: "agent",
        evidence: ev("inferred", [catalog], "medium"),
      },
      {
        id: "policies",
        label: "A homepage and privacy policy",
        detail: "Most providers ask for both before other people can connect.",
        stage: "launch",
        actor: "agent",
        evidence: ev("inferred", [review], "low"),
      },
    ],
    steps: [
      {
        id: "signup",
        title: `Create a ${r.name} developer account`,
        actor: "you",
        stage: "build",
        time: d(5, 15, "minutes"),
        detail: "Sign in with a company login.",
        evidence: ev("inferred", portalRefs, "medium"),
      },
      {
        id: "register",
        title: "Register an OAuth application",
        actor: "agent",
        stage: "build",
        time: d(10, 20, "minutes"),
        detail: "App name, homepage, the redirect URI from Composio, and the scopes your agent needs.",
        agentNote: "You sign in; the agent fills the form.",
        evidence: ev("inferred", portalRefs, "medium"),
      },
      {
        id: "secret",
        title: "Store the client secret",
        actor: "you",
        stage: "build",
        time: d(2, 2, "minutes"),
        detail: "Paste it straight into Composio or your secret manager.",
        evidence: ev("inferred", portalRefs, "high"),
      },
      {
        id: "connect",
        title: "Connect your own account through Composio",
        actor: "agent",
        stage: "build",
        time: d(10, 15, "minutes"),
        detail: "Confirms the redirect URI, scopes and token exchange.",
        evidence: ev("inferred", [catalog], "medium"),
      },
      {
        id: "second-account",
        title: "Connect an account you don’t own",
        actor: "agent",
        stage: "beta",
        time: d(15, 30, "minutes"),
        detail: `The quickest way to learn whether ${r.name} limits unreviewed apps to their owner.`,
        gotcha: "If it fails, look for a publish, distribution or production switch in the app settings.",
        evidence: ev("inferred", [review], "low"),
      },
      {
        id: "submit",
        title: "Submit for review, if required",
        actor: "you",
        stage: "launch",
        time: null,
        detail: "Unconfirmed. Re-run research once you’ve seen the app settings.",
        evidence: ev("inferred", [review, reports], "low"),
      },
    ],
    blockers: [
      {
        symptom: "Redirect URI mismatch during connect",
        cause: "The URI Composio sends doesn’t match the one registered.",
        fix: "Copy the URI from the Composio auth config again, exactly.",
        evidence: ev("inferred", [catalog], "medium"),
      },
      {
        symptom: "Your account connects but nobody else’s does",
        cause: "The app is probably limited to its owner until published or reviewed.",
        fix: "Look for a publish or distribution setting, then re-run research with what you find.",
        evidence: ev("inferred", [review], "low"),
      },
    ],
    unknowns: [
      {
        question: `Does ${r.name} review OAuth apps before the public can connect?`,
        why: "Nothing in the pages read says either way.",
        resolve: "Connect an account you don’t own, or ask the provider’s developer support.",
      },
      {
        question: "Are there user, connection or rate caps before review?",
        why: "No limits page found.",
        resolve: "Check the app settings page after registering.",
      },
      {
        question: "Which scopes need extra approval?",
        why: "No scope classification found.",
        resolve: "Request the narrowest scopes first and note any approval prompts.",
      },
    ],
    handoff: {
      agentCan: [
        "Fill the registration form once you’re signed in",
        "Create the Composio auth config and test the connection",
        "Test with a second account to find hidden limits",
      ],
      youMust: ["Sign in and own the developer account", "Store the client secret", "Submit for any review"],
    },
    sources,
  };
}
