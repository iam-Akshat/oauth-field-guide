"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CopyButton } from "@/components/copy-button";

export type AccessTab = { id: string; label: string; code: string; note?: string };

const STORAGE_KEY = "agent-access-tab";

/** Tabbed snippets for getting a guide into an agent: prompt, MCP, CLI, Markdown. */
export function AgentAccess({ tabs, nested = false }: { tabs: AccessTab[]; nested?: boolean }) {
  const [active, setActive] = useState(tabs[0].id);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Remember the reader's preferred tab (a convenience; works without storage).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
      if (saved && tabs.some((t) => t.id === saved)) setActive(saved);
    } catch {}
  }, [tabs]);

  function select(id: string) {
    setActive(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }

  function onKey(e: KeyboardEvent, i: number) {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const j = (next + tabs.length) % tabs.length;
    select(tabs[j].id);
    refs.current[j]?.focus();
  }

  const tab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <section
      aria-label="Use with your agent"
      className={`band-graphite overflow-hidden rounded-lg ${nested ? "border border-graphite-rule !bg-graphite-2" : ""}`}
    >
      <div className="border-b border-graphite-rule px-2 pt-3">
        <h2 className="label-mono px-2">Use with your agent</h2>
        <div role="tablist" aria-label="Format" className="mt-1 flex min-w-0 overflow-x-auto">
          {tabs.map((t, i) => {
            const selected = t.id === tab.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`access-tab-${t.id}`}
                aria-selected={selected}
                aria-controls="access-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => select(t.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={`-mb-px h-11 border-b-2 px-2.5 text-sm whitespace-nowrap transition-colors duration-[var(--dur-micro)] ${
                  selected
                    ? "border-graphite-accent text-graphite-ink"
                    : "border-transparent text-graphite-muted hover:text-graphite-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" id="access-panel" aria-labelledby={`access-tab-${tab.id}`}>
        <pre className="max-h-80 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-graphite-ink [overflow-wrap:anywhere]">
          {tab.code}
        </pre>
        <div className="flex items-center justify-between gap-3 border-t border-graphite-rule px-4 py-2.5">
          <p className="min-w-0 text-xs text-graphite-muted">{tab.note}</p>
          <CopyButton key={tab.id} value={tab.code} label="Copy" />
        </div>
      </div>
    </section>
  );
}
