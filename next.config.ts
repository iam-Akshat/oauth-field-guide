import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Let the dev server hydrate when opened as 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  partialPrefetching: true,
  // The Agent SDK starts a bundled Claude Code binary; load it with Node's require instead of bundling it.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  // Agents can read any guide as Markdown: /apps/github.md, or /apps/github with Accept: text/markdown.
  async rewrites() {
    return [
      { source: "/apps/:slug([a-z0-9-]+)\\.md", destination: "/api/guides/:slug/md" },
      {
        source: "/apps/:slug([a-z0-9-]+)",
        has: [{ type: "header", key: "accept", value: "(.*)text/markdown(.*)" }],
        destination: "/api/guides/:slug/md",
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
