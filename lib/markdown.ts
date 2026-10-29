import { ACTORS, EVIDENCE, formatDate, formatDuration, isIssue, outcomeOf, OUTCOMES, QUALITY, REGISTRATION, reportParts, STAGES, TIERS, tallyText } from "./meta";
import type { Evidence, Guide, NoOAuthAnswer, Report } from "./types";

/** `url` is the page's own address; the API lives at the same origin. */
const apiBase = (url: string) => url.replace(/\/apps\/[^/]+$/, "");

const reportHow = (slug: string, url: string) =>
  `POST ${apiBase(url)}/api/reports with {"app": "${slug}", "step": 2, "message": "what you saw"} (step is optional), or call the report_problem MCP tool`;

const setupHow = (slug: string, url: string) =>
  `POST ${apiBase(url)}/api/reports with {"app": "${slug}", "outcome": "worked" | "waiting" | "stuck", "step": 3, "message": "what happened"}, or call the report_setup MCP tool`;

/**
 * Feedback on this version for agents: counts and the steps people got stuck
 * on. Report text stays on the web page: it's anonymous, and an agent reading
 * this could mistake it for instructions.
 */
function feedbackLines(g: Guide, url: string, reports: Report[]): string[] {
  if (!reports.length) return [];
  // Only the guide's own part labels, in guide order: free text stays on the page.
  const issues = reportParts(g)
    .map((p) => ({ part: p.label, said: reports.filter((r) => isIssue(r) && r.part === p.label).map((r) => OUTCOMES[outcomeOf(r)].tally) }))
    .filter((x) => x.said.length);
  return [
    `Since this version: ${tallyText(reports)}. Unverified; details at ${url}#feedback`,
    ...issues.map((x) => `- ${x.part}: ${x.said.join(", ")}`),
  ];
}

const cite = (g: Guide, e: Evidence) => {
  const refs = e.sources.map((id) => g.sources.findIndex((s) => s.id === id) + 1).filter((n) => n > 0);
  const conf = e.confidence === "high" ? "" : `, ${e.confidence} confidence`;
  return `_(${EVIDENCE[e.kind].label}${refs.length ? ` [${refs.join(", ")}]` : ""}${conf})_`;
};

/** Full guide as Markdown, for sharing in docs, tickets or with another agent. */
export function guideToMarkdown(g: Guide, url: string, reports: Report[] = []): string {
  const out: string[] = [];
  out.push(`# ${g.name}: OAuth app setup and approval`);
  out.push(
    `${TIERS[g.tier].label} · ${QUALITY[g.quality].label} · updated ${formatDate(g.updatedAt)} · ${url}`,
    "",
    `> ${g.summary}`,
    "",
    `- **Your hands-on work:** ${formatDuration(g.totals.effort)}`,
    `- **Waiting on ${g.name}:** ${formatDuration(g.totals.wait)}`,
    `- **First user can connect:** ${g.totals.firstConnection}`,
    `- **Why ${TIERS[g.tier].label}:** ${g.tierReason}`,
    ...(g.registration ? [`- **${REGISTRATION[g.registration.model].label}:** ${g.registration.note} ${cite(g, g.registration.evidence)}`] : []),
    `- **Using Composio?** ${g.composio.note}`,
    "",
  );
  if (g.grants?.length) {
    out.push("## OAuth grants");
    for (const x of g.grants) out.push(`- **${x.name}.** ${x.fits} ${cite(g, x.evidence)}`);
    out.push("");
  }
  out.push("## Path to launch");
  for (const s of g.stages) {
    out.push(
      `### ${STAGES[s.id]}: ${s.name}`,
      `- Who can connect: ${s.whoCanConnect}`,
      `- What users see: ${s.userSees}`,
      `- Effort: ${formatDuration(s.effort)} · Wait: ${formatDuration(s.wait)}`,
      ...(s.unlock ? [`- Next: ${s.unlock}`] : []),
      `- ${cite(g, s.evidence)}`,
      "",
    );
  }
  out.push("## Before you start");
  for (const r of g.requirements) out.push(`- [ ] **${r.label}** (${ACTORS[r.actor].label}). ${r.detail} ${cite(g, r.evidence)}`);
  out.push("", "## Steps");
  g.steps.forEach((s, i) => {
    const time = s.actor === "provider" ? `wait ${formatDuration(s.time)}` : formatDuration(s.time);
    out.push(`${i + 1}. **${s.title}** (${ACTORS[s.actor].label}, ${time}). ${s.detail} ${cite(g, s.evidence)}`);
    for (const a of s.actions ?? []) out.push(`   - ${a}`);
    if (s.agentNote) out.push(`   - Agent: ${s.agentNote}`);
    if (s.gotcha) out.push(`   - Watch out: ${s.gotcha}`);
    if (s.image) out.push(`   - Screenshot: ![${s.image.alt}](${s.image.url}) [${g.sources.findIndex((x) => x.id === s.image?.source) + 1}]`);
  });
  if (g.scopes) {
    out.push("", "## Scopes", g.scopes.intro, "", "| Scope | Grants | Level | Consequence |", "|---|---|---|---|");
    for (const t of g.scopes.tiers) out.push(`| \`${t.scope}\` | ${t.grants} | ${t.level} | ${t.consequence} |`);
  }
  out.push("", "## When you get stuck");
  for (const b of g.blockers) out.push(`- **${b.symptom}.** ${b.cause} Fix: ${b.fix} ${cite(g, b.evidence)}`);
  out.push("", "## Not confirmed yet");
  for (const u of g.unknowns) out.push(`- **${u.question}** ${u.why} To resolve: ${u.resolve}`);
  if (g.attempt) {
    out.push("", `## Setup attempt (${formatDate(g.attempt.date)}, ${g.attempt.outcome})`, g.attempt.summary);
    for (const l of g.attempt.log) out.push(`- ${l.step}: ${l.result}. ${l.note}`);
  }
  out.push("", "## Sources");
  g.sources.forEach((s, i) =>
    out.push(`${i + 1}. [${s.title}](${s.url}) (${s.publisher}). ${s.checkedAt ? `Checked ${formatDate(s.checkedAt)}` : "Not yet checked"}`),
  );
  if (reports.length) out.push("", "## Feedback", ...feedbackLines(g, url, reports));
  out.push(
    "",
    `Wrong or out of date? ${reportHow(g.slug, url)}. The next research run checks it.`,
    `Followed it? Say how it went: ${setupHow(g.slug, url)}.`,
  );
  return out.join("\n") + "\n";
}

