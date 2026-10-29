/**
 * What the research agent returns. The JSON Schema sent as the agent's
 * structured output is generated from this, and the result is parsed with it
 * again before anything is saved. Descriptions double as instructions.
 */
import { z } from "zod";

const sourceIds = z.array(z.string()).describe('Ids from `sources` that support this, e.g. ["s1", "s4"].');

const evidence = z
  .object({
    kind: z
      .enum(["docs", "community", "inferred"])
      .describe("docs: the provider's official docs say so. community: developers report it. inferred: your reasoning."),
    sources: sourceIds,
    confidence: z.enum(["high", "medium", "low"]),
  })
  .describe("What backs this claim.");

const duration = z
  .object({
    min: z.number().min(0),
    max: z.number().min(0),
    unit: z.enum(["minutes", "hours", "days", "weeks"]),
  })
  .nullable()
  .describe("A range. null when research couldn't establish it. Never guess.");

const actor = z
  .enum(["agent", "you", "provider"])
  .describe("agent: an AI agent can do it once a person is signed in. you: needs a person. provider: waiting on the provider.");

const stageId = z.enum(["build", "beta", "launch"]);

const guide = z.object({
  name: z.string().describe("The app's name as developers say it: Gmail, Spotify, X, Slack. Not the API's product name (not \"Spotify Web API\")."),
  domain: z.string().nullable().describe("The provider's main domain, e.g. slack.com."),
  category: z.string().describe("Two or three words, e.g. Team chat, Accounting, CRM."),
  summary: z.string().describe("Two sentences: how hard it is to reach public launch, and why."),
  tier: z.enum(["self-serve", "capped", "reviewed", "gated", "unknown"]),
  tierReason: z.string().describe("One sentence on what puts it in this tier."),
  composio: z
    .object({
      status: z.enum(["managed", "byo", "unknown"]),
      toolkit: z.string().nullable().describe("Composio toolkit slug, if confirmed."),
      note: z
        .string()
        .describe(
          'One or two sentences addressed to developers who use Composio, e.g. "Composio has a managed app, so you can prototype before registering your own. Register your own before launch so your name is on the consent screen."',
        ),
    })
    .describe("An optional tip for Composio users. The rest of the guide doesn't depend on it."),
  registration: z.object({
    model: z
      .enum(["global", "per-tenant"])
      .describe(
        "global: you register once and any customer connects to that app. per-tenant: each customer's admin registers your app in their own instance, workspace, server or subdomain.",
      ),
    note: z.string().describe("One or two sentences: who registers the app, and what you collect from each customer."),
    evidence,
  }),
  grants: z
    .array(
      z.object({
        name: z.string().describe('e.g. "Authorization code", "Client credentials", "JWT bearer".'),
        fits: z
          .string()
          .describe(
            'One or two sentences: the integration it fits (acting as a signed-in user, or a background service with no user), what it needs, and whether the steps use it.',
          ),
        evidence,
      }),
    )
    .describe("Every OAuth grant the provider supports for third-party apps. The steps cover the one a typical integration needs."),
  totals: z.object({
    effort: duration.describe("Total hands-on work to reach public launch."),
    wait: duration.describe("Total calendar time waiting on the provider."),
    firstConnection: z.string().describe('When the developer\'s own account can first connect, e.g. "Today, in about 30 minutes".'),
  }),
  stages: z
    .array(
      z.object({
        id: stageId,
        name: z.string().describe('Short, e.g. "Your workspace", "Test users", "Public launch".'),
        whoCanConnect: z.string(),
        userSees: z.string().describe("What a connecting user sees, e.g. an unverified-app warning."),
        effort: duration,
        wait: duration,
        unlock: z.string().nullable().describe("What moves you to the next stage. null for the last stage."),
        evidence,
      }),
    )
    .describe("build and launch always; beta only when there's a stage between them."),
  requirements: z
    .array(
      z.object({
        id: z.string().describe("kebab-case, unique."),
        label: z.string(),
        detail: z.string(),
        stage: stageId,
        actor,
        evidence,
      }),
    )
    .describe("What must exist before starting: accounts, policies, a company, a domain, a demo video."),
  steps: z
    .array(
      z.object({
        id: z.string().describe("kebab-case, unique."),
        title: z.string().describe("Imperative, under 60 characters."),
        actor,
        stage: stageId,
        time: duration.describe("Hands-on time, or the wait when actor is provider."),
        detail: z.string(),
        actions: z.array(z.string()).nullable().describe("Concrete sub-steps, fields to fill or settings to change."),
        agentNote: z.string().nullable().describe("What an agent can do here, and where it hands back to a person."),
        gotcha: z.string().nullable().describe("A common mistake at this step."),
        link: z.object({ label: z.string(), url: z.string() }).nullable().describe("The page where this step happens."),
        image: z
          .object({
            url: z.string().describe("The image's absolute URL, exactly as it appears on the page. Never build or guess one."),
            alt: z.string().describe("What the screenshot shows, e.g. “Create OAuth app form”."),
            source: z.string().describe("Id of the source page the image is on. That page must be one you fetched."),
          })
          .nullable()
          .describe("A screenshot from the provider's docs of the screen this step happens on. null when there isn't one. Not logos or diagrams."),
        evidence,
      }),
    )
    .describe("In the order they happen."),
  scopes: z
    .object({
      intro: z.string(),
      tiers: z.array(
        z.object({
          scope: z.string(),
          grants: z.string(),
          level: z.enum(["basic", "sensitive", "restricted"]),
          consequence: z.string().describe("What requesting it triggers: nothing, a review, an audit."),
        }),
      ),
    })
    .nullable()
    .describe("Only if the provider classifies scopes and it changes the approval path."),
  blockers: z.array(
    z.object({
      symptom: z.string().describe("What the developer sees, e.g. an error message."),
      cause: z.string(),
      fix: z.string(),
      evidence,
    }),
  ),
  unknowns: z
    .array(
      z.object({
        question: z.string(),
        why: z.string().describe("Why research couldn't settle it."),
        resolve: z.string().describe("How the developer can find out."),
      }),
    )
    .describe("Everything you couldn't confirm. Better here than guessed elsewhere."),
  handoff: z.object({
    agentCan: z.array(z.string()),
    youMust: z.array(z.string()),
  }),
  sources: z
    .array(
      z.object({
        id: z.string().describe("s1, s2, … in the order added."),
        title: z.string(),
        url: z.string().describe("Full https URL."),
        publisher: z.string().describe('e.g. "Slack API docs", "Stack Overflow".'),
        kind: z
          .enum(["official", "composio", "community", "search"])
          .describe("official: the provider's site. composio: Composio's docs. search: only seen in search results."),
      }),
    )
    .describe("Only pages you fetched or saw in search results."),
});

export const agentOutput = z.object({
  outcome: z
    .enum(["guide", "no-oauth"])
    .describe("no-oauth when third-party apps can't use OAuth to act on a user's account (API keys only, for example)."),
  noOAuth: z
    .object({
      reason: z.string().describe("Two sentences: what you found, and how users would connect instead."),
      alternative: z
        .string()
        .nullable()
        .describe(
          'A related API that does let third-party apps use OAuth, to research instead: the replacement for a shut-down API, or the same company\'s OAuth product. Its name as a developer would search for it, e.g. "Instagram API with Instagram Login". null when there isn\'t one.',
        ),
      sources: z.array(z.object({ title: z.string(), url: z.string() })).describe("Pages you fetched that show it."),
    })
    .nullable()
    .describe("For no-oauth: what you found. Otherwise null."),
  guide: guide.nullable().describe("The guide. null for no-oauth."),
});

export type AgentOutput = z.infer<typeof agentOutput>;
export type GuideDraft = z.infer<typeof guide>;

export const agentOutputJsonSchema: Record<string, unknown> = z.toJSONSchema(agentOutput);
// The Agent SDK's validator doesn't load the draft 2020-12 meta-schema this points at.
delete agentOutputJsonSchema.$schema;
