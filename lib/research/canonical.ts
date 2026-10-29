/**
 * Second pass for queries static matching can't place: nicknames and product
 * names such as "gcal" or "ms teams". Claude Haiku picks one known app or
 * none, from a fixed list, so it can't invent one. Fails open: on any error
 * the query is researched as typed.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATALOG } from "../data/catalog";
import { listGuides, matchApp } from "../repo";
import { resolveQuery } from "./resolve";

const MODEL = process.env.MATCH_MODEL ?? "claude-haiku-5-5";

const SYSTEM = `You match what a developer typed into the search box of an OAuth setup guide library to one app in a fixed list.
Answer with the app's id when the text clearly means that app: a typo, nickname, abbreviation, or a product or company name the entry covers (for example "gcal" means Google Calendar, which the google entry covers).
Answer "none" when it means an app that isn't listed, could mean several listed apps, or you aren't sure. A different product from the same company is "none" unless the entry covers it.`;

let client: Anthropic | undefined;

/**
 * What to research for a query: the query itself when static matching already
 * places it (or there's no API key), otherwise the app Haiku maps it to.
 * Returns a catalog slug or a saved guide's name, both of which resolve exactly.
 */
export async function canonicalQuery(query: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY || matchApp(query) || resolveQuery(query).match) return query;

  const apps = new Map<string, { name: string; domain: string | null; catalog: boolean }>();
  for (const c of CATALOG) apps.set(c.slug, { name: c.name, domain: c.domain, catalog: true });
  for (const g of await listGuides()) if (!apps.has(g.slug)) apps.set(g.slug, { name: g.name, domain: g.domain, catalog: false });
  const ids = [...apps.keys()];
  const list = ids.map((id) => `${id}: ${apps.get(id)!.name}${apps.get(id)!.domain ? ` (${apps.get(id)!.domain})` : ""}`).join("\n");

  try {
    client ??= new Anthropic({ maxRetries: 1 });
    const response = await client.messages.parse(
      {
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        output_config: {
          effort: "low",
          format: zodOutputFormat(z.object({ id: z.enum(["none", ...ids]) })),
        },
        messages: [{ role: "user", content: `Apps:\n${list}\n\nThe developer typed: ${JSON.stringify(query)}` }],
      },
      { timeout: 8_000 },
    );
    const id = response.stop_reason === "end_turn" ? response.parsed_output?.id : undefined;
    const app = id && id !== "none" ? apps.get(id) : undefined;
    if (!app) return query;
    console.info(`[match] “${query}” → ${id}`);
    return app.catalog ? id! : app.name;
  } catch (err) {
    console.warn("[match] model match failed; researching the query as typed:", err);
    return query;
  }
}
