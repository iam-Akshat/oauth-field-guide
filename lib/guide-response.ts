import { agentBrief, guideToMarkdown, noOAuthToMarkdown } from "./markdown";
import { origin } from "./origin";
import { tally } from "./meta";
import { findExisting, getGuide, getNoOAuth, matchApp, reportsSince } from "./repo";

/**
 * One guide as JSON, Markdown or an agent prompt; 404 when there's no guide,
 * even allowing for a typo. When research found no OAuth for the app, the 404
 * carries that answer (`noOAuth` in JSON, the explanation in Markdown).
 */
export async function guideResponse(slug: string, format: string | null): Promise<Response> {
  const guide = (await getGuide(slug)) ?? findExisting(slug);
  if (!guide) {
    const answer = (await getNoOAuth(slug)) ?? matchApp(slug)?.answer;
    if (answer && (format === "md" || format === "prompt")) {
      return new Response(noOAuthToMarkdown(answer, `${await origin()}/apps/${answer.slug}`), {
        status: 404,
        headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
      });
    }
    if (answer) return Response.json({ error: `${answer.name} has no OAuth for third-party apps. ${answer.reason}`, noOAuth: answer }, { status: 404 });
    return Response.json({ error: `No guide for “${slug}”. Start research with POST /api/research.` }, { status: 404 });
  }
  const reports = reportsSince(guide.slug);
  if (format === "md" || format === "prompt") {
    const url = `${await origin()}/apps/${guide.slug}`;
    return new Response(format === "md" ? guideToMarkdown(guide, url, reports) : agentBrief(guide, url, reports), {
      headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
    });
  }
  // How setups of this version went, e.g. { worked: 3, stuck: 1 }.
  return Response.json({ ...guide, feedback: Object.fromEntries(tally(reports).map((t) => [t.outcome, t.count])) });
}
