import type { Guide } from "../../types";
import { COMPOSIO_SOURCES, d, ev, NONE, src } from "../../data/helpers";

export const github: Guide = {
  slug: "github",
  name: "GitHub",
  domain: "github.com",
  category: "Developer tools",
  summary:
    "Self-serve in under 30 minutes. GitHub doesn’t review OAuth Apps or GitHub Apps. The real decision is which of the two to build.",
  tier: "self-serve",
  tierReason:
    "No provider review before any GitHub user can connect. A Marketplace listing is optional and reviewed separately.",
  quality: "verified",
  updatedAt: "2026-10-24",
  composio: {
    status: "managed",
    toolkit: "GITHUB",
    note: "Composio has a managed GitHub app, so you can build today. Register your own before launch if you want your product’s name on the authorize screen or your own rate limits.",
  },
  totals: { effort: d(20, 40, "minutes"), wait: NONE, firstConnection: "Today" },
  stages: [
    {
      id: "build",
      name: "Build and test",
      whoCanConnect: "Any GitHub account, starting with yours",
      userSees: "GitHub’s authorize screen with your app name and requested scopes",
      effort: d(20, 40, "minutes"),
      wait: NONE,
      unlock: null,
      evidence: ev("tested", ["s1", "s6"]),
    },
    {
      id: "beta",
      name: "Limited beta",
      whoCanConnect: "Any GitHub user. Organization data may need an org owner’s approval",
      userSees: "The same screen. Members of restricted orgs see a “request access” option",
      effort: NONE,
      wait: NONE,
      unlock: null,
      evidence: ev("docs", ["s3"]),
    },
    {
      id: "launch",
      name: "Public launch",
      whoCanConnect: "Anyone with a GitHub account",
      userSees: "The same screen. No verification badge exists or is needed",
      effort: NONE,
      wait: NONE,
      unlock: null,
      evidence: ev("docs", ["s1", "s2"], "medium"),
    },
  ],
  requirements: [
    {
      id: "org",
      label: "A GitHub organization to own the app",
      detail:
        "Register under an organization, not a personal account, so the app survives staff changes. You need to be an owner of that org.",
      stage: "build",
      actor: "you",
      evidence: ev("docs", ["s1"], "medium"),
    },
    {
      id: "callback",
      label: "Callback URL from your Composio auth config",
      detail:
        "Copy it exactly. OAuth Apps accept a single callback URL; GitHub Apps accept several.",
      stage: "build",
      actor: "agent",
      evidence: ev("tested", ["s6", "s1"]),
    },
    {
      id: "homepage",
      label: "A public homepage URL",
      detail: "Any page that describes your product. GitHub links to it from the authorize screen.",
      stage: "build",
      actor: "agent",
      evidence: ev("docs", ["s1"]),
    },
  ],
  steps: [
    {
      id: "choose",
      title: "Choose OAuth App or GitHub App",
      actor: "agent",
      stage: "build",
      time: d(5, 10, "minutes"),
      detail:
        "OAuth Apps act as the user with coarse scopes like `repo`. GitHub Apps use fine-grained permissions and short-lived tokens, and orgs install them directly. Check which type your Composio toolkit expects before you register.",
      agentNote: "Recommends a type from the scopes your agent needs.",
      gotcha: "Switching type later means every user reconnects.",
      evidence: ev("docs", ["s2"]),
    },
    {
      id: "settings",
      title: "Open Developer settings in the owning org",
      actor: "you",
      stage: "build",
      time: d(2, 5, "minutes"),
      detail: "Organization → Settings → Developer settings → OAuth Apps (or GitHub Apps) → New.",
      agentNote: "An agent can drive the browser from here, but you sign in and approve 2FA.",
      evidence: ev("tested", ["s6"]),
    },
    {
      id: "register",
      title: "Fill in the registration form",
      actor: "agent",
      stage: "build",
      time: d(5, 5, "minutes"),
      detail: "Four fields. Users see the application name, so use your product’s name.",
      actions: [
        "Application name: your product name",
        "Homepage URL: your marketing site",
        "Authorization callback URL: from Composio",
        "Leave Device Flow off unless you need CLI sign-in",
      ],
      evidence: ev("tested", ["s6"]),
    },
    {
      id: "secret",
      title: "Generate and store the client secret",
      actor: "you",
      stage: "build",
      time: d(2, 2, "minutes"),
      detail:
        "GitHub shows the secret once. Paste it straight into Composio or your secret manager, not into chat, tickets or the repo.",
      evidence: ev("tested", ["s6"]),
    },
    {
      id: "auth-config",
      title: "Create the Composio auth config",
      actor: "agent",
      stage: "build",
      time: d(5, 5, "minutes"),
      detail:
        "Add your client ID, secret and scopes to a GitHub auth config. Toolkits you don’t override keep using Composio’s managed apps.",
      link: { label: "Composio: managed vs custom auth", url: COMPOSIO_SOURCES.customVsManaged.url },
      evidence: ev("docs", ["s4"]),
    },
    {
      id: "test",
      title: "Connect your own account and run one tool call",
      actor: "agent",
      stage: "build",
      time: d(5, 5, "minutes"),
      detail:
        "Confirms the callback URL, scopes and token exchange before anyone else sees the authorize screen.",
      evidence: ev("tested", ["s6"]),
    },
  ],
  scopes: {
    intro:
      "OAuth App scopes are coarse. If your agent only needs a few repos, a GitHub App with fine-grained permissions asks users for much less.",
    tiers: [
      {
        scope: "read:user user:email",
        grants: "Profile and verified email addresses",
        level: "basic",
        consequence: "No extra friction.",
      },
      {
        scope: "repo",
        grants: "Read and write access to every repo the user can reach, public and private",
        level: "sensitive",
        consequence: "No review, but users and org owners hesitate, and org restrictions apply.",
      },
      {
        scope: "admin:org",
        grants: "Manage org membership, teams and settings",
        level: "sensitive",
        consequence: "Expect org owners to refuse unless your product is an admin tool.",
      },
    ],
  },
  blockers: [
    {
      symptom: "Users connect but can’t see their organization’s private repos",
      cause: "The org restricts third-party OAuth app access and no owner has approved your app.",
      fix: "Ask users to request access on the authorize screen, or have an org owner approve it under Organization settings → Third-party access. GitHub Apps avoid this because the org installs them.",
      evidence: ev("docs", ["s3"]),
    },
    {
      symptom: "“The redirect_uri MUST match the registered callback URL”",
      cause: "The callback URL Composio sends doesn’t match the one you registered.",
      fix: "Copy the callback URL from the Composio auth config again, character for character, including the path.",
      evidence: ev("tested", ["s6"]),
    },
    {
      symptom: "Rate-limit errors once several users sync at once",
      cause: "Each user token has its own hourly limit, and polling burns it quickly.",
      fix: "Use webhooks or Composio triggers for changes and conditional requests for reads.",
      evidence: ev("docs", ["s2"], "medium"),
    },
  ],
  unknowns: [
    {
      question: "How long does a GitHub Marketplace review take?",
      why: "Only matters if you want a listing. GitHub doesn’t publish a review time.",
      resolve: "Ask in the GitHub partner program before you plan a launch around a listing.",
    },
  ],
  attempt: {
    date: "2026-10-20",
    by: "Setup agent in a signed-in browser, with a person for sign-in",
    outcome: "completed",
    summary:
      "Registered an OAuth App under a test org and completed a connection through a Composio auth config. The agent filled every form field; a person signed in and copied the secret.",
    log: [
      { step: "Sign in to GitHub", result: "handoff", note: "Person signed in and approved 2FA." },
      { step: "Open org Developer settings", result: "ok", note: "Reached the New OAuth App form." },
      { step: "Fill registration form", result: "ok", note: "All four fields filled by the agent." },
      { step: "Generate client secret", result: "handoff", note: "Shown once. Person pasted it into Composio." },
      {
        step: "Connect a test account",
        result: "corrected",
        note: "First try failed with a redirect mismatch: the callback had been copied with a trailing slash. Added the “copy exactly” note to step 3.",
      },
    ],
  },
  handoff: {
    agentCan: [
      "Recommend OAuth App or GitHub App from the scopes you need",
      "Fill the registration form once you’re signed in",
      "Create the Composio auth config",
      "Run a test connection and one tool call",
    ],
    youMust: [
      "Sign in and complete 2FA",
      "Be, or find, an owner of the org that owns the app",
      "Copy the client secret into Composio or your secret manager",
    ],
  },
  sources: [
    src("s1", {
      title: "Creating an OAuth app",
      url: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app",
      publisher: "GitHub Docs",
      kind: "official",
      checkedAt: null,
    }),
    src("s2", {
      title: "Differences between GitHub Apps and OAuth apps",
      url: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps",
      publisher: "GitHub Docs",
      kind: "official",
      checkedAt: null,
    }),
    src("s3", {
      title: "About OAuth app access restrictions",
      url: "https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions",
      publisher: "GitHub Docs",
      kind: "official",
      checkedAt: null,
    }),
    src("s4", COMPOSIO_SOURCES.customVsManaged),
    src("s5", COMPOSIO_SOURCES.managedList),
    src("s6", {
      title: "Setup attempt, 20 Oct 2026",
      url: "#attempt",
      publisher: "This guide",
      kind: "attempt",
      checkedAt: "2026-10-20",
    }),
  ],
};
