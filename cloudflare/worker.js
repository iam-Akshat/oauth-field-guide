/**
 * Cloudflare in front of Fly.io: TLS and caching at the edge, everything else
 * passed through to the app (the server streams research progress, so bodies
 * pass through untouched). X-Forwarded-Host keeps the app's links on this host.
 */
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, env.ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");
    return fetch(target, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });
  },
};

export default worker;