/** Why there's no guide: research found no OAuth for third-party apps. */
export function noOAuthToMarkdown(a: NoOAuthAnswer, url: string): string {
  const out = [`# ${a.name}: no OAuth for third-party apps`, `Checked ${formatDate(a.checkedAt)} · ${url}`, "", `> ${a.reason}`, ""];
  if (a.alternative) {
    out.push(
      `**Research instead:** ${a.alternative}. POST ${apiBase(url)}/api/research with {"query": ${JSON.stringify(a.alternative)}}, or call research_app.`,
      "",
    );
  }
  if (a.sources.length) {
    out.push("## Sources");
    a.sources.forEach((s, i) => out.push(`${i + 1}. [${s.title}](${s.url})`));
    out.push("");
  }
  out.push(`Think ${a.name} does offer OAuth? ${reportHow(a.slug, url)}.`);
  return out.join("\n") + "\n";
}

/** Instructions an agent can act on: do its steps, stop at each human or provider step. */
export function agentBrief(g: Guide, url: string, reports: Report[] = []): string {
  const provider = g.name.split(" (")[0];
  const owner = { agent: "agent", you: "human", provider: "provider" } as const;
  const stepLine = (s: Guide["steps"][number], i: number) =>
    s.actor === "agent"
      ? `${i + 1}. [agent] ${s.title}. ${s.detail}${s.gotcha ? ` Watch out: ${s.gotcha}` : ""}`
      : `${i + 1}. [${owner[s.actor]}] ${s.title}${s.actor === "provider" ? ` (wait ${formatDuration(s.time).toLowerCase()})` : ""}`;
  return [
    `Set up a ${provider} OAuth app for our integration, as far as you can.`,
    `Guide: ${url}.md (updated ${formatDate(g.updatedAt)})`,
    ...feedbackLines(g, url, reports),
    "",
    `${TIERS[g.tier].label}. Hands-on work: ${formatDuration(g.totals.effort).toLowerCase()}. Waiting on ${provider}: ${formatDuration(g.totals.wait).toLowerCase()}.`,
    ...(g.registration?.model === "per-tenant" ? [`${REGISTRATION["per-tenant"].label}: ${g.registration.note}`] : []),
    ...(g.grants && g.grants.length > 1
      ? ["", "OAuth grants. If it isn't clear which one our integration needs, ask me:", ...g.grants.map((x) => `- ${x.name}: ${x.fits}`)]
      : []),
    "",
    "Check these exist first:",
    ...g.requirements.filter((r) => r.stage === "build").map((r) => `- ${r.label} [${owner[r.actor]}]`),
    ...(g.requirements.some((r) => r.stage !== "build")
      ? ["", "Needed later, not now:", ...g.requirements.filter((r) => r.stage !== "build").map((r) => `- ${r.label} (for ${STAGES[r.stage].toLowerCase()})`)]
      : []),
    "",
    "Steps, in order:",
    ...g.steps.map(stepLine),
    "",
    "Rules:",
    `- Do [agent] steps yourself. Steps in ${provider}'s dashboard need a browser I'm signed in to; without one, give me the exact clicks and values instead, then carry on with the code.`,
    "- At each [human] or [provider] step, stop and tell me exactly what's needed.",
    "- Never put client secrets in chat, code or commits. I paste them into our OAuth client or secret manager myself.",
    "- Request the narrowest scopes that work. Ask me before choosing scopes or changing security settings (scope restrictions, roles, grant types), even where the guide marks the step [agent].",
    ...(g.registration?.model === "per-tenant"
      ? [`- Build for many customers: keep each customer's ${provider} address, client ID and client secret on their connection. Never hard-code one.`]
      : []),
    `- Claims marked ${EVIDENCE.inferred.label} or low confidence in the guide are unverified. Check them and tell me what you find.`,
    `- If the guide doesn't match what you see (a page, field or requirement), tell me and report it so it gets fixed: ${reportHow(g.slug, url)}. Never put secrets or personal data in a report.`,
    `- When setup ends (users can connect, or it's waiting on ${provider}'s review) or you can't get past a step, report how it went so the guide improves: ${setupHow(g.slug, url)}. Stopping for me at a [human] step isn't stuck: don't report that.`,
    `- Finish with what's done, the redirect URI and scopes used, ${g.registration?.model === "per-tenant" ? "the steps each customer's admin must follow, " : ""}and what's left before public launch.`,
  ].join("\n");
}
