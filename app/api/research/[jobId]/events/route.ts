import { connection } from "next/server";
import { getJob, isTerminal, startJob, subscribe } from "@/lib/research/jobs";
import type { ResearchEvent } from "@/lib/types";

/**
 * Server-sent events for a research job. Replays everything so far, then
 * streams new events until the job ends. Connecting starts a queued job.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/research/[jobId]/events">) {
  await connection();
  const { jobId } = await ctx.params;
  if (!getJob(jobId)) return new Response("No research job with that ID.", { status: 404 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};

      // Comment lines keep idle proxies from dropping the connection.
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      };
      const send = (e: ResearchEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        if (isTerminal(e)) close();
      };

      unsubscribe = subscribe(jobId, send);
      // A finished job replays its terminal event during subscribe().
      if (closed) unsubscribe();

      req.signal.addEventListener("abort", close);
      startJob(jobId);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
