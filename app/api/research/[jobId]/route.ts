import { connection } from "next/server";
import { getJob } from "@/lib/research/jobs";

/** Job snapshot: status, resolved name and, once done, the guide slug. */
export async function GET(_req: Request, ctx: RouteContext<"/api/research/[jobId]">) {
  await connection();
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) return Response.json({ error: "No research job with that ID." }, { status: 404 });
  return Response.json(job);
}
