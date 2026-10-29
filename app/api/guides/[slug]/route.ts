import type { NextRequest } from "next/server";
import { guideResponse } from "@/lib/guide-response";

/** One guide as JSON, Markdown (?format=md) or an agent prompt (?format=prompt). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/guides/[slug]">) {
  const { slug } = await ctx.params;
  return guideResponse(slug, req.nextUrl.searchParams.get("format"));
}
