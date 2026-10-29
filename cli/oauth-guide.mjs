#!/usr/bin/env node
/**
 * oauth-guide <app> [--prompt] [--json] [--exact]
 * oauth-guide <app> --report "what's wrong" [--step N]
 * oauth-guide <app> --worked ["note"] | --waiting ["note"] | --stuck <step> "what happened"
 *
 * Prints the guide for an app to stdout. If there's no guide yet, researches
 * it first and shows progress on stderr, so the output can be piped to an agent:
 *   oauth-guide spotify --prompt | claude -p
 *
 * Typos and nicknames are matched to known apps ("calandly" → Calendly);
 * --exact researches the name as written. Apps with no OAuth exit with code 2.
 * --report files a report that the guide (or a no-OAuth answer) is wrong.
 * --worked, --waiting (done, waiting on the provider's review) and --stuck say
 * how following the guide went. Each shows on the guide; the next research
 * run checks the wrong and stuck ones.
 *
 * OAUTH_GUIDE_URL sets the server (default https://oauth-guide.akshatsethi.com; http://localhost:3000 for a local one).
 */
const base = (process.env.OAUTH_GUIDE_URL ?? "https://oauth-guide.akshatsethi.com").replace(/\/$/, "");
const args = process.argv.slice(2);

// Feedback flags. Their values (step, note) aren't part of the app name.
const FEEDBACK = { "--report": "wrong", "--worked": "worked", "--waiting": "waiting", "--stuck": "stuck" };
const taken = new Set();
let feedback = null;
for (const [flag, outcome] of Object.entries(FEEDBACK)) {
  let at = args.indexOf(flag);
  if (at === -1) continue;
  const take = (i) => (args[i] !== undefined && !args[i].startsWith("--") ? (taken.add(i), args[i]) : undefined);
  const step = outcome === "stuck" && /^\d+$/.test(args[at + 1] ?? "") ? Number(take(++at)) : undefined;
  feedback = { outcome, step, message: take(at + 1) ?? "" };
}
// --step N says which step a --report is about (--stuck takes it directly).
const stepAt = args.indexOf("--step");
if (stepAt !== -1 && feedback && /^\d+$/.test(args[stepAt + 1] ?? "")) {
  taken.add(stepAt + 1);
  feedback.step ??= Number(args[stepAt + 1]);
}
const app = args
  .filter((a, i) => !a.startsWith("--") && !taken.has(i))
  .join(" ")
  .trim();
const format = args.includes("--json") ? "json" : args.includes("--prompt") ? "prompt" : "md";
const exact = args.includes("--exact");

const dim = (s) => (process.stderr.isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const fail = (msg, code = 1) => {
  console.error(msg);
  process.exit(code);
};

if (!app || args.includes("--help")) {
  fail(
    [
      "Usage: oauth-guide <app name or website> [--prompt] [--json] [--exact]",
      "       oauth-guide <app> --report \"what's wrong\" [--step N]",
      "       oauth-guide <app> --worked [\"note\"] | --waiting [\"note\"] | --stuck <step> \"what happened\"",
      "",
      "--exact researches the name as written, without matching typos to known apps.",
      "--report says a guide or no-OAuth answer is wrong.",
      "--worked, --waiting (done, waiting on the provider's review) and --stuck say how following the guide went.",
      "Feedback shows on the guide; the next research run checks wrong and stuck reports.",
      "OAUTH_GUIDE_URL sets the server (default https://oauth-guide.akshatsethi.com; http://localhost:3000 for a local one).",
    ].join("\n"),
    args.includes("--help") ? 0 : 1,
  );
}

async function request(path, init) {
  try {
    return await fetch(`${base}${path}`, init);
  } catch {
    fail(`Couldn't reach ${base}. Is the server running? Set OAUTH_GUIDE_URL to point elsewhere.`);
  }
}

async function printGuide(slug) {
  const res = await request(`/api/guides/${slug}${format === "json" ? "" : `?format=${format}`}`);
  if (!res.ok) fail(`Couldn't load the ${slug} guide (HTTP ${res.status}).`);
  process.stdout.write(await res.text());
  console.error(
    dim(
      `\n${base}/apps/${slug}\nWrong or out of date? oauth-guide ${slug} --report "what you saw" --step N\nFollowed it? oauth-guide ${slug} --worked, --waiting or --stuck <step> "what happened"`,
    ),
  );
}

/** Research found no OAuth: say why and what to try, then exit 2. */
function noOAuth({ slug, name, reason, message, alternative, checkedAt }) {
  if (format === "json") console.log(JSON.stringify({ outcome: "no-oauth", slug, name, reason: reason ?? message, alternative, checkedAt }, null, 2));
  console.error(`${name ?? app} has no OAuth for third-party apps${checkedAt ? ` (checked ${checkedAt})` : ""}. ${reason ?? message}`);
  if (alternative) console.error(`Try instead: oauth-guide ${JSON.stringify(alternative)}`);
  if (slug) console.error(dim(`${base}/apps/${slug}\nWrong? oauth-guide ${slug} --report "what you found"`));
  process.exit(2);
}

if (feedback) {
  const res = await request("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app, ...feedback, via: "cli" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(body.error ?? `The report wasn't saved (HTTP ${res.status}).`);
  const checked = feedback.outcome === "wrong" || feedback.outcome === "stuck" ? " The next research run checks it." : "";
  console.error(`Thanks. Filed${body.part ? ` on ${body.part}` : ""}: ${body.url}.${checked}`);
  process.exit(0);
}

/** Streams the job's events to stderr; resolves with the terminal event. */
async function follow(jobId) {
  console.error(dim(`Researching ${app}. Watch live: ${base}/research/${jobId}`));
  const res = await request(`/api/research/${jobId}/events`);
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!data) continue;
      const e = JSON.parse(data.slice(6));
      if (e.type === "phase") console.error(`· ${e.phase}`);
      else if (e.type === "finding") console.error(dim(`  ✓ ${e.text}`));
      else if (e.type === "log" && e.tone === "warn") console.error(dim(`  ! ${e.text}`));
      if (e.type === "done" || e.type === "no-oauth" || e.type === "error") return e;
    }
  }
  fail("The research stream closed before it finished.");
}

const start = await request("/api/research", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: app, exact }),
});
const started = await start.json().catch(() => ({}));
if (!start.ok) fail(started.error ?? `Research couldn't start (HTTP ${start.status}).`);

const didYouMean = (name) => console.error(dim(`Did you mean ${name}? Use --exact to research “${app}” as written.`));

if (started.kind === "existing") {
  if (started.corrected) didYouMean(started.slug);
  await printGuide(started.slug);
} else if (started.kind === "no-oauth") {
  if (started.corrected) didYouMean(started.name);
  noOAuth(started);
} else {
  const job = await (await request(`/api/research/${started.jobId}`)).json().catch(() => ({}));
  if (job.corrected) didYouMean(job.name);
  const end = await follow(started.jobId);
  if (end.type === "no-oauth") noOAuth({ ...end, name: job.name });
  if (end.type === "error") fail(end.message);
  await printGuide(end.slug);
}
