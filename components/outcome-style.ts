import { CircleAlert, CircleCheck, Flag, Hourglass, type LucideIcon } from "lucide-react";
import type { ReportOutcome } from "@/lib/types";

/** Icon and colour per feedback outcome, shared by the tally and the form. */
export const OUTCOME_STYLE: Record<ReportOutcome, { Icon: LucideIcon; color: string }> = {
  worked: { Icon: CircleCheck, color: "text-ok" },
  waiting: { Icon: Hourglass, color: "text-accent-strong" },
  stuck: { Icon: CircleAlert, color: "text-warn" },
  wrong: { Icon: Flag, color: "text-warn" },
};
