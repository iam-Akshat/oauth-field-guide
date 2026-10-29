import type { Confidence, Duration, Evidence, EvidenceKind, Source, TimeUnit } from "../types";

export const ev = (kind: EvidenceKind, sources: string[], confidence: Confidence = "high"): Evidence => ({
  kind,
  sources,
  confidence,
});

export const d = (min: number, max: number, unit: TimeUnit): Duration => ({ min, max, unit });

export const NONE: Duration = { min: 0, max: 0, unit: "days" };

/** Sources every guide can cite. Fetched and read on 27 Oct 2026. */
export const COMPOSIO_SOURCES = {
  managedList: {
    title: "Managed auth: which toolkits Composio provides an OAuth app for",
    url: "https://docs.composio.dev/toolkits/managed-auth",
    publisher: "Composio docs",
    kind: "composio",
    checkedAt: "2026-10-27",
  },
  customVsManaged: {
    title: "Managed vs custom auth",
    url: "https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app",
    publisher: "Composio docs",
    kind: "composio",
    checkedAt: "2026-10-27",
  },
} satisfies Record<string, Omit<Source, "id">>;

export const src = (id: string, s: Omit<Source, "id">): Source => ({ id, ...s });
