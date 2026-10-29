# Findings

From using the product as a fast-moving, AI-native engineer: in Chrome, through the CLI and MCP, and by checking guides against provider pages. Newest first. Severity is for that user: **high** means they'd get a wrong answer or get stuck.

| # | Date | Where | Finding | Severity | Status |
|---|---|---|---|---|---|
| 24 | 2026-10-29 | Guide: ServiceNow | External review: the guide missed client credentials, recommended `useraccount` / Broadly scoped as the default, said a missing scope gives 401 (docs: 403), said "doesn't review apps" for every path, and showed "Docs" on claims whose only read source was Apideck (the evidence check accepted any read page). Only 5 pages were read. | high | fixed: "docs" needs a read official page; the prompt asks for grants, per-tenant registration, expiry and path-specific review, and requires narrow scopes, scope changes by a person, and read pages behind scope and error claims; `registration` and `grants` on every surface; agent prompt asks before security changes. Rerun passes the adversarial case (claims 1/2: still no 403) |
| 23 | 2026-10-28 | Agent prompt | Test: a fresh Claude agent got the Linear prompt in a throwaway Express app, with no mention of feedback. It filed 4 problem reports on its own and, as the prompt says, didn't report "stuck" when it handed step 3 to the human. But it wrote the step numbers into the text ("Step 2 says…"), because the problem-report example had no `step` field, so the reports weren't tied to steps. Its findings (no separate developer account, no scopes on Linear's form, a Public switch rather than review) were about the mock sample guide; the real Linear guide already says all three. | low | fixed: `step` in the report example, the `report_problem` tool and the CLI (`--report "…" --step 2`) |
| 22 | 2026-10-28 | Feedback | Agents and people could only report that a guide is wrong. A setup that worked, or one stuck at a step, left no trace, so no guide had any setup evidence. | medium | fixed: outcomes (worked, waiting on review, stuck at step N, wrong) on web, MCP `report_setup`, CLI and API; counts on the guide, in `list_guides`, the Markdown and the agent prompt, which now asks the agent to report when it finishes or stops |
| 21 | 2026-10-28 | Research | Docs that only render with JavaScript can't be read (Apple's developer docs; parts of Pinterest's). The agent says so and falls back to forums and general knowledge. | medium | fixed: `read_page` tool renders them (Firecrawl with a key, else Jina Reader) |
| 20 | 2026-10-28 | No-OAuth result | Instagram Basic Display says "research the Instagram API as a separate provider", but the page offers no button to do it. | low | fixed: no-OAuth answers carry an `alternative`; button on the live and saved pages, hint in MCP and CLI |
| 19 | 2026-10-28 | No-OAuth result | No-OAuth outcomes aren't saved: the next person to search Signal pays for and waits through the same research, and the library never shows "no OAuth". | medium | fixed: saved to `data/no-oauth.json`, shown in the library, ⌘K, MCP and CLI; reports on every surface |
| 18 | 2026-10-28 | Saving | Researching `x.ai` as written would save xAI's guide over X's, because both resolve to the slug `x`. | high | fixed: a save never overwrites a guide with a different domain and name; it uses a slug from the domain (`x-ai`) |
| 17 | 2026-10-28 | Matching | A website that only shares a name with a known app (`x.ai`, `www.notion.com`) matched it silently as exact. | medium | fixed: always "near", so the page shows "Did you mean" with the search-as-typed link |
| 16 | 2026-10-28 | Matching | `acme.vercel.app` opened the Vercel guide and `someone.github.io` the GitHub guide: apps hosted on a platform were taken for the platform. | medium | fixed: subdomains of hosting platforms are their own app |
| 15 | 2026-10-28 | Catalog | "Google Calendar" and "Google Drive" opened the Gmail guide, which says a paid security assessment (CASA) is required. Calendar scopes are sensitive (verification only) and Drive's `drive.file` needs no review. | high | fixed: Gmail, Google Calendar and Google Drive are separate catalog apps (`gcal`, `gdrive` work) |
| 14 | 2026-10-28 | Guide: Spotify | A rerun said "only one Development Mode client ID per developer", from Spotify's Feb 2026 blog. The migration guide says the limit rose to 25 in July 2026, and the apps page says 25. The earlier run had it right. Stale policy is the main way these guides go wrong. | high | prompt rule added: newest dated official source wins; `forbid` check in claims.jsonl |
| 13 | 2026-10-28 | Guide header | "First user connects" holds a sentence ("After Pinterest approves your Trial request, usually 1 to 2 weeks after…") in a box meant for a number. | low | open |
| 12 | 2026-10-28 | Live research | The first finding shown is the Composio side check, in a product that's meant to be provider-agnostic. | low | open |
| 11 | 2026-10-28 | Evidence | The agent reads a page's `.md` copy (forums, docs) but cites the plain URL, so the source shows "not checked". This is why Notion fell from Sourced to Partial on its rerun. | medium | fixed: URL matching ignores a `.md`/`.json` suffix |
| 10 | 2026-10-28 | ⌘K | "pintrest" offers only "Research", which looks like a 2-minute paid run, though a Pinterest guide exists. Enter does land on it with "Did you mean". | medium | fixed: the palette uses the same typo matching as the server |
| 9 | 2026-10-28 | Research | Two research jobs for the same app run at once and are both paid for (Salesforce ran twice, $0.72 + $0.60). | medium | fixed: a request for an app already being researched joins that job (checked: a second HubSpot request got the same job id) |
| 8 | 2026-10-28 | Guide: HubSpot | Misses that HubSpot reviews one app at a time and rejects others submitted meanwhile. | low | open |
| 7 | 2026-10-28 | Guide plan, agent prompt | "Before you start" and the prompt's "Check these exist first" list every requirement, including launch-only ones ("3 active unaffiliated installs"). A coding agent following the prompt stops before step 1. | high | fixed: requirements show in the stage that needs them; the prompt lists later ones under "Needed later, not now" (checked on Pinterest) |
| 6 | 2026-10-28 | Guide plan | Requirements repeat steps ("Verified domain" and "Verify your domain"), padding the task count. | low | prompt rule added |
| 5 | 2026-10-28 | Tiers: HubSpot | Tiered Reviewed, though the guide itself says an unlisted app works today in 25 accounts. By our definitions that's Capped. The library tells the user "2–12 weeks" when they could ship to 25 customers today. | high | prompt rule added: tier by what blocks the first real customer; re-scoring after a rerun |
| 4 | 2026-10-28 | Library | Names are inconsistent: "Gmail API", "Spotify Web API", "X API (formerly Twitter API)" next to "Slack". Labels read "Waiting on Spotify Web API". | low | prompt rule added: the app's everyday name (checked: new run named "Pinterest") |
| 3 | 2026-10-28 | Agent prompt | `[agent]` steps in a provider's dashboard ("Go to Settings → API…") are handed to coding agents that have no browser. | medium | fixed: the prompt says to give exact clicks and values when there's no signed-in browser |
| 2 | 2026-10-28 | API | `POST /api/research` created a job that only started once someone opened its event stream, so an API caller polling `GET /api/research/:id` waited forever. | high | fixed: jobs start on create |
| 1 | 2026-10-28 | Guides | No screenshots. Provider docs have them (Spotify's quota page has three, in the raw HTML). | medium | fixed: the agent attaches one per step; the server keeps it only if it's on the cited page and loads as an image |

## Verified against provider pages

Per-claim records are in `claims.jsonl`. Two ways to grade a guide against them:

- **Judge (authoritative):** a Claude Sonnet subagent in Claude Code reads each guide and grades each claim correct, partial, wrong or missing, with an exact quote. Verdicts are in `judgments.jsonl`.
- **Keyword check (free, rough):** `node evals/score.mjs`. Short numbers can match the wrong text, so use it only as a smoke test.

Judge results on 2026-10-28 (facts / tier):

| Prompt | Correct | Partial | Wrong | Missing | Tier |
|---|---|---|---|---|---|
| v1 | 13/13 | 0 | 0 | 0 | 1/2 |
| 4053626d | 17/19 | 1 | 1 | 0 | 3/3 |
| c3c56300 | 18/19 | 0 | 1 | 0 | 3/3 |
| a64a4229 (live) | 18/19 | 0 | 0 | 1 | 3/3 |

`adversarial.jsonl` holds apps chosen to break the product, each with the expected behaviour written before the run.

| App | Facts checked | Right at check | Tier | Notes |
|---|---|---|---|---|
| HubSpot | 6 | 5 (1 missing) | wrong (Reviewed → Capped) | Install caps, listing installs and review times all match HubSpot's pages |
| Spotify | 6 | 6 | right (Gated) | Every limit matches Spotify's quota-modes page |
| Pinterest | 6 | 6 | right (Reviewed) | Researched live in Chrome on the new prompt. Caught the 14 Sep 2026 `PINNER_DATA_ACCESS_DENIED` change. Misses that the demo video is needed even if you're the only user. 2 doc screenshots kept |
