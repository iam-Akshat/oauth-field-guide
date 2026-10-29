import { listCatalog, listGuides, listNoOAuth } from "@/lib/repo";

/** Library index: guide summaries, apps research found no OAuth for, and apps queued for research. */
export async function GET() {
  const [guides, noOAuth, catalog] = await Promise.all([listGuides(), listNoOAuth(), listCatalog()]);
  return Response.json({ guides, noOAuth, catalog });
}
