/**
 * Which research agent runs. "claude" uses the Claude Agent SDK and needs
 * ANTHROPIC_API_KEY; "mock" replays scripted runs and sample guides, for
 * working on the UI without spending anything. Read at runtime.
 */
export const AGENT_MODE: "claude" | "mock" =
  process.env.RESEARCH_AGENT === "mock" || (process.env.RESEARCH_AGENT !== "claude" && !process.env.ANTHROPIC_API_KEY)
    ? "mock"
    : "claude";
