import { guideResponse } from "@/lib/guide-response";

/** Markdown for /apps/:slug.md and Accept: text/markdown (see the rewrites in next.config.ts). */
export async function GET(_: Request, ctx: RouteContext<"/api/guides/[slug]/md">) {
  const { slug } = await ctx.params;
  return guideResponse(slug, "md");
}
