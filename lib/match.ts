/**
 * Static app-name matching: typos ("calandly"), websites ("calendly.com",
 * "https://www.calendly.com/x") and filler words ("calendly api"). Free and
 * instant, so it runs before the model-based match in lib/research/canonical.ts.
 */

const FILLER = new Set([
  "api",
  "apis",
  "oauth",
  "oauth2",
  "app",
  "apps",
  "developer",
  "developers",
  "dev",
  "integration",
  "integrations",
  "platform",
  "login",
  "auth",
  "sso",
  "the",
  "inc",
]);

/** Second-level labels that sit under a country code, as in xero.co.uk. */
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov"]);

/** Hosting platforms whose subdomains are other people's apps: acme.vercel.app is Acme, not Vercel. */
const HOSTED = ["vercel.app", "github.io", "netlify.app", "herokuapp.com", "pages.dev", "web.app", "firebaseapp.com", "onrender.com", "fly.dev", "replit.app", "azurewebsites.net", "appspot.com"];

export const looksLikeUrl = (text: string) => /^https?:\/\//i.test(text) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text);

/** The part of a query that names the app: the site's name for a URL, otherwise its words minus filler. */
export function appKey(text: string): string {
  const t = text.trim().toLowerCase();
  if (looksLikeUrl(t)) {
    const labels = t
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(/[/?#]/)[0]
      .split(".");
    const platform = HOSTED.find((h) => labels.join(".").endsWith(`.${h}`));
    if (platform) return labels[labels.length - platform.split(".").length - 1].replace(/[^a-z0-9]/g, "");
    const i = labels.length > 2 && SECOND_LEVEL.has(labels.at(-2)!) ? labels.length - 3 : Math.max(labels.length - 2, 0);
    return labels[i].replace(/[^a-z0-9]/g, "");
  }
  return t
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FILLER.has(w))
    .join("");
}

/** Optimal string alignment distance: edits, with swapping two adjacent letters counted as one. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return Infinity;
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Typos allowed for a key this long. Short names must match exactly: "zoom" isn't "zola". */
const tolerance = (length: number) => (length < 5 ? 0 : length < 9 ? 1 : 2);

/**
 * The item with a key closest to the query, within the typo tolerance, and
 * how many edits away it was (0 when only case, filler words or the URL differed).
 * null when nothing is close enough, or when two items are equally close.
 */
export function closest<T>(query: string, items: Iterable<T>, keys: (item: T) => string[]): { item: T; distance: number } | null {
  const q = appKey(query);
  if (!q) return null;
  let best: T | null = null;
  let bestDistance = Infinity;
  let tied = false;
  for (const item of items) {
    const d = Math.min(...keys(item).filter(Boolean).map((k) => distance(q, k)));
    if (d < bestDistance) {
      best = item;
      bestDistance = d;
      tied = false;
    } else if (d === bestDistance) {
      tied = true;
    }
  }
  return best !== null && !tied && bestDistance <= tolerance(q.length) ? { item: best, distance: bestDistance } : null;
}
