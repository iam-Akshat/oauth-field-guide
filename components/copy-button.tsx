"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  /** Text to copy. Omit to copy the current page URL. */
  value?: string;
  label: string;
  icon?: ReactNode;
  className?: string;
};

export function CopyButton({ value, label, icon, className = "btn btn-quiet btn-sm" }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value ?? window.location.href.split("#")[0]);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={className}
      data-state={state === "copied" ? "success" : undefined}
      aria-live="polite"
    >
      {state === "copied" ? <Check size={14} aria-hidden="true" /> : (icon ?? <Copy size={14} aria-hidden="true" />)}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy blocked" : label}
    </button>
  );
}
